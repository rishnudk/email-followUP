import { prisma } from '../../lib/prisma';
import { GmailService, ParsedGmailMessage } from '../gmail/gmail.service';
import { EmailDirection, EmailStatus } from '@email-followup/shared';

export interface SyncStats {
  scannedCount: number;
  newThreadsCount: number;
  newMessagesCount: number;
}

export class EmailSyncService {
  /**
   * Helper to parse "Name <email@domain.com>" or "email@domain.com"
   */
  static parseRecipient(rawTo: string): { email: string; name?: string } {
    const trimmed = rawTo.trim();
    const match = trimmed.match(/^(?:"?([^"]*)"?\s)?<?([^\s<>@]+@[^\s<>@]+)>?$/);

    if (match) {
      const name = match[1]?.trim() || undefined;
      const email = match[2]?.trim() || trimmed;
      return { email, name };
    }

    return { email: trimmed };
  }

  /**
   * Synchronizes sent emails for a given user from Gmail to PostgreSQL.
   */
  static async syncSentEmailsForUser(userId: string): Promise<SyncStats> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new Error(`User ${userId} does not have a connected Google account.`);
    }

    const gmail = await GmailService.createForUser(userId);

    // Build query: only fetch messages sent after lastSyncAt, or past 7 days on initial sync
    let query: string;
    if (user.lastSyncAt) {
      // Go 1 minute before lastSyncAt to ensure no edge-case messages are missed
      const sinceUnix = Math.floor(user.lastSyncAt.getTime() / 1000) - 60;
      query = `after:${sinceUnix}`;
    } else {
      query = 'newer_than:7d';
    }

    const sentMessages = await gmail.listSentMessages(query);

    let newThreadsCount = 0;
    let newMessagesCount = 0;

    for (const msg of sentMessages) {
      const { email: recipientEmail, name: recipientName } = this.parseRecipient(msg.to);

      // Check if thread already exists in our database
      let thread = await prisma.emailThread.findUnique({
        where: {
          userId_providerThreadId: {
            userId: user.id,
            providerThreadId: msg.threadId,
          },
        },
      });

      if (!thread) {
        // Calculate initial follow-up date if automation is auto-enabled
        const nextFollowUpAt = user.autoEnableFollowUp
          ? new Date(msg.date.getTime() + user.defaultFirstFollowUpDays * 24 * 60 * 60 * 1000)
          : null;

        thread = await prisma.emailThread.create({
          data: {
            userId: user.id,
            providerThreadId: msg.threadId,
            recipientEmail,
            recipientName,
            subject: msg.subject,
            sentAt: msg.date,
            status: EmailStatus.WAITING,
            followUpEnabled: user.autoEnableFollowUp,
            maxFollowUps: user.defaultMaxFollowUps,
            nextFollowUpAt,
          },
        });

        newThreadsCount++;
      }

      // Check if this specific message already exists in the thread
      const existingMessage = await prisma.emailMessage.findFirst({
        where: {
          emailThreadId: thread.id,
          providerMessageId: msg.id,
        },
      });

      if (!existingMessage) {
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
            direction: EmailDirection.SENT,
            isAutoReply: msg.isAutoReply,
          },
        });

        newMessagesCount++;
      }
    }

    // Update lastSyncAt for user
    await prisma.user.update({
      where: { id: userId },
      data: { lastSyncAt: new Date() },
    });

    return {
      scannedCount: sentMessages.length,
      newThreadsCount,
      newMessagesCount,
    };
  }

  /**
   * Syncs all active users who have autoTrackSentEmails enabled.
   */
  static async syncAllActiveUsers(): Promise<void> {
    const users = await prisma.user.findMany({
      where: {
        autoTrackSentEmails: true,
        refreshToken: { not: null },
      },
      select: { id: true, email: true },
    });

    for (const u of users) {
      try {
        await this.syncSentEmailsForUser(u.id);
      } catch (err: any) {
        console.error(`[EmailSync] Error syncing emails for ${u.email}:`, err.message);
      }
    }
  }
}
