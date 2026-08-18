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
   ▼
Nodemailer Mail Service (src/services/mail.service.ts)
   │
   ▼
Ethereal SMTP Mailer (smtp.ethereal.email:587)
```

* **Process Separation**: The Express API server (`backend`) handles HTTP requests. A separate container (`worker`) runs independently to consume background jobs. Both share the backend codebase (`./backend`) but execute different startup scripts.
* **Docker Service Communication**: Internal container communication relies exclusively on Docker Compose DNS service names (`postgres`, `redis`, `backend`), avoiding `localhost` inside container networks.

---

## Technology Stack

* **Frontend**: Next.js (`14.2.24`), React (`18.3.1`), TypeScript, Tailwind CSS
* **Backend API**: Node.js (`v20`), Express.js (`4.21.1`), TypeScript
* **Database & ORM**: PostgreSQL (`16-alpine`), Prisma ORM (`5.22.0`)
* **Queue & Cache**: BullMQ (`5.21.2`), Redis (`7-alpine`), `ioredis` (`5.4.1`)
* **Email Delivery**: Nodemailer (`6.9.16`), Ethereal Email SMTP
* **Infrastructure**: Docker, Docker Compose

---

## Project Structure

```
reachinbox-assignment/
├── backend/
│   ├── src/
│   │   ├── config/          # Typed env validation, Prisma, & Redis clients
│   │   ├── middleware/      # Error & 404 handlers
│   │   ├── routes/          # API routes (email.routes.ts, health.ts)
│   │   ├── controllers/     # Email request controllers (email.controller.ts)
│   │   ├── services/        # Email batch scheduling (email.service.ts) & Nodemailer SMTP (mail.service.ts)
│   │   ├── queues/          # BullMQ queue producer (email.queue.ts) & worker (email.worker.ts)
│   │   ├── utils/           # Logger, SHA-256 idempotency, RFC 5322 email validator
│   │   ├── app.ts           # Express app setup
│   │   ├── server.ts        # API server startup
│   │   └── worker.ts        # Worker process startup & graceful shutdown
│   ├── prisma/
│   │   ├── schema.prisma    # PostgreSQL schema definition (User, Sender, Email)
│   │   ├── seed.ts          # Development database seed script
│   │   └── migrations/      # Versioned SQL migrations
│   ├── Dockerfile           # Multi-stage production build
│   ├── package.json
│   ├── tsconfig.json
│   └── .dockerignore
├── frontend/
│   ├── src/                 # Next.js App Router placeholder
│   ├── public/              # Static assets
│   ├── Dockerfile           # Standalone Next.js multi-stage build
│   ├── package.json
│   ├── tsconfig.json
│   └── .dockerignore
├── docker-compose.yml       # Orchestrates postgres, redis, backend, worker, frontend
├── .env.example             # Environment variable template
├── .gitignore
└── README.md
```

---

## Ethereal Email SMTP Setup

1. **Test Account Creation**: Ethereal test accounts can be generated via Nodemailer CLI (`node -e "require('nodemailer').createTestAccount().then(console.log)"`).
2. **Environment Variables** (`.env`):
   ```ini
   ETHEREAL_HOST=smtp.ethereal.email
   ETHEREAL_PORT=587
   ETHEREAL_USER=x6wf6elp3ert62r3@ethereal.email
   ETHEREAL_PASSWORD=jREstXBKhb1Rjw1txP
   ETHEREAL_SECURE=false
   ```
3. **Sender-Specific Credentials**: In PostgreSQL, every `Sender` record contains `smtpHost`, `smtpPort`, `smtpUser`, and `smtpPassword`. The worker dynamically constructs transport for each `Email.senderId`.
4. **Ethereal Preview URLs**: After successful SMTP delivery, Nodemailer generates a preview URL logged in worker output: `[Ethereal Preview URL] https://ethereal.email/message/...`

---

## Sender-Specific SMTP Architecture

```
Email.senderId
      │
      ▼
PostgreSQL Sender Record
      │
      ├──> smtpHost
      ├──> smtpPort
      ├──> smtpUser
      └──> smtpPassword
            │
            ▼
Nodemailer Transporter (src/services/mail.service.ts)
            │
            ▼
sendMail({ from: "${displayName} <${email}>", to, subject, text })
```

---

## Retry Semantics & Attempt Alignment

```
[ SCHEDULED ] ──(Worker Claims Job)──► [ PROCESSING ] ──(SMTP Send)──► [ SENT ]
      ▲                                       │
      │                             (Retryable Failure)
      └───────────────────────────────────────┤
                                              │
                                     (Final Attempt Exhausted)
                                              ▼
                                         [ FAILED ]
```

* **`EmailStatus` Enum**: Kept strictly as `SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`. `SCHEDULED` represents both initially scheduled emails and emails waiting for a BullMQ retry.
* **`scheduledAt` Preservation**: Original `scheduledAt` timestamp is preserved without alteration during retries.
* **Atomic `Email.attempts` Counter**: Incremented **exactly once** when transitioning from `SCHEDULED` to `PROCESSING`.
* **Explicit Final Attempt Calculation**:
  ```typescript
  const currentAttempt = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts ?? 1;
  const isFinalAttempt = currentAttempt >= maxAttempts;
  ```
  * **Retryable Failure (`!isFinalAttempt`)**: Status reset to `SCHEDULED`, error logged, re-thrown for BullMQ backoff.
  * **Final Failure (`isFinalAttempt`)**: Status updated to `FAILED` with sanitized `errorMessage`. `Email.attempts` equals 3.

---

## Distributed System Architectural Trade-Offs

> [!IMPORTANT]
> **SMTP + PostgreSQL Failure Window**:
> Ethereal SMTP and PostgreSQL are separate distributed systems and do not share a single ACID transaction.
>
> 1. **PostgreSQL Is Authoritative State**: `Email.status` tracks execution status.
> 2. **Post-Send State Window**: If the SMTP server accepts the message (`250 Accepted`) but updating PostgreSQL to `SENT` fails, a duplicate send could theoretically occur on retry.
> 3. **Idempotency Safeguard**: Before invoking Nodemailer, the worker checks `if (emailRecord.status === EmailStatus.SENT)`. If already `SENT`, it skips the SMTP send cleanly.

---

## Development Seed Script

To seed development test records in Docker PostgreSQL:

```bash
npm run db:seed
```

* **Seeded Records**:
  * **User ID**: `46130fb6-0aa8-4bbb-88d9-a8d013c8a002` (`dev@example.com`)
  * **Sender A ID**: `23f65fec-0e66-4496-ba40-600ac1053df1` (`senderA@example.com`)
  * **Sender B ID**: `e09936ed-e165-44c3-82c4-b50738c9fab9` (`senderB@example.com`)
  * **Invalid Sender ID**: `62be7557-8125-4c5c-9067-bbcbe67716c6` (`invalid_smtp@example.com`)

---

## API Documentation

### 1. Schedule Email Batch
* **Method**: `POST /api/emails/schedule`
* **Content-Type**: `application/json`
* **Request Body**:
  ```json
  {
    "senderId": "23f65fec-0e66-4496-ba40-600ac1053df1",
    "subject": "Weekly Update",
    "body": "Hello from ReachInbox email scheduler!",
    "startTime": "2026-08-18T10:00:00.000Z",
    "delayMs": 2000,
    "recipients": ["alice@example.com"]
  }
  ```

### 2. List Scheduled Emails
* **Method**: `GET /api/emails/scheduled`

### 3. List Sent Emails
* **Method**: `GET /api/emails/sent`

---

## Current Implementation Status

**Status: Step 3 (Ethereal SMTP Integration & Retry Correctness) Complete**

* [x] Step 0: Project repository structure & Docker architecture set up
* [x] Step 1A: PostgreSQL + Prisma database schema (`User`, `Sender`, `Email`, `EmailStatus`) implemented
* [x] Step 1B: BullMQ queue (`5.21.2`) & worker process foundation running in Docker
* [x] Step 2: Email scheduling pipeline, SHA-256 idempotency, state machine transitions, atomic attempts counter.
* [x] Step 3: Real Ethereal SMTP delivery via Nodemailer (`6.9.16`), sender-specific credentials, Ethereal preview URLs, explicit retry attempt calculation, and secret-leak verification.
* [ ] Step 4: Rate limiting & minimum delay controls *(Future step)*
* [ ] Step 5: Google OAuth & authentication *(Future step)*
* [ ] Step 6: Dashboard UI & Figma design implementation *(Future step)*

---

## Figma Visual Design Rule

> [!IMPORTANT]
> The provided Figma design is the **absolute source of truth** for all visual and frontend implementations in subsequent steps. Future frontend work must inspect and reproduce the Figma layout, spacing, typography, colors, components, tables, modal behavior, and responsive structure as closely as practical.
>
> **Figma Reference**: [ReachInbox Outbox Labs Figma Design](https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f)
