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

/**
 * Schedules a delayed follow-up job using a deterministic jobId to prevent duplicate executions.
 */
export async function scheduleFollowUpJob(
  data: FollowUpJobData,
  delayMs: number
) {
  const jobId = `followup:${data.emailThreadId}:${data.attempt}`;

  // Check if a job with this deterministic ID already exists
  const existingJob = await followUpQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'delayed' || state === 'waiting') {
      await existingJob.remove();
    }
  }

  const job = await followUpQueue.add('send-followup', data, {
    delay: delayMs,
    jobId,
  });

  return job;
}

/**
 * Cancels a specific follow-up attempt for a thread.
 */
export async function cancelFollowUpJob(emailThreadId: string, attempt: number) {
  const jobId = `followup:${emailThreadId}:${attempt}`;
  const job = await followUpQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
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
