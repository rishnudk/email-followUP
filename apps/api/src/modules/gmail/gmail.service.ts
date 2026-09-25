import { google, gmail_v1 } from 'googleapis';
import { GoogleService } from '../auth/google.service';

export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  rfcMessageId?: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet?: string;
  isSentByUser: boolean;
  isAutoReply: boolean;
  isBounce: boolean;
  references?: string;
}

export interface SendThreadEmailOptions {
  to: string;
  from?: string;
  subject: string;
  body: string;
  threadId: string;
  inReplyTo?: string; // RFC 2822 Message-ID (e.g. "<xyz@mail.gmail.com>")
  references?: string;
}

export class GmailService {
  private gmail: gmail_v1.Gmail;
  public userEmail: string;

  constructor(gmailClient: gmail_v1.Gmail, userEmail: string) {
    this.gmail = gmailClient;
    this.userEmail = userEmail;
  }

  /**
   * Factory method to create a GmailService instance for a specific authenticated user.
   */
  static async createForUser(userId: string): Promise<GmailService> {
    const authClient = await GoogleService.getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Fetch user profile to get the authenticated email address
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profile.data.emailAddress || '';

    return new GmailService(gmail, userEmail);
  }

  /**
   * Builds an RFC 2822 MIME message and converts it to base64url for Gmail API.
   * Crucial for keeping Gmail threads connected across clients.
   */
  static buildMimeMessage(options: SendThreadEmailOptions): string {
    const headers: string[] = [];

    if (options.from) {
      headers.push(`From: ${options.from}`);
    }
    headers.push(`To: ${options.to}`);

    // Ensure subject starts with "Re: " if not already present
    const cleanSubject = options.subject.toLowerCase().startsWith('re:')
      ? options.subject
      : `Re: ${options.subject}`;
    headers.push(`Subject: =?UTF-8?B?${Buffer.from(cleanSubject).toString('base64')}?=`);

    // In-Reply-To header connects to the parent message
    if (options.inReplyTo) {
      headers.push(`In-Reply-To: ${options.inReplyTo}`);
    }

    // References header maintains the chain of messages in the conversation
    if (options.references) {
      const refChain = options.inReplyTo && !options.references.includes(options.inReplyTo)
        ? `${options.references} ${options.inReplyTo}`
        : options.references;
      headers.push(`References: ${refChain}`);
    } else if (options.inReplyTo) {
      headers.push(`References: ${options.inReplyTo}`);
    }

    headers.push('MIME-Version: 1.0');
    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: 7bit');

    const emailRaw = `${headers.join('\r\n')}\r\n\r\n${options.body}`;

    // Base64URL encoding required by Gmail API
    return Buffer.from(emailRaw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Helper to parse headers from a raw Gmail API message.
   */
  static parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[] = []): Record<string, string> {
    const map: Record<string, string> = {};
    for (const h of headers) {
      if (h.name && h.value) {
        map[h.name.toLowerCase()] = h.value;
      }
    }
    return map;
  }

  /**
   * Checks if an email message is an Out-of-Office auto-responder or bounce.
   */
  static isAutoReplyOrBounce(headerMap: Record<string, string>, subject: string = '', from: string = ''): {
    isAutoReply: boolean;
    isBounce: boolean;
  } {
    const autoSubmitted = headerMap['auto-submitted'] || '';
    const xAutoReply = headerMap['x-autoreply'] || '';
    const precedence = headerMap['precedence'] || '';

    const lowerSub = subject.toLowerCase();
    const lowerFrom = from.toLowerCase();

    const isAutoReply =
      autoSubmitted.toLowerCase() === 'auto-replied' ||
      xAutoReply.toLowerCase() === 'yes' ||
      precedence.toLowerCase() === 'auto_reply' ||
      lowerSub.startsWith('automatic reply:') ||
      lowerSub.startsWith('out of office:') ||
      lowerSub.startsWith('auto-reply:');

    const isBounce =
      lowerFrom.includes('mailer-daemon@') ||
      lowerFrom.includes('postmaster@') ||
      lowerSub.includes('undelivered mail returned to sender') ||
      lowerSub.includes('delivery status notification (failure)') ||
      Boolean(headerMap['x-failed-recipients']);

    return { isAutoReply, isBounce };
  }

  /**
   * Parses a raw Gmail API message into a structured ParsedGmailMessage.
   */
  parseMessage(msg: gmail_v1.Schema$Message): ParsedGmailMessage {
    const headers = GmailService.parseHeaders(msg.payload?.headers || []);
    const from = headers['from'] || '';
    const to = headers['to'] || '';
    const subject = headers['subject'] || '(No Subject)';
    const rfcMessageId = headers['message-id'];
    const references = headers['references'];

    const dateHeader = headers['date'];
    const date = dateHeader ? new Date(dateHeader) : new Date(Number(msg.internalDate || Date.now()));

    const isSentByUser = from.toLowerCase().includes(this.userEmail.toLowerCase());
    const { isAutoReply, isBounce } = GmailService.isAutoReplyOrBounce(headers, subject, from);

    return {
      id: msg.id!,
      threadId: msg.threadId!,
      rfcMessageId,
      subject,
      from,
      to,
      date,
      snippet: msg.snippet || undefined,
      isSentByUser,
      isAutoReply,
      isBounce,
      references,
    };
  }

  /**
   * Lists sent messages from Gmail matching a query filter.
   */
  async listSentMessages(query?: string, maxResults: number = 50): Promise<ParsedGmailMessage[]> {
    const q = query ? `label:SENT ${query}` : 'label:SENT';
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults,
    });

    const messages = response.data.messages || [];
    const parsed: ParsedGmailMessage[] = [];

    for (const m of messages) {
      if (!m.id) continue;
      const fullMsg = await this.getMessage(m.id);
      if (fullMsg) parsed.push(fullMsg);
    }

    return parsed;
  }

  /**
   * Fetches and parses a single Gmail message by ID.
   */
  async getMessage(messageId: string): Promise<ParsedGmailMessage | null> {
    try {
      const res = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return this.parseMessage(res.data);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Fetches an entire Gmail thread and parses all messages in chronological order.
   */
  async getThread(threadId: string): Promise<ParsedGmailMessage[]> {
    const res = await this.gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    const rawMessages = res.data.messages || [];
    return rawMessages.map((m) => this.parseMessage(m));
  }

  /**
   * Sends an email inside an existing conversation thread with full RFC 2822 headers.
   */
  async sendEmailInThread(options: SendThreadEmailOptions): Promise<gmail_v1.Schema$Message> {
    const from = options.from || this.userEmail;
    const raw = GmailService.buildMimeMessage({ ...options, from });

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: options.threadId,
      },
    });

    return res.data;
  }

  /**
   * Creates a draft inside an existing conversation thread (for "Draft First" safety mode).
   */
  async createDraftInThread(options: SendThreadEmailOptions): Promise<gmail_v1.Schema$Draft> {
    const from = options.from || this.userEmail;
    const raw = GmailService.buildMimeMessage({ ...options, from });

    const res = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw,
          threadId: options.threadId,
        },
      },
    });

    return res.data;
  }
}
