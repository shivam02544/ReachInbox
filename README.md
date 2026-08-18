# ReachInbox Email Scheduler

Production-grade full-stack email scheduling application inspired by ReachInbox.

---

## Architecture

The system utilizes a microservice-style containerized architecture orchestrated by Docker Compose:

```
Browser 
   │
   ▼ 
Next.js Frontend (Port 3000)
   │
   ▼ 
Express Backend API (Port 5000) ──► PostgreSQL (Port 5432 / Host 5433)
   │
   ├──► Redis (Port 6379)
   │      ▲
   │      │
BullMQ Queue (`email-queue`)
   │
   ▼
Worker Container (Separate Process, Same Codebase)
   │
   ├──► Atomic Redis Lua Rate Limiter (rateLimit.service.ts)
   │      ├── ratelimit:sender:{senderId}:last_slot ("token:nowMs")
   │      ├── ratelimit:sender:{senderId}:hour:{YYYYMMDDHH} (Count)
   │      └── ratelimit:sender:{senderId}:reservation:{token} ("token:nowMs:hourWindow")
   │
   ▼
Nodemailer Mail Service (src/services/mail.service.ts)
   │
   ▼
Ethereal SMTP Mailer (smtp.ethereal.email:587)
```

* **Process Separation**: Express API (`backend`) handles scheduling requests. Worker container (`worker`) consumes jobs and evaluates rate limits before SMTP delivery.
* **Docker Service Communication**: All internal container communication uses Docker DNS names (`postgres`, `redis`, `backend`).

---

## Technology Stack

* **Frontend**: Next.js (`14.2.24`), React (`18.3.1`), TypeScript, Tailwind CSS
* **Backend API**: Node.js (`v20`), Express.js (`4.21.1`), TypeScript
* **Database & ORM**: PostgreSQL (`16-alpine`), Prisma ORM (`5.22.0`)
* **Queue & Cache**: BullMQ (`5.21.2`), Redis (`7-alpine`), `ioredis` (`5.4.1`)
* **Email Delivery**: Nodemailer (`6.9.16`), Ethereal Email SMTP
* **Rate Limiting**: Distributed Atomic Redis Lua Scripts
* **Infrastructure**: Docker, Docker Compose

---

## Rate Limiting & Delivery Controls

1. **Configurable Minimum Inter-Send Delay (`MIN_EMAIL_DELAY_MS`)**:
   - Environment variable: `MIN_EMAIL_DELAY_MS` (default: `2000` ms).
   - Enforces a minimum gap between outbound send slots per sender across all concurrent workers.
2. **Configurable Hourly Rate Limit (`MAX_EMAILS_PER_HOUR_PER_SENDER`)**:
   - Environment variable: `MAX_EMAILS_PER_HOUR_PER_SENDER` (default: `200` emails/hour).
   - Enforces a maximum hourly quota of send slots per sender.
3. **Atomic Lua Reservation**:
   - Both constraints are evaluated atomically in Redis via `reserveSendSlot.lua`.
   - Generates a unique UUID `reservationToken` and token marker `ratelimit:sender:{senderId}:reservation:{token}` containing `"token:nowMs:hourWindow"`.
4. **Authoritative HourWindow & Token Rollback**:
   - If PostgreSQL atomic DB claim fails after reservation, `releaseReservationSlot.lua` validates token and hourWindow before releasing the hourly quota.
   - If a subsequent worker has reserved a newer slot, `last_slot` remains untouched while the failed worker's hourly quota is released cleanly.
5. **Rescheduling via BullMQ `moveToDelayed` + `DelayedError`**:
   - Rate-limited jobs call `await job.moveToDelayed(now + delay, job.token)` and `throw new DelayedError()`.
   - `Email.status` remains `SCHEDULED` in PostgreSQL.
   - `Email.attempts` is **NOT** incremented.
   - `BullMQ jobId = Email.id` is preserved intact.

---

## CSV Bulk Email Scheduling (Step 6)

1. **Multer 2.2.0 Memory Storage & CSV Parser**:
   - Pinned exact versions `"multer": "2.2.0"` (secure 2.x release) and `"csv-parse": "5.6.0"`.
   - `multer.memoryStorage()` buffers file in RAM (`req.file.buffer`) with hard 5 MB limit (`MAX_CSV_FILE_SIZE_MB=5`). Zero temporary disk files created.
   - Case-insensitive `email` header search and structural CSV parsing (`csv-parse/sync` with UTF-8 BOM, cell trimming, and unclosed quote error handling).

2. **Parsing & Preview Endpoint (`POST /api/emails/parse-csv`)**:
   - Protected by `requireAuth` middleware.
   - Returns structured preview JSON with numerical metrics (`totalRows`, `validRecipientsCount`, `invalidRecipientsCount`, `duplicateRecipientsCount`) and categorized email arrays before scheduling.

3. **User Senders Dropdown Endpoint (`GET /api/senders`)**:
   - Protected by `requireAuth`.
   - Queries `prisma.sender.findMany({ where: { userId: req.user.id } })` to populate dropdown options while strictly omitting SMTP passwords.

4. **Dashboard Bulk Campaign UI**:
   - Next.js App Router components (`CsvUploader`, `CsvPreview`, `BulkScheduleForm`).
   - Renders valid/invalid/duplicate recipient statistics and displays authoritative backend scheduling summaries.

---

## Authentication & Multi-User Data Isolation (Step 5)

1. **Express Backend Authoritative Auth Layer**:
   - Google OAuth 2.0 via Passport.js (`passport-google-oauth20`) on Express backend (`GET /api/auth/google`, `GET /api/auth/google/callback`).
   - CSRF State Protection enabled (`state: true`).
   - `GOOGLE_CLIENT_SECRET` and `SESSION_SECRET` remain strictly on backend and are never exposed to frontend or logs.

2. **Redis-Backed Server-Side Sessions**:
   - Sessions stored in Redis under `auth:session:{sessionId}` with configurable TTL (`SESSION_TTL_SECONDS`).
   - HTTP-only authentication cookie `reachinbox_sid` (`httpOnly: true`, `sameSite: 'lax'`).
   - Sessions persist across backend restarts and Redis container restarts via named Docker volume `redis_data`.

3. **User Creation & Sender Security**:
   - Uses existing Prisma `User`, `Sender`, and `Email` models with **zero schema changes**.
   - Auto-creates default Ethereal senders for new Google OAuth users so they can immediately schedule email campaigns.
   - Senders strictly belong to `userId`. SMTP passwords are never returned in API responses or logged.

4. **Multi-User Data Isolation**:
   - Express `requireAuth` middleware verifies `reachinbox_sid` cookie and attaches `req.user`.
   - `POST /api/emails/schedule`, `GET /api/emails/scheduled`, and `GET /api/emails/sent` require authentication.
   - Scheduling validates `senderId` belongs to `req.user.id` (returns HTTP 403 Forbidden if violated).
   - Queries strictly filter `where: { userId: req.user.id }`.

5. **Next.js Auth Foundation**:
   - `/login` page with Google OAuth button.
   - `/dashboard` verification page calling `GET /api/auth/me` (`credentials: "include"`), displaying user details and Logout button (`POST /api/auth/logout`).

## Dashboard Analytics & Campaign Management (Step 7)

1. **Live-on-Refresh Analytics Endpoint (`GET /api/emails/stats`)**:
   - Protected by `requireAuth` middleware.
   - Executes efficient Prisma database `groupBy` and `count` queries strictly scoped to `where: { userId: req.user.id }`.
   - Returns `{ scheduledCount, processingCount, sentCount, failedCount, totalCount, sendersCount }`.

2. **Option A API Contracts**:
   - `GET /api/emails/scheduled`: Returns `status = SCHEDULED` emails for authenticated user.
   - `GET /api/emails/sent`: Returns `status = SENT` emails for authenticated user (preserves existing API contract 100%).
   - `GET /api/emails/failed`: Returns `status = FAILED` emails for authenticated user.

3. **Dashboard Management UI & Tabbed Navigation**:
   - **Analytics Cards** (`AnalyticsCards.tsx`): Displays current live-on-refresh metrics cards (**Scheduled**, **Processing**, **Sent**, **Failed**, **Total Emails**, **Active Senders**) and manual **Refresh Analytics** button.
   - **Scheduled Emails Table** (`ScheduledTable.tsx`): User-focused table of pending emails with search filter and status badges.
   - **Sent & Failed History Table** (`SentTable.tsx`): Historical delivery table with Sent/Failed status filter tabs and search filter.
   - **Quick Single Compose Modal** (`QuickComposeModal.tsx`): Modal allowing quick scheduling of a single email directly from dashboard via `POST /api/emails/schedule`.

---

## Ethereal Email SMTP Setup

1. **Test Account Creation**: Ethereal test accounts generated via Nodemailer.
2. **Environment Variables** (`.env`):
   ```ini
   ETHEREAL_HOST=smtp.ethereal.email
   ETHEREAL_PORT=587
   ETHEREAL_USER=x6wf6elp3ert62r3@ethereal.email
   ETHEREAL_PASSWORD=jREstXBKhb1Rjw1txP
   ETHEREAL_SECURE=false
   ```
3. **Ethereal Preview URLs**: Logged in worker output: `[Ethereal Preview URL] https://ethereal.email/message/...`

---

## Development Seed Script

To seed development test records in Docker PostgreSQL:

```bash
npm run db:seed
```

---

## Current Implementation Status

**Status: Step 7 (Dashboard Scheduled/Sent Management, Analytics & Quick Compose UI) Complete**

* [x] Step 0: Docker architecture set up
* [x] Step 1A: PostgreSQL + Prisma schema (`User`, `Sender`, `Email`, `EmailStatus`) implemented
* [x] Step 1B: BullMQ queue (`5.21.2`) & worker process foundation running in Docker
* [x] Step 2: Email scheduling pipeline, SHA-256 idempotency, state machine transitions.
* [x] Step 3: Real Ethereal SMTP delivery via Nodemailer (`6.9.16`), sender-specific credentials, preview URLs.
* [x] Step 4: Distributed Redis Lua Rate Limiting, Minimum Inter-Send Delay, Authoritative Token Rollback, and BullMQ `DelayedError` rescheduling.
* [x] Step 5: Real Google OAuth 2.0, Redis-backed Session Storage, Express `requireAuth` Middleware, Multi-User Data Isolation, Next.js `/login` & `/dashboard` Auth Foundation.
* [x] Step 6: Memory-buffered Multer 2.2.0 & csv-parse 5.6.0 CSV Upload, Structural Header Validation, Recipient Sanitization & Preview, Campaign Setup UI, and Bulk Email Scheduling Pipeline.
* [x] Step 7: Live-on-Refresh Analytics (`GET /api/emails/stats`), Option A API Contracts (`/scheduled`, `/sent`, `/failed`), Scheduled/Sent Management Tables, Quick Compose Modal, and Dashboard Navigation UI.
