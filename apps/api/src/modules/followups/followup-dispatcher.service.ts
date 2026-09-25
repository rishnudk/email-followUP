import { prisma } from '../../lib/prisma';
import { GmailService } from '../gmail/gmail.service';
import { TemplateService } from '../templates/template.service';
import { calculateFollowUpTime } from '../../lib/scheduler';
import { scheduleFollowUpJob } from '../../queues/followup.queue';
import { EmailDirection, EmailStatus, FollowUpStatus } from '@email-followup/shared';
import { DEFAULT_TEMPLATES } from '../../lib/constants';

export class FollowUpDispatcherService {
  /**
   * Dispatches a scheduled or manual follow-up email inside the existing Gmail thread.
   */
  static async dispatchFollowUp(emailThreadId: string, attempt: number): Promise<any> {
    const thread = await prisma.emailThread.findUnique({
      where: { id: emailThreadId },
      include: {
        user: true,
        messages: {
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!thread) {
      throw new Error(`Thread ${emailThreadId} not found`);
    }

    if (thread.status !== EmailStatus.WAITING) {
      console.log(`[FollowUpDispatcher] Thread ${emailThreadId} status is ${thread.status}. Aborting send.`);
      return { skipped: true, reason: `status_${thread.status}` };
    }

    if (!thread.followUpEnabled) {
      console.log(`[FollowUpDispatcher] Follow-up automation disabled for thread ${emailThreadId}. Aborting.`);
      return { skipped: true, reason: 'automation_disabled' };
    }

    // Identify parent message for RFC 2822 threading headers
    const lastMessage = thread.messages[0]; // Most recent message
    const parentRfcId = lastMessage?.originalRfcMessageId || undefined;

    // Build references chain: collect RFC message IDs
    const referencesChain = thread.messages
      .filter((m) => Boolean(m.originalRfcMessageId))
      .map((m) => m.originalRfcMessageId!)
      .reverse()
      .join(' ');

    // 1. Fetch template: look for user's default template, or fall back to system default
    let template = await prisma.followUpTemplate.findFirst({
      where: {
        userId: thread.userId,
        isDefault: true,
      },
    });

    if (!template) {
      template = await prisma.followUpTemplate.findFirst({
        where: { userId: thread.userId },
      });
    }

    const templateSubject = template?.subject || DEFAULT_TEMPLATES[0].subject;
    const templateBody = template?.body || DEFAULT_TEMPLATES[0].body;

    // 2. Interpolate template variables
    const interpolatedBody = TemplateService.interpolate(templateBody, {
      recipientName: thread.recipientName,
      recipientEmail: thread.recipientEmail,
      senderName: thread.user.name,
      senderEmail: thread.user.email,
      originalSubject: thread.subject,
    });

    const interpolatedSubject = TemplateService.interpolate(templateSubject, {
      recipientName: thread.recipientName,
      recipientEmail: thread.recipientEmail,
      senderName: thread.user.name,
      senderEmail: thread.user.email,
      originalSubject: thread.subject,
    });

    // 3. Send email via Gmail API
    const gmail = await GmailService.createForUser(thread.userId);
    const sentGmailMsg = await gmail.sendEmailInThread({
      to: thread.recipientEmail,
      from: thread.user.email,
      subject: interpolatedSubject,
      body: interpolatedBody,
      threadId: thread.providerThreadId,
      inReplyTo: parentRfcId,
      references: referencesChain || parentRfcId,
    });

    const now = new Date();

    // 4. Record new message in database
    await prisma.emailMessage.create({
      data: {
        emailThreadId: thread.id,
        providerMessageId: sentGmailMsg.id || `sent_${now.getTime()}`,
        originalRfcMessageId: undefined, // Will be fetched on next sync
        senderEmail: thread.user.email,
        recipientEmail: thread.recipientEmail,
        subject: interpolatedSubject,
        snippet: interpolatedBody.slice(0, 150),
        sentAt: now,
        direction: EmailDirection.SENT,
      },
    });

    // 5. Update FollowUp record
    const followUp = await prisma.followUp.upsert({
      where: {
        emailThreadId_attempt: {
          emailThreadId: thread.id,
          attempt,
        },
      },
      update: {
        status: FollowUpStatus.SENT,
        sentAt: now,
        customBody: interpolatedBody,
      },
      create: {
        emailThreadId: thread.id,
        attempt,
        scheduledAt: now,
        sentAt: now,
        status: FollowUpStatus.SENT,
        customBody: interpolatedBody,
      },
    });

    // 6. Calculate next follow-up or mark as completed
    const newFollowUpCount = attempt;

    if (newFollowUpCount < thread.maxFollowUps) {
      // Schedule next follow-up (e.g. 5 days later)
      const nextDelayDays = thread.user.defaultSecondFollowUpDays || 5;
      const timing = calculateFollowUpTime({
        fromDate: now,
        businessDaysDelay: nextDelayDays,
      });

      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          followUpCount: newFollowUpCount,
          nextFollowUpAt: timing.scheduledAt,
        },
      });

      await scheduleFollowUpJob(
        {
          emailThreadId: thread.id,
          attempt: newFollowUpCount + 1,
          userId: thread.userId,
        },
        timing.delayMs
      );

      console.log(`[FollowUpDispatcher] Scheduled follow-up #${newFollowUpCount + 1} for thread ${thread.id} in ${nextDelayDays} business days`);
    } else {
      // Reached maximum allowed follow-ups
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          followUpCount: newFollowUpCount,
          status: EmailStatus.COMPLETED,
          nextFollowUpAt: null,
        },
      });

      console.log(`[FollowUpDispatcher] Thread ${thread.id} reached max follow-ups (${thread.maxFollowUps}). Marked COMPLETED.`);
    }

    return {
      success: true,
      followUpId: followUp.id,
      attempt,
      sentAt: now,
    };
  }
}
