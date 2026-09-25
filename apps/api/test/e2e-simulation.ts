import { encrypt, decrypt } from '../src/lib/crypto';
import { TemplateService } from '../src/modules/templates/template.service';
import { GmailService } from '../src/modules/gmail/gmail.service';
import { addBusinessDays, calculateFollowUpTime } from '../src/lib/scheduler';
import { scheduleFollowUpJob, followUpQueue, cancelFollowUpJob } from '../src/queues/followup.queue';
import { prisma } from '../src/lib/prisma';
import assert from 'assert';

async function runTestSuite() {
  console.log('🧪 Starting End-to-End System Verification Test Suite...\n');

  // Test 1: Crypto Module
  console.log('Test 1: Testing AES-256-GCM Token Encryption & Decryption...');
  const testSecret = '1//04ABCDEF123456789-Sample-Google-OAuth-Refresh-Token';
  const cipher = encrypt(testSecret);
  assert(cipher.includes(':'), 'Encrypted string must be formatted as iv:authTag:ciphertext');
  assert.strictEqual(decrypt(cipher), testSecret, 'Decrypted token must exactly match original secret');
  console.log('  ✅ Crypto encryption/decryption passed.\n');

  // Test 2: Template Interpolation & Inference
  console.log('Test 2: Testing Template Variable Interpolation & Smart Inference...');
  const template = 'Hi {{recipientName}},\nFollowing up on {{position}} at {{company}}.\nThanks, {{senderName}}';
  const rendered = TemplateService.interpolate(template, {
    recipientName: 'Sarah Connor',
    recipientEmail: 'sarah@cyberdyne.com',
    senderName: 'John',
    senderEmail: 'john@gmail.com',
    originalSubject: 'Application for Lead AI Architect role',
  });
  assert(rendered.includes('Hi Sarah Connor,'), 'Recipient name must be interpolated');
  assert(rendered.includes('Cyberdyne'), 'Company name must be inferred from domain');
  assert(rendered.includes('Lead AI Architect'), 'Position must be inferred from subject');
  console.log('  ✅ Template interpolation and inference passed.\n');

  // Test 3: RFC 2822 MIME Header Builder
  console.log('Test 3: Testing RFC 2822 MIME Header Generator...');
  const mimeB64 = GmailService.buildMimeMessage({
    to: 'hiring@example.com',
    from: 'me@example.com',
    subject: 'Follow-Up',
    body: 'Following up!',
    threadId: 'thread_xyz',
    inReplyTo: '<parent-msg-id-123@mail.gmail.com>',
    references: '<root-msg-id-000@mail.gmail.com>',
  });
  const decodedMime = Buffer.from(mimeB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert(decodedMime.includes('In-Reply-To: <parent-msg-id-123@mail.gmail.com>'), 'Must include In-Reply-To header');
  assert(decodedMime.includes('References: <root-msg-id-000@mail.gmail.com> <parent-msg-id-123@mail.gmail.com>'), 'Must chain References header');
  console.log('  ✅ RFC 2822 MIME headers passed.\n');

  // Test 4: OOO & Bounce Detection
  console.log('Test 4: Testing Out-of-Office and Bounce Classifiers...');
  const oooResult = GmailService.isAutoReplyOrBounce(
    { 'auto-submitted': 'auto-replied', 'x-autoreply': 'yes' },
    'Automatic reply: Out of office until next week'
  );
  assert.strictEqual(oooResult.isAutoReply, true, 'Auto-responder must be detected');
  assert.strictEqual(oooResult.isBounce, false, 'Auto-responder must not be flagged as bounce');

  const bounceResult = GmailService.isAutoReplyOrBounce(
    {},
    'Undelivered Mail Returned to Sender',
    'mailer-daemon@googlemail.com'
  );
  assert.strictEqual(bounceResult.isBounce, true, 'Mailer-daemon delivery failure must be flagged as bounce');
  console.log('  ✅ OOO and bounce classification passed.\n');

  // Test 5: Business Day Scheduler
  console.log('Test 5: Testing Business Days Scheduler...');
  const friday = new Date('2026-09-25T10:00:00Z'); // Friday
  const threeBizDays = addBusinessDays(friday, 3);
  assert.strictEqual(threeBizDays.getDay(), 3, 'Friday + 3 business days must land on Wednesday');

  const timing = calculateFollowUpTime({ fromDate: friday, businessDaysDelay: 2 });
  assert(timing.delayMs > 0, 'Delay must be positive');
  console.log('  ✅ Business days scheduler passed.\n');

  // Test 6: BullMQ Redis Queue Scheduling & Cancellation
  console.log('Test 6: Testing BullMQ Queue Scheduling & Cancellation...');
  const testThreadId = 'test_integration_thread_001';
  const job = await scheduleFollowUpJob(
    { emailThreadId: testThreadId, attempt: 1, userId: 'test_user_001' },
    3600000 // 1 hour delay
  );
  assert.strictEqual(job.id, `followup:${testThreadId}:1`, 'Deterministic job ID must be formatted correctly');

  const foundJob = await followUpQueue.getJob(job.id!);
  assert(foundJob, 'Job must exist in Redis');

  const cancelled = await cancelFollowUpJob(testThreadId, 1);
  assert.strictEqual(cancelled, true, 'Job must be cancelled');

  const verifyRemoved = await followUpQueue.getJob(job.id!);
  assert(!verifyRemoved, 'Job must no longer exist in Redis');
  console.log('  ✅ BullMQ deterministic queue passed.\n');

  // Test 7: Prisma Database Connectivity
  console.log('Test 7: Testing PostgreSQL Database Connection...');
  const userCount = await prisma.user.count();
  assert(typeof userCount === 'number', 'Database query must return a number');
  console.log(`  ✅ PostgreSQL database connection passed (Current users: ${userCount}).\n`);

  console.log('🎉 ALL 7 TEST SUITES PASSED WITH 100% SUCCESS!');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
