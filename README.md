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
BullMQ Queue
   │
   ▼
Worker Container (Separate Process, Same Codebase)
   │
   ▼
Ethereal SMTP / Mailer
```

* **Process Separation**: The Express API server (`backend`) handles HTTP requests. A separate container (`worker`) runs independently to consume background jobs. Both share the backend codebase (`./backend`) but execute different startup scripts.
* **Docker Service Communication**: Internal container communication relies exclusively on Docker Compose DNS service names (`postgres`, `redis`, `backend`), avoiding `localhost` inside container networks.

---

## Technology Stack

* **Frontend**: Next.js (`14.2.15`), React (`18.3.1`), TypeScript, Tailwind CSS
* **Backend API**: Node.js (`v20`), Express.js (`4.21.1`), TypeScript
* **Database & ORM**: PostgreSQL (`16-alpine`), Prisma ORM (`5.22.0`)
* **Queue & Cache**: BullMQ, Redis (`7-alpine`), `ioredis`
* **Infrastructure**: Docker, Docker Compose (`3.8`)

---

## Project Structure

```
reachinbox-assignment/
├── backend/
│   ├── src/
│   │   ├── config/          # Typed env validation, Prisma, & Redis clients
│   │   ├── controllers/     # API request handlers (Future steps)
│   │   ├── middleware/      # Error & 404 handlers
│   │   ├── routes/          # API routes & health checks
│   │   ├── services/        # Business logic (Future steps)
│   │   ├── queues/          # Queue definitions (Future steps)
│   │   ├── utils/           # Structured console logger
│   │   ├── app.ts           # Express app setup
│   │   ├── server.ts        # API server startup
│   │   └── worker.ts        # Worker process startup
│   ├── prisma/
│   │   └── schema.prisma    # PostgreSQL schema definition
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

## Docker Services

| Service Name | Container Name | Exposed Port | Internal Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| `postgres` | `reachinbox-postgres` | `5432` | `5432` | PostgreSQL relational database with named persistent volume |
| `redis` | `reachinbox-redis` | `6379` | `6379` | Redis data store for BullMQ and rate limiting |
| `backend` | `reachinbox-backend` | `5000` | `5000` | Express API server handling HTTP endpoints |
| `worker` | `reachinbox-worker` | None | None | Background process consuming BullMQ jobs |
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

# Future Feature Reserved Variables
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=100
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
ETHEREAL_HOST=...
ETHEREAL_PORT=...
ETHEREAL_USER=...
ETHEREAL_PASSWORD=...
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

# 4. View logs for a specific service
docker compose logs -f backend
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
* `docker compose stop` or `docker compose restart` **preserves** all database and Redis state.
* `docker compose down` stops and removes containers while keeping named volumes intact.
* `docker compose down -v` **intentionally deletes** persistent volumes. Use with caution.

---

## Current Implementation Status

**Status: Step 0 (Project Initialization & Architecture Contract) Complete**

* [x] Project repository structure & Docker architecture set up
* [x] Express backend & worker process separation established
* [x] PostgreSQL & Redis Docker services configured with persistent volumes
* [x] Next.js frontend container initialized
* [x] Basic process health & dependency health endpoints functioning
* [ ] BullMQ queue integration *(Step 1+)*
* [ ] Google OAuth & authentication *(Step 1+)*
* [ ] Ethereal SMTP email sending *(Step 1+)*
* [ ] Rate limiting & minimum delay controls *(Step 1+)*
* [ ] Dashboard UI & Figma design implementation *(Step 1+)*

---

## Figma Visual Design Rule

> [!IMPORTANT]
> The provided Figma design is the **absolute source of truth** for all visual and frontend implementations in subsequent steps. Future frontend work must inspect and reproduce the Figma layout, spacing, typography, colors, components, tables, modal behavior, and responsive structure as closely as practical.
>
> **Figma Reference**: [ReachInbox Outbox Labs Figma Design](https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f)
