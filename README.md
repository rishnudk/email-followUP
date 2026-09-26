# 📬 Auto Email Follow-Up System

An intelligent, full-stack email follow-up automation platform that seamlessly integrates with Gmail. It monitors your sent emails, schedules multi-step follow-ups using Redis and BullMQ, intelligently detects replies, bounces, and out-of-office auto-responders to prevent redundant emails, and provides a sleek modern dashboard to manage everything.

---

## ✨ Features

- **🔄 Automated Gmail Sent-Email Sync**: Continuously polls sent messages with automatic thread deduplication and RFC 2822 header extraction (`Message-ID`, `In-Reply-To`, `References`).
- **⚡ Resilient BullMQ Job Scheduling**: Deterministic delayed queues (`followup:<threadId>:<attempt>`) with customizable delays and intelligent business-hours/weekday scheduling.
- **🛡️ Smart Reply & Bounce Detection**:
  - Live Gmail thread inspection prior to dispatch.
  - Distinguishes real human replies from out-of-office auto-replies (`Auto-Submitted: auto-replied`, `X-Autoreply: yes`).
  - Detects mail delivery failures (`mailer-daemon`, `postmaster`) and automatically halts scheduled follow-ups.
- **📝 Dynamic Template Engine**: Rich template variables like `{{recipientName}}`, `{{senderName}}`, `{{originalSubject}}`, `{{company}}`, and `{{position}}`.
- **🔐 Bank-Grade Token Security**: AES-256 encryption at rest for stored Google OAuth refresh tokens with automatic token rotation.
- **🛡️ Safety & "Draft First" Mode**: Safe staging option to generate Gmail drafts for inspection before live-sending emails.
- **📊 Modern Web Dashboard**: Next.js App Router frontend with real-time stats, conversation drawer timeline, manual "Send Now" overrides, and template editor.

---

## 🛠️ Tech Stack & Monorepo Architecture

```
email-followup/
├── apps/
│   ├── api/                 # Fastify REST API, BullMQ Workers, Prisma ORM, Gmail Service
│   └── web/                 # Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide
├── packages/
│   └── shared/              # Shared TypeScript types, interfaces, and DTO contracts
├── docker-compose.yml       # PostgreSQL 16 & Redis 7 with AOF persistence
└── package.json             # Root npm workspaces configuration
```

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, Lucide React
- **Backend**: Fastify 5, TypeScript, TSX
- **Database & Queue**: PostgreSQL 16, Prisma ORM 6, Redis 7, BullMQ 5
- **Authentication & APIs**: Google OAuth 2.0, Gmail REST API (`googleapis`)
- **Security**: AES-256 encryption (`crypto`), HTTP-only signed session cookies

---

## 📋 Prerequisites

Before running the application, make sure you have:

1. **Node.js** (v20.x or higher) & **npm** (v10.x or higher)
2. **Docker Desktop** (for running PostgreSQL and Redis)
3. **Google Cloud Project** with:
   - Gmail API enabled
   - OAuth 2.0 Credentials (Client ID & Client Secret)
   - Authorized redirect URI: `http://localhost:4000/auth/google/callback`

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (you can copy [.env.example](file:///.env.example)):

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `POSTGRES_USER` | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `postgres` |
| `POSTGRES_DB` | PostgreSQL database name | `email_followup` |
| `DATABASE_URL` | Prisma connection string | `postgresql://postgres:postgres@localhost:5432/email_followup?schema=public` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | API Server port | `4000` |
| `API_URL` | Base API URL | `http://localhost:4000` |
| `NEXT_PUBLIC_API_URL` | API URL exposed to frontend | `http://localhost:4000` |
| `WEB_URL` | Frontend URL | `http://localhost:3000` |
| `ENCRYPTION_KEY` | 32-character AES-256 secret key | `0123456789abcdef0123456789abcdef` |
| `SESSION_SECRET` | Secret for signed cookies (>= 32 chars) | `super-secret-session-cookie-secret-key-at-least-32-chars` |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth Client ID | `your-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth Client Secret | `your-google-client-secret` |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL | `http://localhost:4000/auth/google/callback` |

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
Run from the root directory:
```bash
npm install
```

### 2. Start PostgreSQL & Redis
Spin up the database and Redis cache with Docker:
```bash
npm run docker:up
# Or: docker compose up -d
```

### 3. Generate Prisma Client & Run Migrations
Initialize the PostgreSQL schema and Prisma client:
```bash
npm run db:generate
npm run db:migrate
```

*(Optional: Run `npm run --workspace=@email-followup/api db:seed` to seed sample follow-up templates)*

### 4. Build the Shared Workspace Package
Compile `@email-followup/shared` so the API and Web apps can import the shared types:
```bash
npm run build --workspace=@email-followup/shared
```

### 5. Start the Development Servers

For the best developer experience with clean logs and independent restarts, run the backend and frontend in **two separate terminal windows**:

#### Terminal 1 — Backend API & Queue Worker:
```bash
npm run dev:api
```
> Starts Fastify on **`http://localhost:4000`**, boots the BullMQ worker, and starts the 5-minute Gmail sync interval.

#### Terminal 2 — Frontend Web Dashboard:
```bash
npm run dev:web
```
> Starts Next.js on **`http://localhost:3000`**.

---

*(Alternative)* **Run everything concurrently in a single terminal:**
```bash
npm run dev
```

---

## 📜 Available NPM Scripts

All commands can be run directly from the workspace root:

| Command | Action |
| :--- | :--- |
| `npm run dev:api` | Starts backend Fastify server + BullMQ background worker |
| `npm run dev:web` | Starts Next.js frontend development server |
| `npm run dev` | Runs both API and Web concurrently via workspaces |
| `npm run build` | Builds all packages and applications |
| `npm run docker:up` | Starts PostgreSQL and Redis containers |
| `npm run docker:down` | Stops PostgreSQL and Redis containers |
| `npm run db:generate` | Regenerates Prisma Client based on schema |
| `npm run db:migrate` | Applies Prisma migrations in development mode |
| `npm run db:studio` | Opens Prisma Studio web UI for browsing database rows |

---

## 📡 API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check endpoint |
| `GET` | `/auth/google` | Initiates Google OAuth consent screen |
| `GET` | `/auth/google/callback` | OAuth code exchange & user creation |
| `GET` | `/auth/me` | Returns current authenticated user |
| `POST` | `/auth/logout` | Clears authentication session cookie |
| `GET` | `/emails` | Lists tracked email threads (supports filtering & pagination) |
| `GET` | `/emails/:id` | Returns thread timeline, messages, and follow-ups |
| `POST` | `/emails/sync` | Manually triggers sent email sync from Gmail |
| `POST` | `/emails/:id/enable` | Enables automation & schedules follow-up |
| `POST` | `/emails/:id/disable` | Pauses automation & cancels scheduled jobs |
| `POST` | `/emails/:id/stop` | Permanently stops tracking thread |
| `GET` | `/followups/upcoming` | Lists pending scheduled follow-ups |
| `POST` | `/followups/:threadId/send-now` | Immediately triggers follow-up for a thread |
| `GET` | `/templates` | Lists follow-up email templates |
| `POST` | `/templates` | Creates a new email template |
| `PATCH` | `/templates/:id` | Updates an email template |
| `DELETE` | `/templates/:id` | Deletes a template |
| `POST` | `/templates/:id/set-default` | Marks template as default |
| `GET` | `/settings` | Fetches user settings (delays, auto-enable, max follow-ups) |
| `PATCH` | `/settings` | Updates user automation settings |
| `GET` | `/dashboard/stats` | Returns aggregate metrics for the dashboard |

---

## 🔒 Security & Privacy

- **Minimal Scopes**: Requests only `gmail.readonly`, `gmail.send`, and `gmail.compose` for necessary operations.
- **Encrypted Credentials**: Stored OAuth refresh tokens are encrypted using **AES-256-CBC/GCM** via the configured `ENCRYPTION_KEY`.
- **Signed Session Cookies**: User sessions are securely stored in HTTP-only signed cookies.
