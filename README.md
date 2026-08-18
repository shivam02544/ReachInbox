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

**Status: Step 4 (Distributed Rate Limiting + Minimum Delay + Concurrency Safety) Complete**

* [x] Step 0: Docker architecture set up
* [x] Step 1A: PostgreSQL + Prisma schema (`User`, `Sender`, `Email`, `EmailStatus`) implemented
* [x] Step 1B: BullMQ queue (`5.21.2`) & worker process foundation running in Docker
* [x] Step 2: Email scheduling pipeline, SHA-256 idempotency, state machine transitions.
* [x] Step 3: Real Ethereal SMTP delivery via Nodemailer (`6.9.16`), sender-specific credentials, preview URLs.
* [x] Step 4: Distributed Redis Lua Rate Limiting, Minimum Inter-Send Delay, Authoritative Token Rollback, and BullMQ `DelayedError` rescheduling.
* [ ] Step 5: Google OAuth & authentication *(Future step)*
* [ ] Step 6: Dashboard UI & Figma design implementation *(Future step)*
