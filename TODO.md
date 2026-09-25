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
- [x] Implement template variable interpolation (`TemplateService.interpolate`):
  - `{{recipientName}}`, `{{senderName}}`, `{{originalSubject}}`, `{{company}}`, `{{position}}`
- [x] Follow-up Worker execution steps (`FollowUpDispatcherService.dispatchFollowUp`):
  1. Load thread and verify status is still `WAITING`
  2. Verify thread automation is still enabled
  3. Run live reply check via Gmail API
  4. If no reply, construct MIME reply with RFC 2822 headers and call Gmail send API
  5. Mark current `FollowUp.status = SENT`
  6. If `attempt < maxFollowUps`, schedule next follow-up job during work hours
  7. If max attempts reached, mark `EmailThread.status = COMPLETED`
- [x] Add manual "Send Follow-Up Now" endpoint (`POST /followups/:threadId/send-now`)
- [x] Add upcoming follow-ups query endpoint (`GET /followups/upcoming`)

---

## Phase 9: Fastify REST API Routes
- [x] **Emails / Threads:**
  - `GET /emails` (list threads with pagination, filter by status)
  - `GET /emails/:id` (thread details + message timeline + follow-up history)
  - `POST /emails/:id/enable` (enable automation and schedule job)
  - `POST /emails/:id/disable` (disable automation and cancel job)
  - `POST /emails/:id/stop` (permanently stop and cancel job)
- [x] **Follow-ups:**
  - `GET /followups/upcoming` (list pending follow-ups)
  - `POST /followups/:threadId/send-now` (manual trigger)
- [x] **Templates:**
  - `GET /templates`, `POST /templates`, `PATCH /templates/:id`, `DELETE /templates/:id`, `POST /templates/:id/set-default`
- [x] **Settings & Analytics:**
  - `GET /settings`, `PATCH /settings`
  - `GET /dashboard/stats` (counts for Sent, Waiting, Replied, Bounced, Due Soon)

---

## Phase 10: Frontend UI (Next.js + Tailwind + shadcn/ui)
- [x] Global styling and dark modern aesthetic UI design system (`globals.css`)
- [x] Google OAuth login landing view and session state provider
- [x] Dashboard overview page (`/`):
  - Metric summary cards (Sent, Waiting, Replied, Bounced, Due Soon)
  - Upcoming follow-ups widget & manual "Sync Gmail" trigger
- [x] Email Threads table:
  - Filterable & searchable table with status badges (`WAITING`, `REPLIED`, `COMPLETED`, `STOPPED`, `BOUNCED`)
  - Quick action toggles (Pause, Resume, Send Now, Stop)
- [x] Thread Detail drawer modal:
  - Full email history conversation timeline
  - "Send Follow-up Now" button
  - Follow-up attempt counter & next scheduled timing
- [x] Templates manager tab (`/templates`):
  - Rich template editor with variable pills (`{{recipientName}}`, `{{company}}`, `{{position}}`, etc.)
  - Set default template action
- [x] Settings tab (`/settings`):
  - Configurable intervals (first follow-up days, second follow-up days, max follow-ups)
  - Auto-tracking and auto-enable toggles with instant save feedback

---

## Phase 11: Reliability, Safety & Testing
- [x] Add "Draft First" mode (create Gmail draft instead of direct send for safety testing)
- [x] End-to-end integration and reliability verification test suite (`apps/api/test/e2e-simulation.ts`)
- [x] Idempotency tests (verify deterministic job IDs and deduplication)
- [x] Auto-responder and bounce resilience verification
- [x] Verify full monorepo build across shared, API, and web packages

---

## Phase 12: Production Deployment & Real-time Pub/Sub (Optional)
- [ ] Setup Google Cloud Pub/Sub push notifications for instant sent/received email detection
- [ ] Production build verification & deployment guide (Vercel + Railway/Render + Supabase/Neon)
