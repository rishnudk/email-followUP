import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis';

export const FOLLOWUP_QUEUE_NAME = 'followup-queue';

export interface FollowUpJobData {
  emailThreadId: string;
  attempt: number;
  userId: string;
}

export const followUpQueue = new Queue<FollowUpJobData>(FOLLOWUP_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 15000, // 15s retry backoff on failure
    },
    removeOnComplete: 100, // Keep last 100 completed jobs for audit
    removeOnFail: 200,     // Keep last 200 failed jobs for debugging
  },
});

async function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Schedules a delayed follow-up job using a deterministic jobId to prevent duplicate executions.
 */
export async function scheduleFollowUpJob(
  data: FollowUpJobData,
  delayMs: number
) {
  try {
    const jobId = `followup:${data.emailThreadId}:${data.attempt}`;

    // Check if a job with this deterministic ID already exists
    const existingJob = await withTimeout(followUpQueue.getJob(jobId), 2000);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'delayed' || state === 'waiting') {
        await withTimeout(existingJob.remove(), 2000);
      }
    }

    const job = await withTimeout(
      followUpQueue.add('send-followup', data, {
        delay: delayMs,
        jobId,
      }),
      2500
    );

    return job;
  } catch (err: any) {
    console.warn(`[FollowUpQueue] Failed to schedule job for thread ${data.emailThreadId}:`, err.message);
    return null;
  }
}

/**
 * Cancels a specific follow-up attempt for a thread.
 */
export async function cancelFollowUpJob(emailThreadId: string, attempt: number) {
  try {
    const jobId = `followup:${emailThreadId}:${attempt}`;
    const job = await withTimeout(followUpQueue.getJob(jobId), 2000);
    if (job) {
      await withTimeout(job.remove(), 2000);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn(`[FollowUpQueue] Failed to cancel job for thread ${emailThreadId}:`, err.message);
    return false;
  }
}

/**
 * Cancels all pending follow-up attempts for an entire thread.
 */
export async function cancelAllFollowUpsForThread(emailThreadId: string, maxAttempts: number = 5) {
  const promises: Promise<boolean>[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    promises.push(cancelFollowUpJob(emailThreadId, attempt));
  }
  await Promise.all(promises);
}
