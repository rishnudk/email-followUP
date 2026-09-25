export enum EmailStatus {
  WAITING = 'WAITING',
  REPLIED = 'REPLIED',
  COMPLETED = 'COMPLETED',
  STOPPED = 'STOPPED',
  BOUNCED = 'BOUNCED'
}

export enum FollowUpStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export enum EmailDirection {
  SENT = 'SENT',
  RECEIVED = 'RECEIVED'
}

export interface UserDTO {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
}

export interface EmailThreadDTO {
  id: string;
  providerThreadId: string;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  sentAt: string;
  status: EmailStatus;
  followUpEnabled: boolean;
  followUpCount: number;
  maxFollowUps: number;
  nextFollowUpAt?: string | null;
  messages?: EmailMessageDTO[];
  followUps?: FollowUpDTO[];
}

export interface EmailMessageDTO {
  id: string;
  providerMessageId: string;
  originalRfcMessageId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject?: string | null;
  sentAt: string;
  direction: EmailDirection;
}

export interface FollowUpDTO {
  id: string;
  attempt: number;
  scheduledAt: string;
  sentAt?: string | null;
  status: FollowUpStatus;
}

export interface DashboardStatsDTO {
  sentCount: number;
  waitingCount: number;
  repliedCount: number;
  dueSoonCount: number;
}
