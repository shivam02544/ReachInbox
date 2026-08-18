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
Express Backend API (Port 5000) ──► PostgreSQL (Port 5432)
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
Ethereal SMTP / Mailer (Step 2+)
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
│   │   ├── routes/          # API routes, health checks, & dev queue test route
│   │   ├── queues/          # BullMQ queue producer & worker consumer modules
│   │   ├── utils/           # Structured console logger
│   │   ├── app.ts           # Express app setup
│   │   ├── server.ts        # API server startup
│   │   └── worker.ts        # Worker process startup & graceful shutdown
│   ├── prisma/
│   │   ├── schema.prisma    # PostgreSQL schema definition (User, Sender, Email)
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

## BullMQ Queue Architecture & Persistence

* **Queue Name**: `email-queue` (shared constant between queue producer and worker consumer).
* **Job Persistence**: BullMQ delayed jobs are persisted directly in Redis data structures, avoiding any in-memory scheduler (`setTimeout`/`cron`).
* **Worker Concurrency**: Driven by `WORKER_CONCURRENCY` environment variable (default: `5`).
* **Overdue Job Recovery**: If a worker or API container is restarted while a delayed job is pending, BullMQ retains the job in Redis. Once the worker reconnects, it immediately executes any job whose scheduled time has passed.
* **Volume Persistence**: Redis state is backed by the named Docker volume `redis_data` (`/data`), ensuring queue durability across container restarts (`docker compose restart` / `docker compose stop`).
* **Automatic Job Cleanup**: Configured `removeOnComplete: { age: 3600, count: 100 }` and `removeOnFail: { age: 86400, count: 200 }` to prevent unlimited memory growth in Redis while retaining recent execution history for debugging.

---

## Step 1B Verification & Dev Endpoint

To verify BullMQ delayed job processing without modifying PostgreSQL email records or triggering real SMTP sends, a temporary development endpoint is available:

```http
POST http://localhost:5000/api/test/queue
Content-Type: application/json

{
  "delayMs": 30000
}
```

* **Expected Response**:
  ```json
  {
    "jobId": "1",
    "delayMs": 30000,
    "scheduledFor": "2026-08-18T09:30:00.000Z",
    "status": "enqueued"
  }
  ```

---

## Docker Services

| Service Name | Container Name | Exposed Port | Internal Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| `postgres` | `reachinbox-postgres` | `5433` | `5432` | PostgreSQL relational database with named persistent volume |
| `redis` | `reachinbox-redis` | `6379` | `6379` | Redis data store for BullMQ and rate limiting |
| `backend` | `reachinbox-backend` | `5000` | `5000` | Express API server handling HTTP endpoints |
| `worker` | `reachinbox-worker` | None | None | Independent background worker consuming BullMQ jobs |
| `frontend` | `reachinbox-frontend` | `3000` | `3000` | Next.js web application |

---

## Environment Variables

See `.env.example` for the complete list of environment variables:

```ini
# Core Infrastructure
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://reachinbox_user:reachinbox_pass@postgres:5432/reachinbox_db?schema=public
POSTGRES_USER=reachinbox_user
POSTGRES_PASSWORD=reachinbox_pass
POSTGRES_DB=reachinbox_db
REDIS_HOST=redis
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3000

# Worker & Queue Settings
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=100
```

---

## Local Development

To spin up the entire application stack:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Build and start all Docker services
docker compose up -d --build

# 3. View status of all running containers
docker compose ps

# 4. View logs for the worker service
docker compose logs -f worker
```

---

## Health Check

The backend exposes health verification endpoints:

* **Basic Process Health**: `GET http://localhost:5000/health`
  * Response: `{ "status": "ok" }`
* **Dependency Health**: `GET http://localhost:5000/health/deps`
  * Verifies active connections to PostgreSQL (`SELECT 1`) and Redis (`PING`).
  * Response: `{ "status": "ok", "dependencies": { "postgres": "connected", "redis": "connected" } }`

---

## Persistence

PostgreSQL and Redis data are backed by named Docker Compose volumes:
* `postgres_data` -> `/var/lib/postgresql/data`
* `redis_data` -> `/data`

### Volume Behavior & Commands:
* `docker compose stop` or `docker compose restart` **preserves** all database and Redis queue state.
* `docker compose down` stops and removes containers while keeping named volumes intact.
* `docker compose down -v` **intentionally deletes** persistent volumes. Do not run during routine verification.

---

## Current Implementation Status

**Status: Step 1B (BullMQ + Redis Queue Foundation) Complete**

* [x] Step 0: Project repository structure & Docker architecture set up
* [x] Step 1A: PostgreSQL + Prisma database schema (`User`, `Sender`, `Email`, `EmailStatus`) implemented
* [x] Step 1B: BullMQ queue (`5.21.2`) & worker process foundation running in Docker
* [ ] Step 2: Ethereal SMTP mailer & real email sending *(Future step)*
* [ ] Step 3: Rate limiting & minimum delay controls *(Future step)*
* [ ] Step 4: Google OAuth & authentication *(Future step)*
* [ ] Step 5: Dashboard UI & Figma design implementation *(Future step)*

---

## Figma Visual Design Rule

> [!IMPORTANT]
> The provided Figma design is the **absolute source of truth** for all visual and frontend implementations in subsequent steps. Future frontend work must inspect and reproduce the Figma layout, spacing, typography, colors, components, tables, modal behavior, and responsive structure as closely as practical.
>
> **Figma Reference**: [ReachInbox Outbox Labs Figma Design](https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f)
