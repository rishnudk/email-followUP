import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_TEMPLATES = [
  {
    name: 'Job Application — Polite Follow-Up #1',
    subject: 'Following up — {{position}}',
    body: `Hi {{recipientName}},

I hope you're having a great week.

I'm following up on my application for the {{position}} role. I remain very interested in the opportunity to join {{company}} and wanted to check if there are any updates regarding next steps.

Please let me know if you need any additional information from my side.

Best regards,
{{senderName}}`,
    isDefault: true,
  },
  {
    name: 'Job Application — Final Check-in #2',
    subject: 'Quick check-in — {{position}}',
    body: `Hi {{recipientName}},

I wanted to quickly check in one last time regarding my application for the {{position}} position at {{company}}.

I understand you're busy, so any brief update would be greatly appreciated.

Thank you again for your time and consideration!

Best regards,
{{senderName}}`,
    isDefault: false,
  },
  {
    name: 'General Business Follow-Up',
    subject: 'Re: {{originalSubject}}',
    body: `Hi {{recipientName}},

Just following up on my previous email regarding {{originalSubject}}.

Please let me know if you have had a chance to review this or if you need any further details.

Thanks,
{{senderName}}`,
    isDefault: false,
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Create a default system/demo user if needed or verify database connectivity
  console.log(`✅ Loaded ${DEFAULT_TEMPLATES.length} default template blueprints.`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
