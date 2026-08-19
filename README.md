# ReachInbox Email Scheduler

A high-performance, fault-tolerant, multi-tenant email scheduling and bulk outreach platform built with **Node.js, Express, TypeScript, Next.js, PostgreSQL, Prisma, BullMQ, Redis, and Nodemailer**.

ReachInbox provides delayed email delivery, distributed rate limiting per sender, minimum inter-send delay enforcement, SHA-256 idempotency safeguards, CSV upload parsing with recipient validation, Google OAuth 2.0 authentication, Redis server-side session management, and a clean, Figma-designed email-client interface.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Email Scheduling Flow](#email-scheduling-flow)
- [Email State Machine](#email-state-machine)
- [Rate Limiting & Concurrency](#rate-limiting--concurrency)
- [Idempotency](#idempotency)
- [Retry System](#retry-system)
- [Authentication & Security](#authentication--security)
- [CSV Bulk Scheduling](#csv-bulk-scheduling)
- [API Reference](#api-reference)
- [Frontend UI & Figma Alignment](#frontend-ui--figma-alignment)
- [Environment Variables](#environment-variables)
- [Docker Infrastructure & Setup](#docker-infrastructure--setup)
- [Development & Verification](#development--verification)

---

## Overview

### What is ReachInbox Email Scheduler?
ReachInbox Email Scheduler is an enterprise-grade platform designed to solve the complexities of automated cold email outreach, delayed notification dispatching, and rate-regulated transactional emailing.

### The Problem It Solves
1. **Sender Reputation Protection**: High-volume burst sending causes email service providers (Gmail, Outlook) to block sender domains or mark emails as spam. ReachInbox regulates dispatch rates via distributed Redis Lua rate limiters that enforce minimum inter-send delays (e.g., 2000ms between consecutive emails) and hourly sender quotas (e.g., 100 emails/hour/sender).
2. **At-Least-Once Delivery & Idempotency**: In distributed scheduling, duplicate network submissions or queue re-deliveries can cause duplicate emails to be sent to recipients. ReachInbox canonicalizes every email request into a deterministic SHA-256 idempotency key backed by PostgreSQL unique constraints.
3. **Multi-Tenant Isolation**: Built with Google OAuth 2.0 and Redis-backed session storage (`auth:session:{sessionId}`), ReachInbox ensures complete data isolation where every user accesses only their own senders, scheduled jobs, sent logs, and failure reports.
4. **CSV Bulk Campaign Parsing**: Uploading large recipient lists requires parsing, header detection, email format validation (RFC 5322), in-file duplicate detection, and payload sanitization before scheduling jobs in BullMQ.

---

## Features

- **Google OAuth 2.0 Authentication**: Seamless authentication using Passport.js with server-side session persistence.
- **Redis Server-Side Session Storage**: Secure HTTP-only cookies (`reachinbox_sid`) mapping to Redis session keys (`auth:session:{sessionId}`) with configurable TTL (default 24 hours).
- **Multi-Tenant Data Isolation**: Strict database and API scoping using `req.user.id` on PostgreSQL queries.
- **PostgreSQL & Prisma ORM**: Relational schema managing `User`, `Sender`, `Email`, and lifecycle `EmailStatus` (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`).
- **BullMQ Delayed Queue Foundation**: Asynchronous Redis-backed job queue for scheduling emails at precise future timestamps (`jobId = Email.id`).
- **Distributed Redis Lua Rate Limiting**: Atomic slot reservation enforcing minimum inter-send delays (`MIN_EMAIL_DELAY_MS`) and hourly sender limits (`MAX_EMAILS_PER_HOUR_PER_SENDER`).
- **BullMQ `DelayedError` Rescheduling**: Non-blocking worker behavior that returns rate-limited jobs back to the BullMQ delayed set without incrementing attempt counters.
- **SHA-256 Idempotency Key Pipeline**: Deterministic hashing of request payloads preventing duplicate scheduling across API retries and concurrent requests.
- **Sender-Specific SMTP Delivery**: Real Nodemailer Ethereal SMTP delivery configured with per-sender credentials.
- **Ethereal Preview URL Logging**: Live preview URL generation logged for manual delivery verification.
- **Exponential Backoff Retries**: 3-attempt automated retries with exponential backoff on transient SMTP failures.
- **CSV Bulk Email Upload**: Pinned Multer 2.2.0 memory storage buffering with `csv-parse` sync parsing, case-insensitive `email` header detection, UTF-8 BOM handling, cell trimming, and empty line filtering.
- **CSV Validation & Deduplication**: Real-time identification of valid, invalid, and duplicate recipient email addresses with a hard 5 MB file size limit and 1000 recipient limit per request.
- **Scheduled & Sent Management**: Real-time filters and tabular views for inspecting pending scheduled jobs, sent delivery logs, and sanitized failure messages.
- **Dashboard Analytics**: Protected `GET /api/emails/stats` aggregate metrics endpoint (`scheduledCount`, `processingCount`, `sentCount`, `failedCount`, `totalCount`, `sendersCount`).
- **Figma-Aligned Email-Client Interface**: Clean 1440x900 desktop email-client UI featuring a pure white canvas (`#FFFFFF`), dark OMB brand logo, green accent system (`#22C55E`), narrow sidebar, compact email rows, full composer view, recipient chips, and an anchored Send Later popover.
- **Dockerized 5-Service Topology**: Docker Compose orchestration for `postgres`, `redis`, `backend`, `worker`, and `frontend` with container health checks.

---

## Architecture

ReachInbox follows a microservices-capable, 5-tier architecture orchestrated via Docker Compose:

```mermaid
flowchart TD
    subgraph Client ["Client Tier - Port 3000"]
        UI["Next.js 14 Figma Email Client - Pure White Canvas"]
    end

    subgraph API ["Application Tier - Port 5000"]
        Express["Express.js Server"]
        AuthMiddleware["requireAuth Middleware"]
        GoogleOAuth["Passport.js Google OAuth 2.0"]
        CSVParser["Multer and csv-parse Pipeline"]
    end

    subgraph Storage ["Storage and Queue Tier"]
        RedisSession[("Redis Server - Sessions and Rate Limits - Port 6379")]
        PostgresDB[("PostgreSQL 16 - Prisma ORM - Port 5433:5432")]
        BullQueue["BullMQ Delayed Queue - email-queue"]
    end

    subgraph AsyncWorker ["Asynchronous Worker Tier"]
        Worker["BullMQ Email Worker Process - Concurrency 5"]
        LuaLimiter["Redis Lua Rate Limiter - reserveSendSlot / releaseReservationSlot"]
        Mailer["Nodemailer Engine"]
    end

    subgraph External ["External Services"]
        GoogleAPI["Google OAuth 2.0 Provider"]
        EtherealSMTP["Ethereal SMTP Server - smtp.ethereal.email:587"]
    end

    UI <-->|HTTP and Credentials| Express
    Express <--> AuthMiddleware
    AuthMiddleware <-->|Read and Write Sessions| RedisSession
    Express <-->|Authenticate| GoogleAPI
    Express <-->|CRUD Email and Sender Records| PostgresDB
    Express -->|Enqueue Jobs - jobId equals Email.id| BullQueue
    BullQueue <-->|Store Jobs and Delays| RedisSession
    Worker <-->|Pop Jobs| BullQueue
    Worker <-->|Execute Atomic Reserve or Rollback| LuaLimiter
    LuaLimiter <--> RedisSession
    Worker <-->|Read Email and Update Status| PostgresDB
    Worker -->|Deliver Emails via SMTP| Mailer
    Mailer -->|Send Mail| EtherealSMTP
```

### Component Responsibilities

1. **Next.js Frontend (`frontend`)**: Serves the Figma-designed desktop email client UI. Communicates with the Express API using credentialed CORS requests (`credentials: 'include'`).
2. **Express Backend API (`backend`)**: Handles user authentication, session validation, sender querying, CSV parsing, idempotency checking, database record creation, and BullMQ job enqueuing.
3. **PostgreSQL Database (`postgres`)**: Acts as the authoritative source of truth for user identities, sender credentials, scheduled emails, status state transitions, and idempotency key constraints.
4. **Redis Cache & Queue Store (`redis`)**: Stores active session metadata (`auth:session:{sessionId}`), BullMQ delayed queue structures, and distributed rate limiting keys (`ratelimit:sender:{id}:last_slot` and `ratelimit:sender:{id}:hour:{window}`).
5. **BullMQ Email Worker (`worker`)**: Independent, non-blocking worker process running with configurable concurrency (`WORKER_CONCURRENCY`). Claims jobs, executes Redis Lua rate-limiting checks, updates PostgreSQL states, and sends emails via Nodemailer.
6. **Ethereal SMTP Server**: External mock SMTP service providing instant email receipt validation and loggable preview URLs.

---

## Email Scheduling Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User or Browser
    participant API as Express API
    participant DB as PostgreSQL Prisma
    participant Queue as BullMQ Redis
    participant Worker as Email Worker
    participant RateLimiter as Redis Lua Limiter
    participant SMTP as Ethereal SMTP

    User->>API: Authenticate via Google OAuth and Establish Session
    User->>API: Open Compose and Upload CSV or Select Sender and Recipients
    API->>API: Parse CSV, Validate RFC 5322 Emails and Filter Duplicates
    User->>API: Submit Campaign to POST api/emails/schedule
    loop For Each Recipient
        API->>API: Compute SHA-256 Idempotency Key
        API->>DB: Insert Email Record with status SCHEDULED
        alt Duplicate Idempotency Key Exists P2002
            API-->>API: Increment alreadyExistsCount and Skip
        else New Email Record Created
            API->>Queue: Enqueue BullMQ Delayed Job with jobId equals Email.id
            API->>DB: Update Email.bullJobId
        end
    end
    API-->>User: Return Schedule Summary Result

    Note over Queue, Worker: Time Reaches Scheduled Timestamp
    Queue->>Worker: Worker Claims Job with emailId
    Worker->>DB: Fetch Email and Sender Details
    Worker->>RateLimiter: Execute reserveSendSlot for senderId
    alt Rate Limit Exceeded or Inter-Send Delay Throttled
        RateLimiter-->>Worker: Allowed equals false with rescheduleDelayMs
        Worker->>Queue: Move Job to Delayed Set via moveToDelayed and Throw DelayedError
        Note over Worker: Status Remains SCHEDULED, Attempts NOT Incremented
    else Rate Limit Slot Granted
        RateLimiter-->>Worker: Allowed equals true with reservationToken
        Worker->>DB: Atomic Claim SCHEDULED to PROCESSING and Increment Attempts
        Worker->>SMTP: Send Mail via Nodemailer
        alt SMTP Delivery Success
            SMTP-->>Worker: 250 Accepted with messageId and previewUrl
            Worker->>DB: Update State from PROCESSING to SENT with sentAt
        else SMTP Delivery Failed Transient
            SMTP-->>Worker: Error Response
            alt Attempts Less Than Max Attempts 3
                Worker->>DB: Reset State from PROCESSING to SCHEDULED
                Worker-->>Queue: Re-throw Error for BullMQ Exponential Backoff
            else Final Attempt Failed
                Worker->>DB: Update State from PROCESSING to FAILED with errorMessage
            end
        end
    end
    Worker->>User: Dashboard Reflects Updated State SCHEDULED or SENT or FAILED
```

---

## Email State Machine

The lifecycle of an email in ReachInbox is governed by a strict PostgreSQL state machine (`EmailStatus` enum):

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED: Campaign Created or Enqueued
    
    state RateLimitCheck <<choice>>
    SCHEDULED --> RateLimitCheck: Worker Claims Job
    
    RateLimitCheck --> SCHEDULED: Rate Limited and Rescheduled via DelayedError
    RateLimitCheck --> PROCESSING: Slot Reserved via Atomic DB Claim
    
    state DeliveryCheck <<choice>>
    PROCESSING --> DeliveryCheck: Nodemailer SMTP Dispatch
    
    DeliveryCheck --> SENT: 250 Accepted Success
    DeliveryCheck --> SCHEDULED: Transient Failure on Attempt 1 or 2
    DeliveryCheck --> FAILED: Final Attempt 3 Failed
    
    SENT --> [*]
    FAILED --> [*]
```

### Rate-Limit Rescheduling vs. SMTP Retry Semantics

| Property | Rate-Limit Delay (`DelayedError`) | SMTP Delivery Retry |
| :--- | :--- | :--- |
| **Trigger Cause** | Sender minimum delay (<2000ms) or hourly quota hit | SMTP network timeout, connection drop, 5xx server rejection |
| **PostgreSQL State** | Remains **`SCHEDULED`** | Reset from `PROCESSING` back to **`SCHEDULED`** |
| **Attempt Counter** | **NOT incremented** (`attempts` stays unchanged) | **Incremented by 1** (`attempts: { increment: 1 }`) |
| **BullMQ Mechanism** | `job.moveToDelayed(now + delay, token)` | `throw err` triggers BullMQ exponential backoff |
| **Log Classification** | `[RateLimit Rescheduled]` | `[Retry Scheduled]` or `[Retries Exhausted]` |

---

## Rate Limiting & Concurrency

ReachInbox enforces two strict distributed constraints per sender using atomic Redis Lua scripts (`reserveSendSlot.lua` and `releaseReservationSlot.lua`):

1. **Minimum Inter-Send Delay (`MIN_EMAIL_DELAY_MS`)**: Default **2000ms** between consecutive emails for the same sender.
2. **Hourly Quota (`MAX_EMAILS_PER_HOUR_PER_SENDER`)**: Default **100 emails/hour** per sender.

### Atomic Redis Lua Slot Reservation (`reserveSendSlot`)

```lua
-- Keys: 1: last_slot, 2: hour_key, 3: marker_key
-- Arguments: 1: nowMs, 2: minDelayMs, 3: maxHourlyLimit, 4: nextHourWindowMs, 5: token, 6: hourWindow

local lastSlotData = redis.call('GET', KEYS[1])
local hourlyCount = tonumber(redis.call('GET', KEYS[2]) or '0')

-- 1. Enforce Hourly Sender Quota
if hourlyCount >= maxHourlyLimit then
    local waitMs = nextHourWindowMs - nowMs
    if waitMs < 1000 then waitMs = 1000 end
    return {0, waitMs, 1, ""}
end

-- 2. Enforce Minimum Inter-Send Delay
local elapsedMs = nowMs - lastSlot
if lastSlot > 0 and elapsedMs < minDelayMs then
    local waitMs = minDelayMs - elapsedMs
    return {0, waitMs, 2, ""}
end

-- 3. Reserve Slot Atomically
redis.call('SET', KEYS[1], token .. ":" .. tostring(nowMs), 'PX', math.max(minDelayMs * 2, 10000))
redis.call('INCR', KEYS[2])
redis.call('SET', KEYS[3], token .. ":" .. tostring(nowMs) .. ":" .. hourWindow, 'EX', 60)

return {1, 0, 0, token}
```

### Authoritative Rollback Handling (`releaseReservationSlot`)
If a worker successfully reserves a Redis slot but fails to claim the email in PostgreSQL (e.g., race condition where another worker claimed it or status changed to `SENT`), the worker executes an authoritative Lua rollback script (`releaseReservationSlot.lua`) that verifies reservation token ownership before decrementing the hourly counter and clearing the slot.

### Distributed Transaction Limitation Disclaimer
> **Technical Transparency**: In distributed systems without two-phase commit (2PC) or Saga orchestrators across SMTP and relational databases, if Nodemailer successfully sends an email via SMTP (250 OK) but the database connection crashes before `Email.status` is updated to `SENT`, the job may be re-run by BullMQ. ReachInbox mitigates this using pre-send database idempotency guards (`emailRecord.status === EmailStatus.SENT`), but hard cross-network atomic guarantees between third-party SMTP servers and PostgreSQL cannot be guaranteed without distributed transactions.

---

## Idempotency

ReachInbox canonicalizes every scheduling request into a deterministic SHA-256 hash stored in `Email.idempotencyKey`:

### Canonical String Format
```text
senderId|normalizedRecipient|trimmedSubject|trimmedBody|ISO8601ScheduledAt
```

### Hash Generation Implementation
```typescript
export function generateIdempotencyKey(
  senderId: string,
  recipient: string,
  subject: string,
  body: string,
  scheduledAt: Date
): string {
  const normalizedRecipient = recipient.trim().toLowerCase();
  const normalizedSubject = subject.trim();
  const normalizedBody = body.trim();
  const normalizedScheduledAt = scheduledAt.toISOString();

  const rawKeyString = `${senderId}|${normalizedRecipient}|${normalizedSubject}|${normalizedBody}|${normalizedScheduledAt}`;
  return crypto.createHash('sha256').update(rawKeyString, 'utf8').digest('hex');
}
```

### Database Race-Condition Safeguard
PostgreSQL enforces a `@unique` index on `Email.idempotencyKey`. If concurrent API requests attempt to schedule the same email payload, Prisma throws a `P2002` unique constraint violation. ReachInbox catches `P2002` cleanly, increments `skippedDuplicates`, and returns a structured response (`alreadyExistsCount`) without crashing the request.

---

## Retry System

ReachInbox combines BullMQ job retries with PostgreSQL state updates to deliver resilient error handling:

1. **Max Attempts**: Configured for **3 attempts** per job.
2. **Backoff Strategy**: Exponential backoff starting at **1000ms** (`delay: 1000`, `type: 'exponential'`).
3. **Atomic Attempt Increment**: Executed in PostgreSQL when transitioning from `SCHEDULED` to `PROCESSING`:
   ```typescript
   await prisma.email.updateMany({
     where: { id: emailId, status: EmailStatus.SCHEDULED },
     data: { status: EmailStatus.PROCESSING, attempts: { increment: 1 } }
   });
   ```
4. **Retryable vs. Permanent Failure**:
   - On transient SMTP failure (Attempts 1–2): Status is reset to `SCHEDULED`, error message logged, and exception re-thrown for BullMQ backoff.
   - On final failure (Attempt 3): Status transitions permanently to `FAILED` with sanitized error string recorded in `Email.errorMessage`.

---

## Authentication & Security

### Google OAuth 2.0
Authenticated using Passport.js (`passport-google-oauth20`):
- Initiated via `GET /api/auth/google`.
- Callback handled at `GET /api/auth/google/callback`.
- Creates or updates PostgreSQL `User` record (`googleId`, `email`, `name`, `avatarUrl`).

### Session Architecture
- **Session Keys**: Stored in Redis as `auth:session:{sessionId}` with a 24-hour TTL (`SESSION_TTL_SECONDS = 86400`).
- **HTTP-Only Cookie**: `reachinbox_sid` containing the session UUID.
- **Cookie Security**: Configured with `httpOnly: true`, `sameSite: 'lax'`, and `path: '/'`.

### Multi-Tenant Data Isolation
The Express `requireAuth` middleware verifies `reachinbox_sid`, retrieves session metadata from Redis, and attaches `req.user` to incoming requests. All Prisma queries explicitly filter by `userId: req.user.id`, preventing cross-user data leaks.

### Secret Protection
- Google OAuth Client Secret and SMTP passwords remain strictly server-side.
- The `GET /api/senders` endpoint explicitly omits `smtpPassword` (`select: { id, email, displayName, createdAt }`).

---

## CSV Bulk Scheduling

ReachInbox provides end-to-end bulk email onboarding via CSV file upload:

### Specifications & Rules
- **Memory Storage**: Buffered in RAM using Multer (`multer.memoryStorage()`) with a **hard 5 MB file size limit**. No temporary disk files are created.
- **Parsing Engine**: `csv-parse/sync` with `bom: true`, `trim: true`, and `skip_empty_lines: true`.
- **Header Detection**: Case-insensitive matching for the `email` header (e.g., `Email`, `EMAIL`, `email`).
- **Recipient Limit**: Configurable maximum limit of **1000 recipients** per request (`MAX_RECIPIENTS_PER_REQUEST`).

### Example Valid CSV Format
```csv
email,name
alice@example.com,Alice
bob@example.com,Bob
charlie@example.com,Charlie
```

---

## API Reference

### 1. Authentication Endpoints

#### `GET /api/auth/google`
Initiates Google OAuth 2.0 authentication flow.

#### `GET /api/auth/google/callback`
Google OAuth callback endpoint. Redirects to `http://localhost:3000/dashboard` on success.

#### `GET /api/auth/me`
Returns active session profile.
- **Response (200 OK)**:
  ```json
  {
    "authenticated": true,
    "user": {
      "id": "u-12345",
      "googleId": "google-109",
      "email": "user@example.com",
      "name": "Jane Doe",
      "avatarUrl": "https://lh3.googleusercontent.com/a/default-avatar"
    }
  }
  ```

#### `POST /api/auth/logout`
Destroys Redis session and clears HTTP-only `reachinbox_sid` cookie.

---

### 2. Email & Sender Management Endpoints

#### `GET /api/senders`
Returns senders owned by authenticated user.
- **Response (200 OK)**:
  ```json
  {
    "senders": [
      {
        "id": "s-9988",
        "email": "sender@example.com",
        "displayName": "Marketing Desk",
        "createdAt": "2026-08-18T10:00:00.000Z"
      }
    ]
  }
  ```

#### `POST /api/emails/parse-csv`
Parses uploaded CSV file and returns recipient analysis.
- **Content-Type**: `multipart/form-data` (field `file`)
- **Response (200 OK)**:
  ```json
  {
    "filename": "contacts.csv",
    "summary": {
      "totalRows": 4,
      "validRecipientsCount": 2,
      "invalidRecipientsCount": 1,
      "duplicateRecipientsCount": 1,
      "skippedRowsCount": 1
    },
    "validRecipients": ["alice@example.com", "bob@example.com"],
    "invalidRecipients": ["invalid-email"],
    "duplicateRecipients": ["alice@example.com"]
  }
  ```

#### `POST /api/emails/schedule`
Schedules single or bulk emails.
- **Payload**:
  ```json
  {
    "senderId": "s-9988",
    "subject": "Q3 Product Announcement",
    "body": "Hello, check out our latest updates!",
    "startTime": "2026-08-19T10:00:00.000Z",
    "delayMs": 2000,
    "recipients": ["alice@example.com", "bob@example.com"]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Email batch scheduling completed",
    "summary": {
      "totalRequested": 2,
      "scheduledCount": 2,
      "alreadyExistsCount": 0,
      "invalidRecipientsCount": 0,
      "failedEnqueueCount": 0
    },
    "scheduledEmails": [
      {
        "id": "e-101",
        "recipient": "alice@example.com",
        "scheduledAt": "2026-08-19T10:00:00.000Z",
        "status": "SCHEDULED"
      }
    ],
    "skippedDuplicates": [],
    "invalidRecipients": [],
    "partialFailures": []
  }
  ```

#### `GET /api/emails/scheduled`
Returns scheduled emails (`status = SCHEDULED`).

#### `GET /api/emails/sent`
Returns delivered emails (`status = SENT`).

#### `GET /api/emails/failed`
Returns failed email history (`status = FAILED`).

#### `GET /api/emails/stats`
Returns aggregated metrics strictly scoped to authenticated user.
- **Response (200 OK)**:
  ```json
  {
    "scheduledCount": 12,
    "processingCount": 0,
    "sentCount": 145,
    "failedCount": 2,
    "totalCount": 159,
    "sendersCount": 2
  }
  ```

---

## Frontend UI & Figma Alignment

The ReachInbox frontend was designed to match the 1440x900 desktop Figma email client reference:

- **Canvas Background**: Pure **WHITE (`#FFFFFF`)** across all main views.
- **Brand Typography**: Dark/black **OMB** logo (`text-slate-900 font-extrabold text-xl`).
- **Green Accent Palette (`#22C55E` / `emerald-600`)**: Used for `+ Compose` outline, `Send / Send Later` CTAs, active sidebar selection (`bg-emerald-50 text-emerald-700`), recipient chips, and status badges.
- **Narrow Sidebar (`frontend/src/components/Sidebar.tsx`)**: Lightweight ~220px desktop sidebar.
- **Compact Email Rows**: Scheduled and Sent views render compact white email rows with recipient, colored time/status badges, subject preview, and favorite stars (`☆`).
- **Full Composer (`frontend/src/components/ComposeView.tsx`)**: 1440x900 full email-client composer with From dropdown, To field, Upload List CSV button, recipient chips, subject line, delay inputs, rich-text toolbar, and body editor.
- **Anchored Send Later Popover (`frontend/src/components/SendLaterPopover.tsx`)**: Compact popover positioned adjacent to the clock icon featuring quick presets ("Tomorrow, 10:00 AM", etc.) and custom `datetime-local` selection.

---

## Environment Variables

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Environment mode (`development` / `production` / `test`) |
| `PORT` | `5000` | Backend API server port |
| `DATABASE_URL` | `postgresql://reachinbox_user:reachinbox_pass@postgres:5432/reachinbox_db?schema=public` | PostgreSQL connection string |
| `POSTGRES_USER` | `reachinbox_user` | Database user |
| `POSTGRES_PASSWORD` | `reachinbox_pass` | Database password |
| `POSTGRES_DB` | `reachinbox_db` | Database name |
| `REDIS_HOST` | `redis` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `FRONTEND_URL` | `http://localhost:3000` | Next.js frontend application URL |
| `WORKER_CONCURRENCY` | `5` | Concurrent email worker job concurrency |
| `MAX_RECIPIENTS_PER_REQUEST` | `1000` | Hard limit on recipients per scheduling request |
| `MIN_EMAIL_DELAY_MS` | `2000` | Minimum delay between emails per sender (ms) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Maximum allowed email dispatches per hour per sender |
| `MAX_CSV_FILE_SIZE_MB` | `5` | Hard limit on CSV upload file size (MB) |
| `GOOGLE_CLIENT_ID` | `your_google_client_id` | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | `your_google_client_secret` | Google OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5000/api/auth/google/callback` | OAuth redirect URI |
| `SESSION_TTL_SECONDS` | `86400` | Redis session expiration time (seconds) |
| `SESSION_SECRET` | `your_session_secret` | Secret key for signing session cookies |

---

## Docker Infrastructure & Setup

The platform runs as a 5-container architecture managed by Docker Compose:

```bash
docker compose up -d
```

### Container Topology & Health Checks

| Container Name | Service | Ports | Healthcheck Verification Command |
| :--- | :--- | :--- | :--- |
| `reachinbox-postgres` | PostgreSQL 16 | `5433:5432` | `pg_isready -U reachinbox_user -d reachinbox_db` |
| `reachinbox-redis` | Redis 7 | `6379:6379` | `redis-cli ping` |
| `reachinbox-backend` | Express API | `5000:5000` | HTTP Readiness check (`depends_on` healthy DB & Redis) |
| `reachinbox-worker` | BullMQ Worker | - | Process check (`depends_on` healthy DB & Redis) |
| `reachinbox-frontend` | Next.js App | `3000:3000` | HTTP Readiness check (`depends_on` backend) |

---

## Development & Verification

### Local Prerequisites
- Node.js `v20.x` or higher
- Docker & Docker Compose
- npm `v10.x` or higher

### 1. Local Environment Setup
```bash
# Clone repository
git clone https://github.com/outfox-project/reachinbox-assignment.git
cd reachinbox-assignment

# Copy environment template
cp .env.example .env
```

### 2. Start Services via Docker Compose
```bash
docker compose build
docker compose up -d
```

### 3. Database Migration & Seeding
```bash
# Execute Prisma database migrations
docker exec -it reachinbox-backend npx prisma migrate dev

# Seed test database with initial user & sender credentials
docker exec -it reachinbox-backend npm run db:seed
```

### 4. Running Backend Tests & TypeScript Verification
```bash
# Run backend TypeScript typecheck
cd backend
npx tsc --noEmit

# Execute unit and integration test suite
npm test
```

### 5. Accessing Running Applications
- **Next.js Frontend**: [http://localhost:3000](http://localhost:3000)
- **Express Backend API**: [http://localhost:5000](http://localhost:5000)
- **Google OAuth Login**: [http://localhost:5000/api/auth/google](http://localhost:5000/api/auth/google)
