# SpendWise AI — Detailed To-Do List

---

## PHASE 0 — Project Setup & Infrastructure

### Monorepo & Tooling
- [ ] Initialize monorepo root with `package.json` (workspaces)
- [ ] Create folder structure: `apps/web`, `apps/api`, `apps/mcp-server`, `packages/shared-types`, `packages/config`, `infra/db`, `infra/scripts`
- [ ] Set up root-level `tsconfig.base.json` shared across all apps
- [ ] Set up root-level ESLint + Prettier config
- [ ] Add `.gitignore` (node_modules, .env, dist, .next)
- [ ] Initialize git repo and push to GitHub

### Docker Compose (Local Dev)
- [ ] Write `docker-compose.yml` with services: `web`, `api`, `postgres`, `redis`
- [ ] Add pgvector to postgres image (`ankane/pgvector` or `pgvector/pgvector`)
- [ ] Add `mcp-server` service to compose
- [ ] Add `.env.example` with all required env vars documented
- [ ] Verify all services start cleanly with `docker compose up`

### CI/CD
- [ ] GitHub Actions: lint + typecheck on every push
- [ ] GitHub Actions: run tests on every push and PR
- [ ] Add branch protection on `main`

---

## PHASE 1 — Database & Migrations

### Setup
- [ ] Install and configure Prisma (or Drizzle) in `apps/api`
- [ ] Connect to PostgreSQL via `DATABASE_URL` in `.env`
- [ ] Enable `pgvector` extension in initial migration (`CREATE EXTENSION IF NOT EXISTS vector`)

### Schema & Migrations
- [ ] Migration: `users` table (id, email, password_hash, created_at)
- [ ] Migration: `transactions` table (id, user_id, date, merchant, amount, currency, category, type, raw_text, embedding vector(1536))
- [ ] Migration: `subscriptions` table (id, user_id, merchant, estimated_cycle_days, avg_amount, confidence_score, last_charge_date, next_expected_date)
- [ ] Migration: `insights` table (id, user_id, week_start, summary_json, created_at)
- [ ] Migration: `documents` table (id, user_id, filename, content_type, uploaded_at)
- [ ] Migration: `document_chunks` table (id, document_id, user_id, chunk_text, chunk_index, embedding vector(1536))
- [ ] Add HNSW index on `transactions.embedding` for fast similarity search
- [ ] Add HNSW index on `document_chunks.embedding`
- [ ] Seed script with sample transactions for dev/testing

---

## PHASE 2 — Backend: Auth Module

### NestJS App Bootstrap
- [ ] Scaffold NestJS app in `apps/api`
- [ ] Install dependencies: `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `bcrypt`, `class-validator`, `class-transformer`
- [ ] Set up `ConfigModule` with env validation
- [ ] Set up global validation pipe

### Auth Implementation
- [ ] `POST /auth/signup` — hash password with bcrypt, create user, return JWT
- [ ] `POST /auth/login` — verify credentials, return access token + refresh token
- [ ] `POST /auth/logout` — invalidate refresh token
- [ ] `POST /auth/refresh` — issue new access token from refresh token
- [ ] JWT strategy (Passport) for protecting routes
- [ ] Auth guard applied globally, with `@Public()` decorator for open routes
- [ ] Store refresh tokens in Redis with TTL

### Shared Types
- [ ] Define `User`, `AuthTokens` types in `packages/shared-types`

---

## PHASE 3 — Backend: CSV Upload & Transaction Ingestion

### Upload Endpoint
- [ ] `POST /uploads/csv` — accept multipart file with `multer`
- [ ] Validate file type (CSV only), max size limit
- [ ] Rate limit: max 5 uploads per user per hour (Redis-backed)

### CSV Parser
- [ ] Parse CSV rows with `papaparse` or `csv-parse`
- [ ] Normalize column names (handle different bank formats: date, merchant, amount, type)
- [ ] Validate each row: required fields, date format, numeric amount
- [ ] Collect and return per-row errors to UI (don't fail entire upload on one bad row)

### Idempotency
- [ ] Hash each row (date + merchant + amount) to generate a dedup key
- [ ] Skip rows where dedup key already exists for this user
- [ ] Return import summary: inserted, skipped, failed counts

### Storage
- [ ] Bulk insert valid transactions into PostgreSQL
- [ ] Trigger background job to embed new transactions (BullMQ queue)

---

## PHASE 4 — Backend: Categorization

### Rules Engine
- [ ] Define keyword → category map (food, travel, utilities, entertainment, health, shopping, subscriptions, income)
- [ ] Apply rules on import: assign `category` based on `merchant` keyword matching
- [ ] Case-insensitive matching, partial match support

### Manual Recategorization
- [ ] `PATCH /transactions/:id` — allow user to update category
- [ ] Validate category is a known enum value

### Aggregation
- [ ] `GET /summary/monthly?month=&year=` — return total + per-category breakdown
- [ ] `GET /summary/category?category=` — return trend over last 6 months for a category

---

## PHASE 5 — Backend: Recurring Subscription Detection

### Detection Algorithm
- [ ] Group user's transactions by normalized merchant name
- [ ] For each merchant with 2+ transactions, compute intervals between dates
- [ ] Detect approximate periodicity: ~7d (weekly), ~30d (monthly), ~90d (quarterly), ~365d (annual)
- [ ] Compute confidence score based on interval consistency (stddev)
- [ ] Compute average amount and flag amount variance

### Subscriptions Module
- [ ] `GET /subscriptions` — return detected subscriptions with confidence score, avg amount, next expected date
- [ ] `POST /subscriptions/:id/dismiss` — user can dismiss a false positive
- [ ] `POST /subscriptions/:id/confirm` — user confirms a detected subscription
- [ ] Re-run detection job after each new CSV import (BullMQ)

---

## PHASE 6 — Backend: Leak Detection

### Leak Rules
- [ ] Flag subscriptions with confidence > 0.7 and last used > 60 days ago
- [ ] Detect price creep: same merchant, amount increased >10% vs 3-month avg
- [ ] Detect duplicate subscriptions: same category, similar amounts, same cycle
- [ ] Rank leaks by estimated annual waste

### Leak Endpoint
- [ ] `GET /insights/leaks` — return ranked list of detected leaks with reason and estimated savings

---

## PHASE 7 — Backend: AI Assistant (Claude API)

### Setup
- [ ] Install Anthropic SDK in `apps/api`
- [ ] Store `ANTHROPIC_API_KEY` in env, never log it
- [ ] Add rate limiting on AI endpoints (per user, Redis-backed)

### Recommendations Endpoint
- [ ] `POST /ai/recommendations` — aggregate user stats (top categories, top subscriptions, leaks), send to Claude
- [ ] Prompt: structured output schema (top 3 leaks, estimated monthly savings, 5-step action checklist, uncertainty notes)
- [ ] Parse and validate Claude's JSON response with `class-validator`
- [ ] Cache result in Redis for 1 hour per user (avoid re-calling for same data)
- [ ] Return structured response to frontend

### Prompt Design
- [ ] System prompt: role as a personal finance advisor, no investment promises, suggest not guarantee
- [ ] Include: total spend by category, top merchants, detected subscriptions + confidence, flagged leaks
- [ ] Constrain output to JSON schema using Claude's structured output / tool use feature
- [ ] Add guardrail: if user data is insufficient, return a "not enough data" response gracefully

---

## PHASE 8 — RAG Pipeline

### Embedding on Ingest
- [ ] After CSV import, queue embedding job via BullMQ
- [ ] Embedding worker: for each new transaction, generate embedding from `"${merchant} ${category} ${amount} ${date}"`
- [ ] Store embedding in `transactions.embedding` (pgvector)
- [ ] Batch embed for efficiency (embed up to 100 rows per API call)

### PDF Upload (V2)
- [ ] `POST /uploads/pdf` — accept PDF file
- [ ] Parse PDF text with `pdf-parse` or `pdfjs-dist`
- [ ] Chunk text: ~300 tokens per chunk, 50-token overlap
- [ ] Embed each chunk, store in `document_chunks` table
- [ ] Link chunks to parent document and user

### Semantic Search
- [ ] `GET /search/transactions?q=` — embed query, run pgvector cosine similarity search, return top-k transactions
- [ ] Scope all vector queries by `user_id` (critical for privacy)
- [ ] Return results ranked by similarity score

### RAG Chat Endpoint
- [ ] `POST /ai/chat` — accept user question
- [ ] Embed the question
- [ ] Retrieve top-k relevant transaction chunks + document chunks via pgvector
- [ ] Build context: inject retrieved chunks + user's monthly summary into Claude prompt
- [ ] Stream Claude response back to frontend (SSE or chunked transfer)
- [ ] Cite which transactions / documents the answer is grounded in

---

## PHASE 9 — MCP Server

### Setup
- [ ] Scaffold `apps/mcp-server` (standalone Node.js + TypeScript)
- [ ] Install `@anthropic-ai/sdk` MCP server utilities
- [ ] Connect MCP server to same PostgreSQL database (read-only queries)

### Tools to Expose
- [ ] `get_spending_summary(user_id, month, year)` — returns total + category breakdown
- [ ] `get_subscriptions(user_id)` — returns detected subscriptions with confidence scores
- [ ] `find_anomalies(user_id, category?)` — returns flagged leaks and price increases
- [ ] `get_recommendations(user_id)` — returns cached AI recommendations or triggers fresh generation
- [ ] `search_transactions(user_id, query)` — semantic search via pgvector
- [ ] `get_monthly_trend(user_id, months?)` — returns month-over-month spend trend

### Auth & Security
- [ ] MCP server requires an API key per user (issued from SpendWise backend)
- [ ] All tool calls scoped to the authenticated user's data only
- [ ] No write operations exposed via MCP (read-only tools)

### Testing
- [ ] Test all tools manually via Claude Desktop
- [ ] Add unit tests for each tool handler
- [ ] Document MCP server setup in README

---

## PHASE 10 — Background Jobs (BullMQ)

### Setup
- [ ] Configure BullMQ with Redis in `apps/api`
- [ ] Create queues: `embedding-queue`, `subscription-detection-queue`, `alert-queue`
- [ ] Add Bull Dashboard (read-only) for monitoring job status

### Jobs
- [ ] Embedding job: triggered after CSV import, embeds new transactions
- [ ] Subscription detection job: runs after import, updates subscriptions table
- [ ] Weekly alert job: scheduled cron (every Monday 9am), sends email summary
- [ ] Retry policy: 3 retries with exponential backoff
- [ ] Dead-letter queue: log failed jobs for inspection

### Email Alerts
- [ ] Integrate Resend (or Nodemailer + SMTP) for sending emails
- [ ] Weekly summary email template: top spend, subscription count, top leak, AI action of the week
- [ ] `POST /alerts/test` — trigger a test email for the logged-in user

---

## PHASE 11 — Frontend (Next.js)

### Setup
- [ ] Scaffold Next.js app in `apps/web` with App Router + TypeScript
- [ ] Install: Tailwind CSS, Recharts, `@tanstack/react-query`, `axios`, `react-hook-form`, `zod`
- [ ] Set up API client (axios instance with auth token injection)
- [ ] Set up React Query for server state management
- [ ] Set up Zustand or Context for auth state

### Auth Pages
- [ ] `/login` — email + password form, JWT stored in httpOnly cookie
- [ ] `/signup` — registration form with validation
- [ ] Redirect unauthenticated users to `/login`

### Dashboard Page (`/dashboard`)
- [ ] "This month spend" summary card
- [ ] Category pie chart (Recharts)
- [ ] Month-over-month bar chart
- [ ] Recurring charges list (top 5)
- [ ] Leak alerts panel
- [ ] AI action plan card (fetch from `/ai/recommendations`)
- [ ] "Ask AI" input (RAG chat entry point)

### Transactions Page (`/transactions`)
- [ ] Paginated transaction table
- [ ] Filter by category, date range, merchant
- [ ] Inline category edit (manual recategorization)
- [ ] CSV upload button + drag-and-drop zone
- [ ] Upload progress and result summary (inserted / skipped / failed)

### Subscriptions Page (`/subscriptions`)
- [ ] List of detected subscriptions: merchant, amount, cycle, confidence score, next expected date
- [ ] "Dismiss" and "Confirm" actions per subscription
- [ ] Estimated annual cost per subscription
- [ ] Total recurring monthly cost summary

### Insights Page (`/insights`)
- [ ] Leaks list with severity ranking and estimated savings
- [ ] Price creep alerts (subscription amount increased)
- [ ] Month comparison widget

### AI Chat Page (`/insights` or separate `/chat`)
- [ ] Chat interface (user message + Claude response)
- [ ] Stream Claude response token-by-token (SSE)
- [ ] Show source citations (which transactions the answer is based on)
- [ ] Suggested questions (e.g. "What did I spend most on last month?")

### Settings Page (`/settings`)
- [ ] Profile info
- [ ] Change password
- [ ] Delete account + all data (GDPR-style)
- [ ] MCP API key management (generate / revoke)

---

## PHASE 12 — Security & Privacy

- [ ] All API routes protected by JWT auth guard (except /auth/*)
- [ ] All DB queries filtered by `user_id` (no cross-user data leakage)
- [ ] All vector search queries scoped by `user_id`
- [ ] Rate limiting: upload endpoints (5/hour), AI endpoints (20/hour), auth endpoints (10/min)
- [ ] No raw transaction data in application logs
- [ ] Secrets only in env vars, never committed
- [ ] `DELETE /users/me` — hard deletes user + all associated data (transactions, subscriptions, insights, embeddings, documents)
- [ ] Input sanitization on all endpoints (class-validator DTOs)
- [ ] CORS configured to allow only frontend origin

---

## PHASE 13 — Testing

### Unit Tests
- [ ] CSV parser: various bank formats, bad rows, edge cases
- [ ] Categorization rules engine: keyword matching, case handling
- [ ] Recurring detection: interval calculation, confidence scoring
- [ ] RAG chunking: chunk size, overlap, edge cases

### Integration Tests
- [ ] `POST /uploads/csv` → rows in DB → embeddings queued
- [ ] Auth flow: signup → login → protected route → refresh → logout
- [ ] AI endpoint: valid response schema, graceful fallback on insufficient data
- [ ] MCP tool: `get_spending_summary` returns correct aggregated data

### E2E Tests
- [ ] Signup → upload CSV → view dashboard with category breakdown
- [ ] Ask RAG question → receive grounded answer referencing real transactions
- [ ] Detect subscription → dismiss it → no longer appears

---

## PHASE 14 — Deployment

### Local
- [ ] `docker compose up` starts all services cleanly
- [ ] Migrations run automatically on API startup
- [ ] BullMQ workers start automatically

### Staging
- [ ] Deploy PostgreSQL + Redis on Railway (or Render)
- [ ] Run `prisma migrate deploy` on staging DB
- [ ] Deploy `apps/api` on Railway (set all env vars)
- [ ] Deploy `apps/mcp-server` on Railway (publicly accessible URL)
- [ ] Deploy `apps/web` on Vercel (set `NEXT_PUBLIC_API_URL`)
- [ ] Smoke test all endpoints on staging

### Production
- [ ] Set up automated DB backups on Railway
- [ ] Add Prometheus metrics endpoint to API
- [ ] Set up Grafana dashboard for request rates, job queue depth, error rates
- [ ] Add Bull Dashboard (behind auth) for job monitoring
- [ ] Configure Sentry (or similar) for error tracking
- [ ] Add uptime monitoring (Better Uptime or UptimeRobot)

---

## PHASE 15 — Polish & Resume Readiness

- [ ] Write `README.md` with: architecture diagram, tech stack, setup instructions, screenshots
- [ ] Record a short demo video (Loom) walking through: upload CSV → dashboard → AI insights → RAG chat
- [ ] Add architecture diagram (draw.io or Excalidraw) to README
- [ ] Add live demo URL to README and GitHub repo description
- [ ] Clean up all `TODO` comments and dead code
- [ ] Final review: all pages work on mobile (responsive Tailwind)
- [ ] Performance: API response times under 300ms for non-AI endpoints
- [ ] Add SpendWise to resume with the resume bullet from `SpendWise.md`
- [ ] Write a short LinkedIn post about the MCP server integration (differentiator)
