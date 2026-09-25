# Auto Email Follow-Up System — Implementation Roadmap & Checklist

Progress Tracker: `[x]` Completed | `[/]` In Progress | `[ ]` Pending

---

## Phase 1: Scaffolding & Environment Setup
- [x] Create monorepo workspace configuration (`package.json`, `tsconfig.base.json`)
- [x] Configure Docker environment (`docker-compose.yml` for PostgreSQL 16 & Redis 7 with AOF persistence)
- [x] Setup environment template and security ignore rules (`.env.example`, `.env`, `.gitignore`)
- [x] Create shared domain models package (`packages/shared`)
- [x] Scaffold Fastify backend application (`apps/api`)
- [x] Scaffold Next.js frontend application (`apps/web`)
- [x] Verify builds and initial test health check endpoint (`/health`)

---

## Phase 2: Database Setup & Token Security
- [x] Start PostgreSQL and Redis containers (`docker compose up -d`)
- [x] Push/Migrate Prisma schema to PostgreSQL (`npx prisma db push`)
- [x] Implement AES-256 encryption/decryption utility for OAuth refresh tokens (`apps/api/src/lib/crypto.ts`)
- [x] Create Prisma database client singleton service (`apps/api/src/lib/prisma.ts`)
- [x] Seed initial default follow-up templates (`apps/api/prisma/seed.ts`)

---

## Phase 3: Google OAuth 2.0 & Authentication
- [x] Configure Google OAuth client service (`apps/api/src/modules/auth/google.service.ts`)
- [x] Implement `GET /auth/google` route (generate OAuth consent URL with offline access)
- [x] Implement `GET /auth/google/callback` route (exchange code for tokens, encrypt & save user, seed templates)
- [x] Implement session/cookie authentication middleware for protected routes (`apps/api/src/plugins/auth.plugin.ts`)
- [x] Implement automatic token refreshing logic before making Gmail API calls (`GoogleService.getAuthenticatedClient`)
- [x] Implement `GET /auth/me` and `POST /auth/logout`

---

## Phase 4: Gmail API Client & Thread Extraction
- [x] Implement `GmailService` class wrapping Googleapis client (`apps/api/src/modules/gmail/gmail.service.ts`)
- [x] Implement message fetching & RFC 2822 header extraction:
  - Extract internal `threadId` and `id`
  - Extract RFC `Message-ID`, `Subject`, `From`, `To`, `Date`
- [x] Implement raw MIME email builder:
  - Add `In-Reply-To` and `References` headers for strict email client threading
  - Set `Subject: Re: ...`
  - Base64URL-encode raw message
- [x] Implement `sendEmailInThread()` method

---

## Phase 5: Sent Email Detection & Sync Engine
- [x] Implement sent message polling query (`label:SENT after:<timestamp>`) (`EmailSyncService`)
- [x] Implement message deduplication (unique by `userId + providerThreadId`)
- [x] Store `EmailThread` and initial `EmailMessage`
- [x] Add manual sync endpoint (`POST /emails/sync`)
- [x] Setup background periodic sync task (every 5 minutes in `server.ts`)

---

## Phase 6: Queue & BullMQ Scheduling
- [x] Connect Redis client via `ioredis` (`apps/api/src/lib/redis.ts`)
- [x] Create `followup-queue.ts` with BullMQ (`apps/api/src/queues/followup.queue.ts`):
  - Add jobs with deterministic `jobId` (`followup:<threadId>:<attempt>`)
  - Configurable delay (e.g., 3 days, 5 days in milliseconds)
  - Helper to cancel scheduled jobs by `jobId`
- [x] Create `followup-worker.ts` skeleton to process scheduled follow-up jobs (`apps/api/src/workers/followup.worker.ts`)
- [x] Implement business hours / weekday scheduling calculator (`apps/api/src/lib/scheduler.ts`)

---

## Phase 7: Reply, Bounce & Auto-Responder Detection
- [x] Implement thread inspection logic (`ReplyDetectionService.inspectThread`)
  - Retrieve all messages in thread since original email
  - Check if any inbound message exists from recipient
- [x] Filter out non-human emails:
  - Detect Out-of-Office auto-replies (`Auto-Submitted: auto-replied`, `X-Autoreply: yes`, subject patterns)
  - Detect bounce/delivery failure emails (`mailer-daemon@*`, `postmaster@*`, failure subjects)
- [x] When valid reply is found:
  - Store incoming message in `EmailMessage`
  - Update `EmailThread.status = REPLIED`
  - Cancel any scheduled BullMQ follow-ups for this thread
- [x] When bounce is found:
  - Update `EmailThread.status = BOUNCED` and cancel future follow-ups
- [x] Live inspect thread inside `FollowUpWorker` before dispatching follow-up

---

## Phase 8: Follow-Up Dispatching & Templating
- [ ] Implement template variable interpolation:
  - `{{recipientName}}`, `{{senderName}}`, `{{originalSubject}}`, `{{company}}`, `{{position}}`
- [ ] Follow-up Worker execution steps:
  1. Load thread and verify status is still `WAITING`
  2. Verify thread automation is still enabled
  3. Run reply check
  4. If no reply, construct MIME reply and call `sendMessage()`
  5. Mark current `FollowUp.status = SENT`
  6. If `attempt < maxFollowUps`, schedule next follow-up job
  7. If max attempts reached, mark `EmailThread.status = COMPLETED`

---

## Phase 9: Fastify REST API Routes
- [ ] **Emails / Threads:**
  - `GET /emails` (list threads with pagination, filter by status)
  - `GET /emails/:id` (thread details + message timeline + follow-up history)
  - `POST /emails/:id/enable` (enable automation)
  - `POST /emails/:id/disable` (disable automation)
  - `POST /emails/:id/stop` (permanently stop)
- [ ] **Follow-ups:**
  - `GET /followups/upcoming` (list pending follow-ups)
  - `POST /followups/:id/send-now` (manual trigger)
  - `POST /followups/:id/cancel` (cancel specific attempt)
- [ ] **Templates:**
  - `GET /templates`, `POST /templates`, `PATCH /templates/:id`, `DELETE /templates/:id`
- [ ] **Settings & Analytics:**
  - `GET /settings`, `PATCH /settings`
  - `GET /dashboard/stats` (counts for Sent, Waiting, Replied, Due Soon)

---

## Phase 10: Frontend UI (Next.js + Tailwind + shadcn/ui)
- [ ] Global styling and dark/light modern UI design system
- [ ] Google OAuth login button and session state provider
- [ ] Dashboard overview page (`/`):
  - Metric summary cards (Sent, Waiting, Replied, Due)
  - Upcoming follow-ups widget
- [ ] Email Threads page (`/emails`):
  - Filterable & searchable table with status badges and next follow-up dates
  - Quick action toggles
- [ ] Thread Detail drawer/page (`/emails/:id`):
  - Email history timeline
  - "Send Follow-up Now" button
  - Follow-up schedule preview
- [ ] Templates manager (`/templates`):
  - Rich template editor with variable placeholders
- [ ] Settings page (`/settings`):
  - Default follow-up intervals (e.g. 3 days, 5 days)
  - Auto-tracking toggle & Timezone selection

---

## Phase 11: Reliability, Safety & Testing
- [ ] Add "Draft First" mode (create Gmail draft instead of direct send for safety testing)
- [ ] End-to-end integration test with test Gmail account
- [ ] Idempotency tests (verify worker restart does not send duplicates)
- [ ] Retry backoff on Gmail rate limits (429 / 503)

---

## Phase 12: Production Deployment & Real-time Pub/Sub (Optional)
- [ ] Setup Google Cloud Pub/Sub push notifications for instant sent/received email detection
- [ ] Production build verification & deployment guide (Vercel + Railway/Render + Supabase/Neon)
