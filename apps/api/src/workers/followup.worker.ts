import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis';
import { FOLLOWUP_QUEUE_NAME, FollowUpJobData } from '../queues/followup.queue';
import { prisma } from '../lib/prisma';
import { EmailStatus, FollowUpStatus } from '@email-followup/shared';
import { ReplyDetectionService } from '../modules/emails/reply-detection.service';

let worker: Worker<FollowUpJobData> | null = null;

/**
 * Initializes and starts the BullMQ follow-up worker.
 */
export function startFollowUpWorker(): Worker<FollowUpJobData> {
  if (worker) return worker;

  worker = new Worker<FollowUpJobData>(
    FOLLOWUP_QUEUE_NAME,
    async (job: Job<FollowUpJobData>) => {
      const { emailThreadId, attempt, userId } = job.data;
      console.log(`[FollowUpWorker] Received job ${job.id} for thread ${emailThreadId} (attempt ${attempt})`);

      // 1. Load thread and verify state
      const thread = await prisma.emailThread.findUnique({
        where: { id: emailThreadId },
        include: { user: true },
      });

      if (!thread) {
        console.warn(`[FollowUpWorker] Thread ${emailThreadId} not found. Skipping.`);
        return { status: 'skipped', reason: 'thread_not_found' };
      }

      // 2. Check if automation is still active
      if (!thread.followUpEnabled) {
        console.log(`[FollowUpWorker] Automation disabled for thread ${emailThreadId}. Stopping.`);
        return { status: 'skipped', reason: 'automation_disabled' };
      }

      if (thread.status !== EmailStatus.WAITING) {
        console.log(`[FollowUpWorker] Thread ${emailThreadId} status is ${thread.status}. Stopping.`);
        return { status: 'skipped', reason: `status_${thread.status}` };
      }

      // 3. Mark or create FollowUp attempt in PROCESSING state for audit & idempotency
      const followUp = await prisma.followUp.upsert({
        where: {
          emailThreadId_attempt: {
            emailThreadId,
            attempt,
          },
        },
        update: {
          status: FollowUpStatus.PROCESSING,
        },
        create: {
          emailThreadId,
          attempt,
          scheduledAt: new Date(),
          status: FollowUpStatus.PROCESSING,
        },
      });

      // 4. Live inspect thread for human replies, bounces, and auto-responders
      const inspection = await ReplyDetectionService.inspectThread(userId, emailThreadId);

      if (inspection.hasReplied) {
        console.log(`[FollowUpWorker] Recipient replied to thread ${emailThreadId}. Cancelling follow-up #${attempt}.`);
        await prisma.followUp.update({
          where: { id: followUp.id },
          data: { status: FollowUpStatus.CANCELLED },
        });
        return { status: 'cancelled', reason: 'recipient_replied' };
      }

      if (inspection.isBounced) {
        console.log(`[FollowUpWorker] Email thread ${emailThreadId} has bounced. Cancelling follow-up #${attempt}.`);
        await prisma.followUp.update({
          where: { id: followUp.id },
          data: { status: FollowUpStatus.CANCELLED },
        });
        return { status: 'cancelled', reason: 'email_bounced' };
      }

      console.log(`[FollowUpWorker] No reply detected for thread ${emailThreadId}. Ready to dispatch follow-up #${attempt}.`);
      return { status: 'ready_to_send', followUpId: followUp.id };
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[FollowUpWorker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[FollowUpWorker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[FollowUpWorker] Follow-up background worker initialized and ready.');
  return worker;
}

/**
 * Gracefully closes the worker on application shutdown.
 */
export async function stopFollowUpWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[FollowUpWorker] Worker closed gracefully.');
  }
}
