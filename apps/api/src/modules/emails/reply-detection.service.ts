import { prisma } from '../../lib/prisma';
import { GmailService, ParsedGmailMessage } from '../gmail/gmail.service';
import { EmailDirection, EmailStatus } from '@email-followup/shared';
import { cancelAllFollowUpsForThread } from '../../queues/followup.queue';

export interface ReplyInspectionResult {
  hasReplied: boolean;
  isBounced: boolean;
  isAutoReply: boolean;
  replyMessage?: ParsedGmailMessage;
  newMessagesCount: number;
}

export class ReplyDetectionService {
  /**
   * Inspects a thread live via Gmail API to detect replies, bounces, and auto-responders.
   */
  static async inspectThread(userId: string, emailThreadId: string): Promise<ReplyInspectionResult> {
    const thread = await prisma.emailThread.findFirst({
      where: { id: emailThreadId, userId },
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    if (!thread) {
      throw new Error(`EmailThread ${emailThreadId} not found for user ${userId}`);
    }

    const gmail = await GmailService.createForUser(userId);
    const liveMessages = await gmail.getThread(thread.providerThreadId);

    // Find the timestamp of the first outbound email
    const originalSentAt = thread.sentAt.getTime();

    let hasReplied = false;
    let isBounced = false;
    let isAutoReply = false;
    let replyMessage: ParsedGmailMessage | undefined;
    let newMessagesCount = 0;

    for (const msg of liveMessages) {
      // 1. Sync any new incoming messages to database if not already stored
      const alreadyStored = thread.messages.some((m) => m.providerMessageId === msg.id);

      if (!alreadyStored) {
        await prisma.emailMessage.create({
          data: {
            emailThreadId: thread.id,
            providerMessageId: msg.id,
            originalRfcMessageId: msg.rfcMessageId,
            senderEmail: msg.from,
            recipientEmail: msg.to,
            subject: msg.subject,
            snippet: msg.snippet,
            sentAt: msg.date,
            direction: msg.isSentByUser ? EmailDirection.SENT : EmailDirection.RECEIVED,
            isAutoReply: msg.isAutoReply,
          },
        });
        newMessagesCount++;
      }

      // Ignore messages sent by the user themselves
      if (msg.isSentByUser) {
        continue;
      }

      // Only inspect messages received after the original outbound email
      if (msg.date.getTime() >= originalSentAt - 60000) {
        if (msg.isBounce) {
          isBounced = true;
          break;
        }

        if (msg.isAutoReply) {
          isAutoReply = true;
          console.log(`[ReplyDetection] Out-of-Office auto-reply detected in thread ${thread.id}. Continuing follow-up schedule.`);
          continue; // Do NOT stop follow-ups for OOO auto-responders
        }

        // Legitimate human reply received!
        hasReplied = true;
        replyMessage = msg;
        break;
      }
    }

    // Handle State Transitions
    if (isBounced) {
      console.log(`[ReplyDetection] Thread ${thread.id} bounced. Updating status to BOUNCED and cancelling jobs.`);
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          status: EmailStatus.BOUNCED,
          followUpEnabled: false,
          nextFollowUpAt: null,
        },
      });
      await cancelAllFollowUpsForThread(thread.id);
    } else if (hasReplied) {
      console.log(`[ReplyDetection] Human reply detected in thread ${thread.id}. Updating status to REPLIED and cancelling follow-ups.`);
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          status: EmailStatus.REPLIED,
          followUpEnabled: false,
          nextFollowUpAt: null,
        },
      });
      await cancelAllFollowUpsForThread(thread.id);
    }

    return {
      hasReplied,
      isBounced,
      isAutoReply,
      replyMessage,
      newMessagesCount,
    };
  }

  /**
   * Scans all waiting threads for a user to update reply statuses in real time.
   */
  static async checkAllWaitingThreads(userId: string): Promise<number> {
    const waitingThreads = await prisma.emailThread.findMany({
      where: {
        userId,
        status: EmailStatus.WAITING,
        followUpEnabled: true,
      },
      select: { id: true },
    });

    let detectedReplies = 0;
    for (const t of waitingThreads) {
      try {
        const result = await this.inspectThread(userId, t.id);
        if (result.hasReplied || result.isBounced) {
          detectedReplies++;
        }
      } catch (err: any) {
        console.error(`[ReplyDetection] Failed inspecting thread ${t.id}:`, err.message);
      }
    }

    return detectedReplies;
  }
}
