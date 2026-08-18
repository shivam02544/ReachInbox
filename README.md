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
Simulated Email Delivery (Step 2) / Ethereal SMTP Mailer (Step 3+)
```

* **Process Separation**: The Express API server (`backend`) handles HTTP requests. A separate container (`worker`) runs independently to consume background jobs. Both share the backend codebase (`./backend`) but execute different startup scripts.
* **Docker Service Communication**: Internal container communication relies exclusively on Docker Compose DNS service names (`postgres`, `redis`, `backend`), avoiding `localhost` inside container networks.

---

## Technology Stack

* **Frontend**: Next.js (`14.2.24`), React (`18.3.1`), TypeScript, Tailwind CSS
* **Backend API**: Node.js (`v20`), Express.js (`4.21.1`), TypeScript
* **Database & ORM**: PostgreSQL (`16-alpine`), Prisma ORM (`5.22.0`)
* **Queue & Cache**: BullMQ (`5.21.2`), Redis (`7-alpine`), `ioredis` (`5.4.1`)
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
│   │   ├── services/        # Email batch scheduling & query logic (email.service.ts)
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

## Email Scheduling Pipeline Architecture

```
POST /api/emails/schedule
          │
          ▼
Validate Request & Sender Existence (PostgreSQL)
          │
          ▼
Sanitize Recipients & Filter Invalid Emails
          │
          ▼
For Each Recipient:
  1. Calculate scheduledAt = startTime + (index * delayMs)
  2. Compute SHA-256 Idempotency Key
  3. Check PostgreSQL for Existing Idempotency Key
     ├── Exists -> Skip (increment alreadyExistsCount)
     └── New    -> Insert Email row (status = SCHEDULED)
          │
          ▼
Enqueue BullMQ Job (jobId = Email.id, delay = scheduledAt - now)
Update Email.bullJobId in PostgreSQL
          │
          ▼
BullMQ Worker Container (email-queue)
  1. Fetch Email from PostgreSQL by ID
  2. Check Status (If SENT -> Skip safely)
  3. Atomic Transition: SCHEDULED -> PROCESSING (attempts + 1)
  4. Simulated Email Send (Logs delivery)
  5. Atomic Transition: PROCESSING -> SENT (sentAt = now)
```

---

## PostgreSQL + BullMQ Relationship & Trade-Offs

> [!IMPORTANT]
> **Distributed Systems Trade-Off**: PostgreSQL and Redis are separate infrastructure systems and do not share an ACID transaction.
>
> 1. **PostgreSQL as Authoritative Store**: PostgreSQL holds the persistent, canonical state of all scheduled, processing, sent, and failed emails.
> 2. **BullMQ as Execution Engine**: Redis stores the delayed execution state (`email-queue`).
> 3. **Deterministic Job Matching**: Every BullMQ job ID is explicitly set to the PostgreSQL `Email.id` (`jobId = Email.id`).
> 4. **Partial Failure Handling**: If enqueuing a job into BullMQ fails after database insertion, the system logs the failure clearly and reports it in the API response under `partialFailures` rather than silently pretending scheduling succeeded.

---

## Scheduling Timestamp & Delay Calculation

* **Individual Email `scheduledAt`**:
  $$\text{scheduledAt}_i = \text{startTime} + (i \times \text{delayMs})$$
  *(where $i = 0, 1, 2, \dots$ is the recipient index in the batch).*
* **BullMQ Relative Delay**:
  $$\text{delay} = \max(0, \text{scheduledAt}_i - \text{currentTime})$$

---

## Idempotency Implementation

Idempotency is enforced using a deterministic SHA-256 hash stored in `Email.idempotencyKey` `@unique`:

$$\text{Canonical String} = \text{senderId} \mid \text{normalizedRecipient} \mid \text{trimmedSubject} \mid \text{trimmedBody} \mid \text{ISO8601ScheduledAt}$$

$$\text{IdempotencyKey} = \text{SHA256}(\text{Canonical String})$$

* **Duplicate Batch Behavior**: Submitting duplicate batch requests skips duplicate recipient emails (`alreadyExistsCount`), preventing duplicate database rows or BullMQ jobs.
* **Database `@unique` Guard**: The database unique constraint acts as the final authoritative guard against concurrent race conditions.

---

## Email State Machine & Worker Execution

```
[ SCHEDULED ] ─────(Worker Claims Job)─────► [ PROCESSING ] ─────(Simulated Delivery)─────► [ SENT ]
                                                   │
                                            (Fatal Error)
                                                   ▼
                                              [ FAILED ]
```

* **Attempts Counter**: Incremented **exactly once** when the worker atomically transitions an Email row from `SCHEDULED` to `PROCESSING`.
* **Idempotency Safeguard**: If a worker receives a job for an Email that is already marked `SENT`, it logs an idempotency notice and skips execution safely without re-sending.

---

## Development Seed Script

To seed a test `User` and `Sender` in Docker PostgreSQL for development API testing:

```bash
npm run db:seed
```

* **Created Test Records**:
  * **User ID**: `46130fb6-0aa8-4bbb-88d9-a8d013c8a002` (`dev@example.com`)
  * **Sender ID**: `0f0d686e-83ae-483e-8695-68a14234282b` (`sender@example.com`)

---

## API Documentation

### 1. Schedule Email Batch
* **Method**: `POST /api/emails/schedule`
* **Content-Type**: `application/json`
* **Request Body**:
  ```json
  {
    "senderId": "0f0d686e-83ae-483e-8695-68a14234282b",
    "subject": "Weekly Newsletter",
    "body": "Hello from ReachInbox email scheduler!",
    "startTime": "2026-08-18T10:00:00.000Z",
    "delayMs": 2000,
    "recipients": [
      "alice@example.com",
      "bob@example.com"
    ]
  }
  ```
* **Success Response (HTTP 200)**:
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
        "id": "b041842c-5a56-41b7-97ef-fdd194b61680",
        "recipient": "alice@example.com",
        "scheduledAt": "2026-08-18T10:00:00.000Z",
        "status": "SCHEDULED"
      },
      {
        "id": "f817ba5a-0488-465c-8ace-c007cf30cd87",
        "recipient": "bob@example.com",
        "scheduledAt": "2026-08-18T10:00:02.000Z",
        "status": "SCHEDULED"
      }
    ],
    "skippedDuplicates": [],
    "invalidRecipients": [],
    "partialFailures": []
  }
  ```

### 2. List Scheduled Emails
* **Method**: `GET /api/emails/scheduled`
* **Response (HTTP 200)**:
  ```json
  {
    "count": 1,
    "emails": [
      {
        "id": "6c195d49-647c-4246-9c37-b533cfeb0add",
        "senderId": "0f0d686e-83ae-483e-8695-68a14234282b",
        "recipient": "dup@example.com",
        "subject": "Test G Duplicate",
        "status": "SCHEDULED",
        "scheduledAt": "2026-08-18T10:00:00.000Z",
        "attempts": 0,
        "bullJobId": "6c195d49-647c-4246-9c37-b533cfeb0add",
        "createdAt": "2026-08-18T09:48:38.671Z"
      }
    ]
  }
  ```

### 3. List Sent Emails
* **Method**: `GET /api/emails/sent`
* **Response (HTTP 200)**:
  ```json
  {
    "count": 1,
    "emails": [
      {
        "id": "f6609ba2-607b-46e8-8364-d41b38488017",
        "senderId": "0f0d686e-83ae-483e-8695-68a14234282b",
        "recipient": "full_stack@example.com",
        "subject": "Test F Full Stack Restart",
        "status": "SENT",
        "scheduledAt": "2026-08-18T09:48:27.679Z",
        "sentAt": "2026-08-18T09:48:27.803Z",
        "attempts": 1,
        "createdAt": "2026-08-18T09:48:07.753Z"
      }
    ]
  }
  ```

---

## Current Implementation Status

**Status: Step 2 (Real Email Scheduling Pipeline) Complete**

* [x] Step 0: Project repository structure & Docker architecture set up
* [x] Step 1A: PostgreSQL + Prisma database schema (`User`, `Sender`, `Email`, `EmailStatus`) implemented
* [x] Step 1B: BullMQ queue (`5.21.2`) & worker process foundation running in Docker
* [x] Step 2: Email scheduling pipeline (`POST /api/emails/schedule`, `GET /api/emails/scheduled`, `GET /api/emails/sent`), SHA-256 idempotency, state machine transitions, atomic attempts counter, simulated worker sending, and dev seed script.
* [ ] Step 3: Ethereal SMTP mailer integration & real email sending *(Future step)*
* [ ] Step 4: Rate limiting & minimum delay controls *(Future step)*
* [ ] Step 5: Google OAuth & authentication *(Future step)*
* [ ] Step 6: Dashboard UI & Figma design implementation *(Future step)*

---

## Figma Visual Design Rule

> [!IMPORTANT]
> The provided Figma design is the **absolute source of truth** for all visual and frontend implementations in subsequent steps. Future frontend work must inspect and reproduce the Figma layout, spacing, typography, colors, components, tables, modal behavior, and responsive structure as closely as practical.
>
> **Figma Reference**: [ReachInbox Outbox Labs Figma Design](https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f)
