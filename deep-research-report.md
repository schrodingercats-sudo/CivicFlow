# Executive Summary

Building a **production-grade** backend for CivicFlow means treating it as a real SaaS system, not just a student project. We’ll use **Node.js + Express** with PostgreSQL (via Supabase) and aim for sub-300–500 ms API latencies under heavy load. This requires careful architecture: **multi-core utilization** (Node clustering or PM2), **load balancing**, and efficient I/O. Express’s official docs emphasize common performance tips: use **gzip compression** (at the proxy or in-app) to shrink responses, avoid any blocking or synchronous functions in request handlers, and set `NODE_ENV=production` for maximized speed. We should also use a **fast, structured logger** (Pino is recommended) instead of `console.log()` to avoid blocking I/O. In production, we will run multiple Node processes (one per CPU core) and place them behind a reverse proxy (e.g. Nginx) that handles TLS, gzip, HTTP/2, and health checks.

For **database scaling**, Supabase (managed Postgres) provides built-in connection pooling (Supavisor/pgBouncer) which we’ll use by default. We must be mindful of connection limits: by using a pooler or client-side pooling (via the `pg` library’s `Pool`), we can handle many web users with far fewer active DB connections. The Supabase docs note that **connection pooling “improves DB performance by reusing existing connections”**. We should create **indexes** on all frequently-filtered or joined columns to avoid slow sequential scans – as Supabase advises, add indexes on columns used in WHERE, JOIN, ORDER BY, etc. Over-indexing slows writes, so balance is key. For extremely large tables (e.g. logs or historical data), we can consider **partitioning by date or ID range** to prune old data and improve query planning; but this adds complexity and is a future optimization.

To handle **high throughput** (tens of millions of requests/year), horizontal scaling is essential. We’ll design the service statelessly so we can run **multiple Express instances behind a load balancer**. Node’s [cluster API](https://expressjs.com/en/advanced/best-practice-performance.html) lets us spread traffic across cores. A load balancer (built into many cloud environments or via Nginx/Haproxy) will distribute requests evenly and allow zero-downtime deploys. We’ll also use caching aggressively. Caching is tiered: 

- **In-process LRU cache** (e.g. using `lru-cache`) for the hottest data per instance (<1 ms lookup),  
- **Redis** for shared cache and rate-limiting (0.5–2 ms lookup),  
- **CDN or HTTP Cache-Control** for truly static or public API responses (1–50 ms end-to-end).  

By caching database queries or heavy computations (with appropriate TTLs), we can reduce DB load dramatically.

For **API design**, we’ll use REST endpoints with pagination, filtering, and sorting. We’ll avoid naive OFFSET-based pagination for large data because it slows down as pages grow; instead we’ll use **cursor-based (keyset) pagination** with a stable sort key (e.g. complaint timestamp or UUID). Offset-vs-cursor comparison: offsets are easy but become O(N) on large tables; cursors are slightly more complex but stay O(1) per page. (A table will illustrate this tradeoff below.)

**Security** and **resilience** are critical. We’ll implement HTTPS (even locally via dev proxies), input validation/sanitization (e.g. with `express-validator`), and strong **RBAC** (we have Citizen, Officer, Admin roles). Secrets (DB URL, API keys) go into environment variables, never hardcoded. We’ll add **rate limiting** (e.g. `express-rate-limit` with Redis store) to prevent abuse. External calls (like to Groq/NVIDIA AI) will be wrapped with a circuit-breaker (e.g. [Opossum](https://nodeshift.dev/opossum)) and timeout, so an AI outage doesn’t cascade.

To handle long-running or heavy tasks (like image resizing, sending emails, or slow external calls), we’ll use a **job queue**. The de-facto choice is **BullMQ** (Redis-backed). It’s extremely popular and high-performance. By enqueuing tasks (with retries, scheduling, priorities), we keep HTTP request latencies low. BullMQ supports multiple workers and concurrency (so we can autoscale workers). A simpler alternative is Bee-Queue (Redis) or RabbitMQ, but BullMQ’s rich features and community support make it ideal.

**Monitoring and Reliability:** We will instrument our service for metrics and tracing. Common practice is to use **Prometheus** (via `prom-client` or Express middleware) to export metrics (request rate, latencies, DB query times, queue lengths), and **Grafana** for dashboards. For distributed tracing, OpenTelemetry (Node SDK) can capture end-to-end latency across API calls and AI requests. Logs will be JSON-structured (using Pino) and forwarded to a log aggregator or Splunk. We’ll set up health/readiness endpoints and possibly use a tool like Sentry for error tracking. All this observability lets us track 95th/99th percentile latencies under load.

Finally, a solid **CI/CD pipeline** will ensure quality. Even though we’re developing locally, we’ll set up Git/GitHub workflows: run linting (ESLint), tests, and build on each push. On merge, we could automatically deploy to a staging server (or just prepare a Docker image). Blue/green or rolling deployments can be done with feature flags. Key is having automated tests and health checks so that a bad release can be rolled back quickly.

In summary, the CivicFlow backend must use **best practices** in Node.js: clustering, async I/O, connection pooling, caching, queuing, and observability, all orchestrated under a formal plan of milestones. The following sections detail each facet, including tables on pagination and caching strategies, mermaid diagrams of the architecture and request flow, and prioritized checklists for a hackathon-ready implementation.

## System Architecture and Flow

The backend will be **stateless** and scalable. Below is a high-level mermaid diagram of the core components:

```mermaid
flowchart TB
    subgraph Client Side
      Browser[Citizen/Officer Browser]
    end
    subgraph Server Side
      LoadBalancer[Load Balancer (e.g. Nginx/Cloud LB)]
      subgraph Node Cluster
        Node1[Node.js (Express) Instance 1]
        Node2[Node.js (Express) Instance 2]
        Node3[Node.js (Express) Instance 3]
      end
      SupabaseDB[(Supabase\nPostgreSQL)]
      Redis[(Redis Cache/\nJob Queue)]
      GroqAPI[(Groq AI API)]
      NVIDIAAPI[(NVIDIA NIM API)]
      Storage[(Supabase Storage)]
    end

    Browser -->|HTTPS| LoadBalancer
    LoadBalancer --> Node1
    LoadBalancer --> Node2
    LoadBalancer --> Node3

    Node1 -->|SQL| SupabaseDB
    Node2 --> SupabaseDB
    Node3 --> SupabaseDB

    Node1 -->|read/write| Redis
    Node2 --> Redis
    Node3 --> Redis

    Node1 -->|call AI| GroqAPI
    Node2 --> GroqAPI
    Node3 --> GroqAPI

    Node1 -->|upload/download| Storage
    Node2 --> Storage
    Node3 --> Storage
```

- **Load Balancer** (or reverse proxy) routes incoming requests to any Node instance and handles SSL/HTTP2.  
- **Node Cluster**: multiple Express processes (e.g. 3 instances) each listen on an internal port; they run the same code and share no state. We rely on sticky-sessions **not** being needed (use JWT cookies or tokens).  
- **SupabaseDB**: A managed Postgres. All reads/writes go here. We enable connection pooling (Supavisor) and create necessary indexes. For analytics, optionally use read-replicas.  
- **Redis**: Used for caching shared data, sessions (if any), and a BullMQ queue. Redis is external or managed (e.g. Supabase Edge functions have a Redis add-on).  
- **Groq/NVIDIA APIs**: External AI services for categorization and priority. Calls are asynchronous (we enqueue or await with timeouts). Failures trigger fallbacks.  
- **Storage**: Supabase Storage holds uploaded photos and any static assets. Node uploads images to it (via Supabase SDK) and stores the URL in the DB.

A **request flow** example (complaint submission) is:

```mermaid
flowchart TD
    Citizen[Citizen] -->|POST /complaints| NodeServer[Express App]
    NodeServer --> DB{Database (Supabase)}
    NodeServer --> Cache{Redis Cache}
    NodeServer --> Queue[Job Queue (BullMQ)]
    NodeServer --> GroqAPI
    NodeServer --> NVIDIAAPI
    DB -->|save complaint| NodeServer
    Queue --> Worker[Worker Process]
    Worker -->|update DB| DB
    Worker -->|send notif| NodeServer
    NodeServer -->|200 OK| Citizen
```

1. Citizen **POST /complaints** with data + image.  
2. Express handler **validates input** and **saves** complaint to DB (status “Submitted”).  
3. After saving, **enqueue** a job (BullMQ) to call Groq AI for categorization.  
4. Worker pulls job: calls Groq API (or NVIDIA if fallback) to get category/priority. Updates the DB record.  
5. If needed, worker pushes a notification into a Redis list (polling by frontend) or sends an email.  
6. Client polls **GET /complaints/:id** and sees updated status.  

This decoupling ensures the user’s request completes quickly (just a DB write and queue enqueue) and AI runs in background.

## Performance Targets

- **Latency:** Aim for <300 ms 95th percentile response times under typical load. Sublte differences exist per endpoint (some may take longer, e.g. file upload ~500ms).  
- **Throughput:** The system should handle on the order of **10–100 million requests per year** (roughly 30–300 requests per second peak). Using Node clusters and horizontal scaling, plus efficient DB queries and caching, this is achievable.  
- **Horizontal Scaling:** With multiple instances, total throughput scales roughly linearly. Use `pm2` or Docker in real deployments, but locally we simulate with multiple processes.

Key practices to meet these targets:

- **Cluster/Processes:** Run one Node process per CPU core. Each runs behind a supervisor (PM2 or systemd) to auto-restart on crash.  
- **Compression:** Enable gzip compression for HTTP responses. In production, offload this to Nginx for speed.  
- **Database Pooling:** Use the `pg.Pool` (via Supabase client or Prisma) so connections are reused. For serverless or many short-lived functions, use Supavisor in transaction mode.  
- **Prepared Statements:** Use parameterized queries to avoid SQL injection and to leverage query planning.  
- **Use Latest Node:** Always run the latest LTS Node version. Newer V8 / runtime improvements can significantly boost performance.  
- **HTTP/2:** If possible, use HTTP/2 or keep-alive to reduce handshake costs. Node 18+ supports HTTP/2 well.

## Database Practices

- **Indexes:** As a rule, index **WHERE** columns, **JOIN** keys, and **ORDER BY** columns. For example, indexing `complaints(status)`, `complaints(created_at)`, or `complaints(category_id)` will speed up common queries. Use **EXPLAIN ANALYZE** (or Supabase’s Database Advisor) to find missing indexes.  
- **Schema:** Use UUIDs as primary keys and set `created_at TIMESTAMP DEFAULT now()`. Define foreign keys with `ON DELETE CASCADE` where appropriate. Add `CHECK` constraints or domain types for enums (status, roles). For high-scale lists (e.g. user notifications), include indexes on `user_id`.  
- **Partitioning:** Not needed at MVP scale, but for very large tables consider partitioning (e.g. `PARTITION BY RANGE(created_at)`). This makes vacuuming and pruning old data easier. If partitioned, remember to create the same indexes on each partition.  
- **Replication/Scaling:** Supabase allows read replicas. A simple approach: if read traffic dominates, direct analytics reads to a replica. The blog suggests upgrading the primary instance if writes are the bottleneck, or adding replicas if 80%+ is reads. We should monitor DB CPU and connection metrics in Supabase dashboards.  

## Caching Strategies

A multi-layer cache is key. We summarize caching layers:

| Layer               | Latency     | Scope          | TTL Style        | Best For                         |
|---------------------|-------------|----------------|------------------|----------------------------------|
| **In-process LRU**  | < 1 ms      | Single Node    | Count or time   | Config, lookup tables, recent queries  |
| **Redis (Cluster)** | ~0.5–2 ms   | All Nodes      | Any (cache-aside) | Session state, query results, rate limits |
| **CDN / CDN-cached**| ~1–50 ms    | Global users   | HTTP Cache       | Static files, infrequent API data     |

This is drawn from practice. We will implement:

- **In-process cache:** For trivial lookups (e.g. country codes, small static lists) using `lru-cache`. Quick and requires no external system. 
- **Redis cache:** A shared cache (via a managed Redis) for expensive DB calls. For example, caching `/dashboard` stats for 30s, or query results for popular complaints. Use **cache-aside** pattern: check Redis first, on miss query the DB then store. Key eviction with TTL prevents staleness. Always invalidate related keys on data change.
- **CDN / HTTP cache:** All static assets (JS, images, CSS) will be served by a CDN (via Vercel if deployed). Additionally, for public API GETs (like browsing complaints) we can set HTTP `Cache-Control: public, max-age=60` so a CDN or browser caches them for short periods.

We’ll also apply **HTTP-level caching headers** on GET endpoints as appropriate (E-Tag, `last-modified`) to reduce client-server round-trips.

## Pagination Strategies

For endpoints returning lists (complaints, notifications, etc.), use pagination. We compare common methods:

| Strategy         | Pros                                      | Cons                         |
|------------------|-------------------------------------------|------------------------------|
| **Offset-based** (e.g. `?page=5&size=20`) | Simple to implement; arbitrary page jumps | Very slow for large offsets (DB scans many rows); inconsistent if data changes (new items shift pages) |
| **Cursor-based** (e.g. `?cursor=XYZ&limit=20`) | Very fast for "next/prev" navigation; stable results even with inserts/deletes | Slightly more complex; cannot jump far ahead without fetching intermediate pages |

For CivicFlow, **cursor-based** (a.k.a. keyset) pagination is preferred. For example, we might return a `next_cursor` token (e.g. the last complaint’s ID or timestamp) that the client uses to fetch the next page. This avoids OFFSET’s performance issues. We will design our REST API to accept a cursor and limit.

## Rate Limiting and Security

To protect against abuse:

- **Rate Limiting:** Use a Redis-backed limiter (e.g. `express-rate-limit` with [`rate-limit-redis`](https://www.npmjs.com/package/rate-limit-redis)). For example, allow ~100 requests/min per IP or per user token. Redis ensures limits across all Node instances.  
- **Validation:** Use middleware (Joi or `express-validator`) to validate every request body/query parameter. This prevents injection attacks and ensures only well-formed data enters the system.  
- **Authentication/Authorization:** Supabase Auth (JWT) for login. Protect routes with role checks (Citizen can only modify own data, Officer sees assigned cases, Admin sees all). Each API should check `req.user` claims and return 403 if insufficient.  
- **Idempotency:** For critical write operations (like complaint submission), we can use idempotency keys or unique constraints (e.g. unique external ID). This prevents double-processing if clients retry.  
- **CORS and HTTPS:** Configure CORS to restrict to allowed origins (the frontend domain). Enforce HTTPS even in backend (redirect HTTP to HTTPS).  
- **Helmet:** Include `helmet` middleware to set secure HTTP headers (HSTS, XSS protection, etc.).  

## Asynchronous Processing & Queuing

Time-consuming tasks (AI calls, image processing, notifications) go into a queue. We recommend **BullMQ** (Redis-based):

```javascript
const { Queue } = require('bullmq');
const connection = new IORedis(process.env.REDIS_URL);
const complaintQueue = new Queue('complaints', { connection });

// Enqueue a job after saving complaint:
await complaintQueue.add('categorize', { complaintId: newId });

// Worker (in a separate process)
const { Worker } = require('bullmq');
new Worker('complaints', async job => {
  const { complaintId } = job.data;
  // call Groq API, update DB...
}, { connection });
```

BullMQ features automatic retries, delayed jobs, concurrency, and failed job handling. Alternative queues: Bee-Queue (simpler) or RabbitMQ, but since Redis is already used, BullMQ fits naturally.

## Observability and Monitoring

- **Logging:** Use Pino or Winston to log JSON. Include request IDs/correlation IDs. Don’t log sensitive data. Logs go to stdout (to be collected).  
- **Metrics:** Use `prom-client` in Express to export metrics (request counts, histograms of latency, DB query durations). Optionally use `express-prom-bundle`. These are scraped by Prometheus and visualized in Grafana. Monitor key SLIs (99th percentile latency, error rates).  
- **Tracing:** Instrument OpenTelemetry on Express middleware and on DB/Redis clients to trace requests across services. Alternatively, use Lightstep/Datadog.  
- **Health Checks:** Implement `/healthz` that checks database and Redis connectivity. Container orchestrators or cloud LBs will ping this to ensure instances are alive.  
- **Alerting:** Set up alerts (Grafana) on high latency, high error rates, or DB CPU. For example, alert if 95th percentile latency > 500 ms or DB CPU > 80% sustained.  

## Benchmarking and Load Testing

To ensure we meet targets, plan load tests:

- **Tools:** Use [k6](https://k6.io/), [wrk](https://github.com/wg/wrk), or ApacheBench. These simulate high concurrency and report percentiles.  
- **Scenarios:**  
  - Read-heavy: 70% GET `/complaints`, 30% POST `/complaints`.  
  - Write-heavy: 50% POST, 50% GET.  
  - Mixed with AI: including 10% AI calls.  
- **Measurements:** Track 50th, 95th, 99th percentile latencies. Ensure 95th < 300ms in expected conditions.  
- **Scaling Tests:** Gradually increase concurrent users to find breaking points.  
- **Auto-scaling:** In cloud, use metrics to auto-scale Node instances based on CPU or request queue length.

## Deployment & CI/CD Strategy

Even though we develop locally, plan for real deployment:

- **CI Pipeline:** On each push to `main`, run lint/tests (`npm run lint`, `npm test`). On merge, build docker image or prepare deployment bundle.  
- **Containerization (optional):** We can define a `Dockerfile` for Node. For Supabase functions, no; just Node. Container not required for hackathon, but designing with containers in mind is fine.  
- **Infrastructure:** In production, use a managed service (e.g. Render, AWS ECS/Fargate) with auto-scaling. Use managed Postgres (Supabase already) and managed Redis (Cloudflare D1 or Heroku Redis).  
- **Load Balancer:** Use a cloud load balancer with sticky sessions OFF, since auth is stateless.  
- **Deploy Strategy:** Blue/green or rolling updates. Check health endpoints and metrics.  
- **Secrets:** All keys/API credentials go into environment variables or a secret manager (never in code).  

## Tables & Diagrams

**Caching Layers Comparison:**  
See table above for in-process vs Redis vs CDN.

**Pagination Comparison:**  

| Method         | Query Example                    | Performance        | Use Case                        |
| -------------- | -------------------------------- | ------------------ | ------------------------------- |
| Offset-based   | `SELECT * FROM complaints LIMIT 50 OFFSET 5000` | Slower for large offset (reads N rows) | Rarely used pages, random access |
| Cursor-based   | `SELECT * FROM complaints WHERE id > ? LIMIT 50` | Constant time per page (indexed) | Continuous scrolling, most cases |

**Job Queue Options:**  

| Queue         | Backend  | Key Features            | Pros                        | Cons                          |
| ------------- | -------- | ----------------------- | --------------------------- | ----------------------------- |
| **BullMQ**    | Redis    | Persistent, retries, concurrency | High throughput, mature, works across processes | Requires Redis setup |
| **Bee-Queue** | Redis    | Lightweight, simple API | Easy to start, fast         | Fewer advanced features; less active |
| **RabbitMQ**  | RabbitMQ | AMQP broker             | Language-agnostic, robust  | More infrastructure, complex |

**System Component Diagram:** (see above Mermaid) – shows client, load balancer, Node cluster, DB, cache, AI services, and storage.

**Request Flow Diagram:** (see above Mermaid) – illustrates how a complaint submission request is handled, including async AI processing.

## Prioritized Checklist and Milestones

We break backend work into these milestones:

1. **Project Setup (Milestone 1)** – Initialize Node/Express project, folder structure, linting, and version control. Install essential middleware (body-parser, CORS). Establish connection to Supabase Postgres (via `pg` or Supabase JS), and ensure we can connect locally. Output: “Hello world” API and DB ping endpoint.  
2. **Database Schema & Migrations** – Design SQL schema (users, departments, complaints, updates, ratings). Write migration SQL (e.g. using [supabase CLI](https://supabase.com/docs/guides/cli)). Test schema against Supabase.  
3. **Authentication** – Integrate Supabase Auth (or JWT) for user registration/login. Protect routes with middleware to check tokens. Create user roles (citizen/officer/admin) in DB.  
4. **Complaint CRUD APIs** – Implement complaint creation (`POST /complaints`), list (`GET /complaints` with filters), detail (`GET /complaints/:id`), update status (`PATCH /complaints/:id`), and delete. Include input validation and error handling.  
5. **Image Upload** – Add file upload (using `multer` or similar). On complaint POST, accept an image, upload it to Supabase Storage, and save the URL in the DB. Ensure upload progress and size limits.  
6. **Location Data** – Extend complaints to include latitude/longitude or address. Use either front-end geolocation (caller provides coords) or a geocoding API.  
7. **Citizen Dashboard Endpoints** – APIs for citizens to list their complaints, see statuses, add feedback/rating. Possibly stats endpoints (count resolved, etc).  
8. **Officer Dashboard Endpoints** – APIs for officers to list assigned complaints, update progress, attach completion proof (image), and close complaints.  
9. **Admin Dashboard Endpoints** – APIs for admin to manage users/departments, view all complaints, and assign departments (if not automated). Also endpoints to get analytics (counts by category, performance metrics).  
10. **AI Integration** – Build an `AIService` module that encapsulates calls to Groq and NVIDIA (with fallback). Integrate into complaint submission flow **after** saving. This ensures that complaint saving never fails just because AI did.  
11. **Caching & Rate Limiting** – Add Redis integration. Implement in-memory caching for static queries (e.g. department list). Add Redis-backed rate limiting. Optimize any slow queries by caching them with TTL.  
12. **Monitoring & Testing** – Add logging (Pino), metrics endpoint (`/metrics`). Write a simple load-test script (e.g. k6 file or wrk command) and record baseline performance. Add health check endpoint.  
13. **CI/CD & Final Polish** – Write GitHub Actions workflows for CI. Ensure environment configs are documented. Refine error messages and logging. Prepare README and setup instructions.  

Each milestone above should yield a **fully functional backend subset** before moving on. For example, after Milestone 5 (Image Upload), you should be able to submit a complaint with a photo and see it in the DB.

All these decisions and instructions will be captured in the **`BACKEND_CONTEXT.md`** file (see below). That context file will hold environmental details (ports, URLs, credentials), architecture notes, and testing commands for the backend.

# Gemini Prompt

:::writing{variant="document" id="83791"}
# CivicFlow Backend – Production-Ready Plan

You are an expert **backend architect and engineer** tasked with designing and implementing the production-grade backend for **CivicFlow**, an AI-powered complaint management system. Think like a senior architect focusing on reliability, scalability, and maintainability, not just a code generator.

## Objectives

- Research and summarize **best practices** for Node.js + Express + PostgreSQL (Supabase) backends. Emphasize performance (latency ≤300–500 ms), throughput (tens of millions of requests/year), scaling (horizontal clustering, connection pooling), and key operational considerations (caching, pagination, rate limiting, queues, observability, security). Use authoritative sources (official docs, reputable engineering blogs) to inform each point. Include tables and diagrams comparing strategies (e.g. pagination, caching, queues) and show system/component architecture with Mermaid.

- Based on that research, produce a **Backend Software Requirement Specification (SRS)** for CivicFlow and a **Production Readiness Checklist**. Include functional requirements, non-functional requirements, data models (Postgres schema), API design, roles/permissions, performance targets, tech stack, and security considerations.

- Create a step-by-step **Milestone 1 plan**: initialize the Node.js + Express project, configure environment, set up connection pooling to Supabase Postgres, and implement a simple “Hello World” and database health-check endpoint. Explain each step, file structure, and how to run/test locally. Milestone 1 must be fully functional before proceeding.

- Provide **code templates/snippets** for crucial backend patterns:  
  - Database connection pooling setup (using `pg.Pool` or Supabase client).  
  - Cursor-based pagination in Express (with SQL example).  
  - Redis caching middleware example (cache-aside pattern).  
  - Rate-limiting middleware (e.g. `express-rate-limit` + Redis).  
  - BullMQ job queue setup (producer & worker examples).  
  - AI service abstraction (Groq API call with NVIDIA fallback).  

- Provide **monitoring and testing scripts**:  
  - Example Prometheus metrics exposition (using `prom-client`).  
  - Example OpenTelemetry tracer setup for Express.  
  - A load-testing script (k6 or wrk) with sample configuration.  
  - Instructions for measuring p95/p99 latencies and throughput.

- Prepare a **`BACKEND_CONTEXT.md`** with all architectural decisions, environment variables (e.g. `PORT`, `DB_URL`, `REDIS_URL`, `GROQ_KEY`, etc.), setup commands, and testing commands. This context file will be used in future milestones, so include any constant or system-wide setting the team needs to know. Provide it as a final section (copy-paste ready content).

## Constraints

- Frontend is separate; focus only on backend. Backend runs locally (http://localhost:5000) during development. Do **not** deploy during coding.  
- Use Node.js (current LTS), Express, and Supabase Postgres. Redis can be local for dev. No Docker is required now.  
- Follow clean architecture: separate `routes/`, `controllers/`, `services/`, `middleware/`, and so on.  
- Do **not** generate full code upfront. Work milestone by milestone. After Milestone 1 is complete and tested, wait for approval before proceeding. At each step, explain architecture and code changes, show updated file tree, and list how to test.

## Output

Your response should include:

1. **Detailed research report** (like above SRS) covering all bullet points, with citations.  
2. A **Gemini prompt** (this document) that encompasses tasks 1–6 clearly.  
3. The **`BACKEND_CONTEXT.md` content** (fully detailed, copy-pasteable) covering tech stack, env vars, run/test commands, schema overview, etc.

Organize the report with clear headings, bullet lists, tables, and mermaid diagrams. Be thorough and analytical. Use English (en-IN). Provide relevant links/citations for factual claims.  

Do **not** write code yet; just produce the report, prompt, and context file content as outlined. 
:::

# BACKEND_CONTEXT.md

```markdown
# CivicFlow Backend – Context and Configuration

This file contains all key information and decisions for the CivicFlow backend. It serves as a reference for environment setup, architecture, and common commands.

## 1. Tech Stack

- **Language**: Node.js (latest LTS, e.g. v18 or above).
- **Framework**: Express.js (using Routers, middleware).
- **Database**: Supabase (Managed PostgreSQL).
- **ORM/DB Client**: `pg` library (built-in connection pooling) or optional query builder (Knex/Prisma). Use prepared statements.
- **Cache/Queue**: Redis (for caching and BullMQ job queue).
- **AI Services**: Groq API (primary), NVIDIA NIM API (fallback).
- **Storage**: Supabase Storage (for images).
- **Authentication**: Supabase Auth (JWT tokens).
- **Deployment**: Local dev; later to Vercel (frontend), Render/Railway (backend).
- **CI/CD**: Git + GitHub. Use GitHub Actions for lint/test.

## 2. Architecture Decisions

- **Stateless Backend**: All Node instances are stateless. No in-memory session sharing. Use JWT/Redis for session or cache if needed.
- **Cluster Mode**: On multi-core machines, run one Node.js instance per CPU core (using `pm2` or Node’s `cluster` module).
- **Reverse Proxy**: In production, use Nginx (or cloud LB) for TLS and gzip compression.
- **Connection Pooling**: Use application-side pooling (`pg.Pool`). Supabase provides a pooler (Supavisor) in front of Postgres.
- **Database Scaling**: Monitor Supabase DB CPU. If CPU >70%, upgrade compute. If read-heavy (>80% reads), consider adding read replicas.
- **Caching**: Use in-memory LRU for hot, small data; Redis for shared caching (e.g. session, repeated queries).
- **Job Queue**: Use BullMQ (Redis-backed) for background tasks.
- **Fault Tolerance**: Wrap AI HTTP calls with retries and a circuit breaker (Opossum). Always have a fallback path if AI fails (log and continue).
- **Logging**: Use Pino (fast, async) for structured JSON logs.
- **Metrics/Tracing**: Integrate `prom-client` for Prometheus, and OpenTelemetry for distributed traces.
- **Env Config**: Use `.env` (or export vars) for all secrets. Never commit keys. Example vars:
  - `PORT=5000`
  - `DB_URL=postgresql://...supabase.co:5432/postgres`
  - `DB_SCHEMA=public`
  - `REDIS_URL=redis://localhost:6379`
  - `GROQ_API_KEY=sk-...`
  - `NVIDIA_API_KEY=...`
  - `SUPABASE_URL=https://xyz.supabase.co`
  - `SUPABASE_SERVICE_KEY=...` (for server SDK if needed)
  - `JWT_SECRET=...`
  - `NODE_ENV=development` (use `production` in real deployment)

## 3. Database Schema (PostgreSQL)

Example tables and fields (expand as needed):

- **users**: `(id UUID PK, email TEXT UNIQUE, password_hash TEXT, role TEXT CHECK (role IN ('citizen','officer','admin')), created_at TIMESTAMP DEFAULT now())`.
- **departments**: `(id UUID PK, name TEXT, created_at TIMESTAMP)`.
- **complaints**: `(id UUID PK, title TEXT, description TEXT, image_url TEXT, status TEXT DEFAULT 'Submitted', category TEXT, priority TEXT, location GEOGRAPHY, user_id UUID FK REFERENCES users(id), department_id UUID FK REFERENCES departments(id), created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP)`.  
  Indexes: `INDEX ON complaints(user_id)`, `INDEX ON complaints(status)`, `INDEX ON complaints(created_at)`, etc. Use `BTREE` by default.
- **complaint_updates**: `(id UUID PK, complaint_id UUID FK, message TEXT, created_at TIMESTAMP)`.
- **ratings**: `(id UUID PK, complaint_id UUID FK, rating INT CHECK(rating>=1 AND rating<=5), comment TEXT, user_id UUID, created_at TIMESTAMP)`.
- **notifications**: `(id UUID PK, user_id UUID FK, message TEXT, is_read BOOL DEFAULT false, created_at TIMESTAMP)`.

All tables have `created_at` and `updated_at` fields. Use `UUID` (with `uuid-ossp` or `gen_random_uuid()`).

## 4. Folder Structure

```
backend/
├── src/
│   ├── app.js            # Express app setup
│   ├── server.js         # Starts server (with clustering if needed)
│   ├── config/           # Configuration (db, env)
│   ├── routes/           # Express routes per resource (e.g. auth.js, complaints.js)
│   ├── controllers/      # Route handlers (business logic)
│   ├── services/         # Service layer (DB access, AI calls, etc.)
│   ├── middleware/       # Express middleware (auth, error-handler, rate-limit)
│   ├── models/           # DB query functions (could use an ORM or raw SQL here)
│   ├── utils/            # Helper functions (e.g. pagination helpers)
│   └── jobs/            # Background job processors (BullMQ workers)
├── tests/                # (Optional) Unit/integration tests
├── .env                  # Environment variables (not committed)
├── package.json
└── README.md             # Setup instructions
```

This modular structure separates concerns. For example, `AIService.js` in `services/` will handle Groq/NVIDIA calls. `cache.js` in `utils/` might hold Redis cache helpers.

## 5. Key Code Snippets

- **Connection Pool (pg):**
  ```js
  // config/db.js
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DB_URL, max: 20 });
  module.exports = pool;
  ```
- **Express Setup with Compression & Rate Limit:**
  ```js
  const express = require('express');
  const compression = require('compression');
  const rateLimit = require('express-rate-limit');
  const RedisStore = require('rate-limit-redis');
  const Redis = require('ioredis');

  const app = express();
  app.use(compression());
  app.use(express.json());
  // Rate limiter: 100 req per 15min per IP
  const redisClient = new Redis(process.env.REDIS_URL);
  app.use(rateLimit({
    store: new RedisStore({ sendCommand: (...args) => redisClient.call(...args) }),
    windowMs: 15 * 60 * 1000,
    max: 100
  }));
  ```
- **Cursor Pagination Example (SQL):**
  ```sql
  -- In controller or model
  const query = `
    SELECT * FROM complaints
    WHERE (created_at < $1 OR $1 IS NULL)
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const params = [cursorTimestamp, limit];
  ```
- **Redis Cache (cache-aside):**
  ```js
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL);

  async function getCached(key, fetchFn, ttl=60) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
    const data = await fetchFn();
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
    return data;
  }
  // Usage in controller:
  // const users = await getCached('all_users', () => db.query('SELECT * FROM users'), 300);
  ```
- **BullMQ Queue Example:**
  ```js
  // producer (e.g. after creating complaint)
  const { Queue } = require('bullmq');
  const queue = new Queue('complaints', { connection: { host: 'localhost', port: 6379 } });
  queue.add('categorize', { complaintId: newId });

  // worker (in a separate file/process)
  const { Worker } = require('bullmq');
  const worker = new Worker('complaints', async job => {
    const { complaintId } = job.data;
    // Call Groq AI, update DB with category/priority
  }, { connection: { host: 'localhost', port: 6379 } });
  ```
- **AI Service (Groq/NVIDIA):**
  ```js
  async function categorizeComplaint(text) {
    try {
      const res = await axios.post('https://api.groq.ai/v1/categorize', { text }, {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
      });
      return res.data; // assume { category, priority, summary }
    } catch (err) {
      // Fallback to NVIDIA NIM
      const res2 = await axios.post('https://api.nvidia.com/nim/analyze', { text }, {
        headers: { 'Ocp-Apim-Subscription-Key': process.env.NVIDIA_API_KEY }
      });
      return res2.data;
    }
  }
  ```
  Handle timeouts and errors so failures don’t crash the app.

## 6. Environment & Running

- Ensure `.env` contains all required vars listed above.  
- Install dependencies: `npm install express pg ioredis bullmq compression express-rate-limit pino @opentelemetry/api`.  
- Start server in dev mode: `npm run dev` (with a tool like `nodemon`).  
- Server listens on `http://localhost:${PORT}` (default 5000). Test with `curl http://localhost:5000/healthz`.

## 7. Testing & CI

- Run lint: `npm run lint`.  
- Run any tests: `npm test`.  
- For load testing: use included k6 script (e.g. `k6 run loadtest.js`).  
- Check database connectivity: e.g. hit `/healthz` or a simple route that queries `SELECT 1`.  

## 8. Milestones (Summary)

- **Milestone 1:** Project init, basic server, DB ping.  
- **Milestone 2:** DB schema setup (SQL or migrations).  
- **Milestone 3:** Auth endpoints (register/login).  
- **Milestone 4:** Complaints CRUD, including image upload stub.  
- **Milestone 5:** Dashboard APIs (user-specific data).  
- **Milestone 6:** Officer/Admin endpoints.  
- **Milestone 7:** AI and background jobs.  
- **Milestone 8:** Caching, Rate-limit.  
- **Milestone 9:** Monitoring/metrics.  
- **Milestone 10:** CI/CD and polish.

Each milestone should produce a working backend slice.

```