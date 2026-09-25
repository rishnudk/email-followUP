export interface TemplateVariables {
  recipientName?: string | null;
  recipientEmail: string;
  senderName?: string | null;
  senderEmail: string;
  originalSubject: string;
  company?: string;
  position?: string;
}

export class TemplateService {
  /**
   * Infers company name from an email domain (e.g. hr@acme.com -> Acme).
   */
  static inferCompanyFromEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length < 2) return 'your team';

    const domain = parts[1].toLowerCase();
    const commonFreeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'proton.me'];
    if (commonFreeDomains.includes(domain)) {
      return 'your team';
    }

    const domainName = domain.split('.')[0];
    return domainName.charAt(0).toUpperCase() + domainName.slice(1);
  }

  /**
   * Infers position from an email subject line.
   * e.g. "Application for Senior React Engineer" -> "Senior React Engineer"
   */
  static inferPositionFromSubject(subject: string): string {
    const clean = subject.replace(/^(re|fwd):\s*/i, '').trim();
    const roleMatches = clean.match(/(?:role|position|application for|applying for)\s*[:-]?\s*(.+)$/i);
    if (roleMatches && roleMatches[1]) {
      return roleMatches[1].trim();
    }
    return clean;
  }

  /**
   * Interpolates placeholders ({{key}}) with resolved variable values.
   */
  static interpolate(templateStr: string, vars: TemplateVariables): string {
    const company = vars.company || this.inferCompanyFromEmail(vars.recipientEmail);
    const position = vars.position || this.inferPositionFromSubject(vars.originalSubject);
    const recipientName = vars.recipientName || vars.recipientEmail.split('@')[0];
    const senderName = vars.senderName || vars.senderEmail.split('@')[0];
    const originalSubject = vars.originalSubject.replace(/^(re|fwd):\s*/i, '').trim();

    const replacements: Record<string, string> = {
      '{{recipientName}}': recipientName,
      '{{recipientEmail}}': vars.recipientEmail,
      '{{senderName}}': senderName,
      '{{senderEmail}}': vars.senderEmail,
      '{{originalSubject}}': originalSubject,
      '{{company}}': company,
      '{{position}}': position,
    };

    let result = templateStr;
    for (const [placeholder, val] of Object.entries(replacements)) {
      // Replace all occurrences (case-insensitive)
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(regex, val);
    }

    return result;
  }
}
