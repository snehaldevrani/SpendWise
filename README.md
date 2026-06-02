?# SpendWise

**An AI-powered personal finance manager for Indian users.**

Upload your bank statement once. SpendWise automatically categorises every transaction, detects recurring subscription charges, computes weekly spending summaries, lets you set monthly budgets, and gives you an AI assistant that answers questions grounded in your *own* transaction history — not generic advice.

> Built with NestJS · Next.js 15 · PostgreSQL + pgvector · Redis · Google Gemini 2.5 Flash

**Live demo:** [spendwise-web-nine.vercel.app](https://spendwise-web-nine.vercel.app) &nbsp;|&nbsp; **API:** [spendwise-api-q01j.onrender.com/api/docs](https://spendwise-api-q01j.onrender.com/api/docs)

> The Render free tier spins down after 15 min of inactivity — first request may take ~30 s.

---

## Features

| Feature | Details |
|---------|---------|
| **Multi-bank CSV import** | HDFC, ICICI, SBI, Axis Bank — automatic column alias normalisation, magic-byte validation, deduplication |
| **Smart categorisation** | 9 categories (Food, Travel, Utilities, Entertainment, Health, Shopping, Subscriptions, Income, Other) — keyword-based auto-classify, inline editing |
| **Subscription leak detection** | Confidence-scored recurring charge detection across 6 billing cycles (7/14/30/90/180/365 days); flags unused subscriptions with annual cost |
| **Monthly budgets** | Set per-category spending limits; live progress bars, prorated month-end forecast, health score |
| **6-month category trends** | Stacked bar chart showing month-by-month spend across all categories |
| **Weekly spending summaries** | ISO-week groupings with total spend, income, category breakdown, top merchants |
| **RAG AI chat** | Ask questions about your own finances; Gemini `gemini-embedding-2` embeddings + pgvector cosine search provides supplemental context; full transaction history injected into every prompt for factually accurate answers |
| **AI recommendations** | Structured savings recommendations: top leaks, estimated monthly savings, action checklist — Redis-cached 6h, per-user rate limited |
| **Weekly email digest** | Every Monday: last week's spend, income, net savings, top categories and merchants — opt-in via Settings |
| **Email alerts** | New subscription leak detected → immediate notification |
| **Secure auth** | httpOnly SameSite=Lax cookies, bcrypt refresh tokens, silent 401 rotation, per-user AI rate limits |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15.5 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Backend | NestJS 10, TypeScript 5, Passport JWT, class-validator |
| Database | PostgreSQL 16 + pgvector (768-dim, HNSW index) |
| ORM | Prisma 5 |
| Cache / Queue | Redis 7 + BullMQ 5 |
| AI — chat & recs | Google Gemini `gemini-2.5-flash` (Google Generative AI SDK) |
| AI — embeddings | Google Gemini `gemini-embedding-2` (768 dims, matryoshka truncation) |
| Email | Resend |
| State | TanStack Query 5, Zustand 5 |
| Charts | Recharts 3 |
| Monorepo | Turborepo / npm workspaces |
| Containers | Docker + Docker Compose |
| CI | GitHub Actions |

---

## AI Stack — Migration from Claude + Voyage to Gemini

SpendWise originally shipped with **Claude Sonnet 4.6** (Anthropic) for chat and recommendations, and **Voyage AI `voyage-3-lite`** for embeddings. That stack worked well:

- Claude's structured JSON output mode produced reliably parseable recommendation payloads
- Voyage AI's `voyage-3-lite` model was specifically tuned for short multilingual text, which suited Indian bank transaction descriptions well
- Embeddings were stored as 512-dim vectors with an HNSW index in pgvector

**Why the migration?**

Cost. Running Claude Sonnet 4.6 at even moderate traffic is expensive — Anthropic charges per input/output token with no free tier. Voyage AI similarly has no meaningful free tier. For a personal project or early-stage product, this was unsustainable.

Google Gemini provides a **generous free tier** via Google AI Studio (`gemini-2.5-flash` and `gemini-embedding-2` are both available on the free plan), which made the switch an easy cost-cutting decision without compromising capability.

**What changed:**

| Component | Before | After |
|-----------|--------|-------|
| Chat / Recommendations | Claude Sonnet 4.6 (Anthropic SDK) | `gemini-2.5-flash` (Google Generative AI SDK) |
| Embeddings | Voyage AI `voyage-3-lite` (512-dim) | `gemini-embedding-2` with `outputDimensionality: 768` |
| API key env var | `ANTHROPIC_API_KEY` + `VOYAGE_API_KEY` | `GEMINI_API_KEY` (single key) |
| DB vector column | `vector(512)` | `vector(768)` |
| SDK | `@anthropic-ai/sdk` + `voyageai` | `@google/generative-ai` |

**Noteworthy engineering detail — matryoshka truncation:** `gemini-embedding-2` natively outputs 3072-dim vectors. The Google SDK accepts an `outputDimensionality` parameter that truncates using matryoshka representation learning — meaning the first N dimensions of a longer embedding preserve the same semantic quality as a native N-dim model. Setting `outputDimensionality: 768` keeps the DB schema lean while retaining strong retrieval quality.

**What stayed the same:** The RAG architecture, pgvector cosine search, HNSW index, BullMQ job pipeline, and all rate-limiting logic are unchanged. The migration was purely a provider swap — no business logic was rewritten.

---

## Project Structure

```text
SpendWise/
├── apps/
│   ├── api/                    NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           JWT auth, httpOnly cookies, refresh rotation
│   │   │   │   ├── users/          Profile + notification preferences (GET/PATCH)
│   │   │   │   ├── transactions/   CRUD, filters, category edit, overview stats
│   │   │   │   ├── uploads/        CSV/XLSX parsing, magic-byte validation
│   │   │   │   ├── subscriptions/  Recurring charge detection + dismiss/confirm
│   │   │   │   ├── budgets/        Monthly budget CRUD, forecast, health score
│   │   │   │   ├── insights/       ISO-week summaries, category trends
│   │   │   │   ├── ai/             Gemini 2.5 Flash recs + RAG chat, rate limits
│   │   │   │   ├── rag/            Gemini embedding-2 (768-dim), pgvector search
│   │   │   │   └── alerts/         Resend email alerts
│   │   │   ├── jobs/
│   │   │   │   ├── import.processor.ts   BullMQ: embed → detect → insights
│   │   │   │   └── digest/               Weekly email cron (Mon 08:00 IST)
│   │   │   ├── common/             Prisma service, Redis cache, JWT guard
│   │   │   ├── main.ts             HTTP server entry (Helmet CSP, CORS, Swagger)
│   │   │   └── worker.ts           Separate BullMQ worker entry point
│   │   └── prisma/
│   │       ├── schema.prisma       All models (User, Transaction, Budget, …)
│   │       └── migrations/         All applied migrations
│   │
│   └── web/                    Next.js 15 frontend (port 3000)
│       ├── app/
│       │   ├── (auth)/             /login, /signup
│       │   └── (dashboard)/
│       │       ├── dashboard/      Stat cards, area chart, recent transactions
│       │       ├── transactions/   Table, search, filters, CSV export, inline edit
│       │       ├── subscriptions/  Leak cards, dismiss/confirm
│       │       ├── budgets/        Budget CRUD, progress bars, forecast
│       │       ├── insights/       AI chat, weekly cards, 6-month trends chart
│       │       └── settings/       Notification preferences
│       ├── components/             shadcn/ui + custom layout components
│       ├── store/                  Zustand: auth, UI state
│       └── lib/api.ts              Axios + TanStack Query, 401 race-condition fix
│
└── packages/
    └── shared-types/               TransactionCategory, AuthTokens, AiRecommendation…
```

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 16** with the `pgvector` extension (`CREATE EXTENSION IF NOT EXISTS vector;`)
- **Redis 7**

### 1. Clone and install

```bash
git clone https://github.com/snehaldevrani/SpendWise.git
cd SpendWise
npm install
```

### 2. Configure environment variables

```bash
# API
cp apps/api/.env.example apps/api/.env

# Web (only one variable needed)
cp apps/web/.env.example apps/web/.env.local
```

Fill in `apps/api/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/spendwise?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="<min 32 chars>"
JWT_REFRESH_SECRET="<min 32 chars>"
GEMINI_API_KEY="AIzaSy..."          # from aistudio.google.com/apikey — starts with AIzaSy
RESEND_API_KEY="re_..."             # optional — app works without it
RESEND_FROM_EMAIL="alerts@yourdomain.com"
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

API keys:
- **Google Gemini** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier)
- **Resend** — [resend.com](https://resend.com) (optional, for email alerts)

### 3. Set up the database

```bash
cd apps/api
npx prisma migrate deploy    # apply all migrations (includes pgvector extension + HNSW index)
npx prisma generate          # generate Prisma client
cd ../..
```

### 4. Run in development

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001/api |
| Swagger docs | http://localhost:3001/api/docs |

---

## Docker (recommended for production)

The `docker-compose.yml` spins up all 5 services:

```bash
# Create a .env file at the repo root with your secrets (same keys as apps/api/.env)
cp apps/api/.env.example .env

docker compose up --build
```

| Container | Role |
|-----------|------|
| `postgres` | PostgreSQL 16 + pgvector |
| `redis` | Redis 7 |
| `api` | NestJS HTTP server — runs `prisma migrate deploy` on startup |
| `worker` | BullMQ import-queue processor (separate process, no HTTP) |
| `web` | Next.js standalone build |

---

## How to Use

### 1. Create an account

Go to `/signup`, enter your email and a password.

### 2. Export your bank statement

SpendWise supports **HDFC, ICICI, SBI, and Axis Bank** CSV/XLSX formats.

| Bank | Export path |
|------|------------|
| HDFC | Net Banking → Accounts → Download Statement → CSV |
| ICICI | Net Banking → Statements → Download → Excel/CSV |
| SBI | YONO / Net Banking → e-Statements → Date range → Download CSV |
| Axis | Net Banking → Accounts → Account Statement → CSV Download |

The file must include at minimum: a **date column**, a **description/narration column**, and **debit/credit amount columns**. Column names are normalised automatically.

### 3. Upload

Click **Upload Statement** from the sidebar or dashboard. After upload, three background jobs run:

1. **Embed** — each transaction is embedded with Gemini `gemini-embedding-2` (768-dim) and stored in pgvector
2. **Detect subscriptions** — recurring charges are scored and flagged
3. **Compute insights** — weekly summaries are calculated

Processing typically completes in under 30 seconds.

### 4. Dashboard

The dashboard shows:
- This month's spend, last month's spend, net savings, active subscription count
- Daily spending area chart (last 60 days)
- Monthly category donut chart
- 5 most recent transactions
- AI savings recommendation card

### 5. Transactions

Full transaction table with search, category filter, and date range filter. Edit any category inline if the auto-classification is wrong. Export the current filtered view as CSV.

### 6. Subscriptions

Recurring charges detected by the algorithm, each showing:
- Billing cycle (weekly / monthly / annual / custom)
- Confidence score
- Estimated annual cost
- **Likely unused** flag if no recent charge

Click **Dismiss** on false positives (e.g. rent). Click **Confirm** to lock in a detected subscription.

### 7. Budgets

Set per-category monthly spending limits. Each budget card shows:
- Live progress bar (green → amber → red as you approach the limit)
- Prorated month-end forecast
- Remaining balance
- Overall budget health score

### 8. Insights

Two panels:
- **6-month category trends** — stacked bar chart across the last 6 months
- **Weekly insight cards** — spend/income/savings per ISO week with category breakdown and top merchants

### 9. AI Chat

Ask any question about your spending history. The assistant retrieves your most relevant transactions before answering.

**Example questions:**
- "How much did I spend on food in April?"
- "What was my biggest single expense last month?"
- "Which week did I spend the most overall?"
- "Am I spending more on subscriptions than last quarter?"

Rate limits: 20 chat messages/day · 4 AI recommendation calls/day (per user).

### 10. Settings

Toggle email notifications:
- **Weekly digest** — Monday summary email
- **New subscription alert** — email when a new leak is detected
- **Spending spike alert** — email when weekly spend is unusually high

---

## Security

- Passwords hashed with **bcrypt** (12 rounds)
- Tokens stored in **httpOnly SameSite=Lax cookies** — inaccessible to JavaScript
- Refresh tokens **hashed in the database** — a leaked DB row cannot be replayed
- **Atomic refresh token rotation** — old token deleted and new token inserted in a single Prisma transaction
- **Helmet** with a strict Content Security Policy (`script-src 'self'`, no inline scripts)
- **File upload magic-byte validation** — XLSX/XLS files are rejected if content doesn't match expected binary signatures
- **Per-user AI rate limits** — Redis counters with 24h TTL

---

## Background Job Pipeline

```
CSV upload
    │
    ├─► JOB_EMBED_TRANSACTIONS
    │       Generate Gemini gemini-embedding-2 embeddings (768-dim) → upsert into pgvector
    │
    ├─► JOB_DETECT_SUBSCRIPTIONS
    │       Group by merchant → compute interval stddev → score confidence
    │       → upsert Subscription records → send email alert if new leaks found
    │
    └─► JOB_COMPUTE_INSIGHTS
            Group by ISO week → compute totals, category breakdown, top merchants
            → upsert weekly Insight records

Weekly cron (Mon 08:00 IST):
    └─► Send weekly digest email to opted-in users
```

All jobs use 3-attempt exponential-backoff retry. The BullMQ worker runs as a **separate process** (`worker.ts`) so heavy uploads cannot starve the HTTP server.

---

## API Reference

Full interactive docs available at `http://localhost:3001/api/docs` (Swagger UI).

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/signup` | Create account |
| `POST` | `/api/auth/login` | Login, sets cookies |
| `POST` | `/api/auth/refresh` | Silent token rotation |
| `POST` | `/api/auth/logout` | Clear cookies |
| `POST` | `/api/uploads/csv` | Upload bank statement |
| `GET` | `/api/transactions` | List with pagination, search, filters |
| `PATCH` | `/api/transactions/:id/category` | Edit transaction category |
| `GET` | `/api/transactions/overview` | Dashboard stat cards |
| `GET` | `/api/transactions/category-trends` | 6-month stacked spend data |
| `GET` | `/api/subscriptions` | All detected subscriptions |
| `GET` | `/api/subscriptions/leaks` | Flagged unused subscriptions |
| `GET` | `/api/budgets` | Budget summary for a month |
| `POST` | `/api/budgets` | Create or update a budget |
| `DELETE` | `/api/budgets/:id` | Remove a budget |
| `GET` | `/api/insights` | Weekly insight cards |
| `GET` | `/api/ai/recommendations` | Gemini 2.5 Flash savings advice (cached 6h, rate-limited 4/day) |
| `POST` | `/api/ai/chat` | RAG-augmented AI chat |
| `GET` | `/api/users/preferences` | Notification settings |
| `PATCH` | `/api/users/preferences` | Update notification settings |
| `GET` | `/health` | Health check |

---

## Tests

```bash
npm test --workspace=apps/api
```

---

## Deployment (free tier)

The recommended zero-cost production stack:

| Service | Platform | What runs there | URL |
|---------|----------|-----------------|-----|
| Frontend | [Vercel](https://vercel.com) | Next.js app | [spendwise-web-nine.vercel.app](https://spendwise-web-nine.vercel.app) |
| API | [Render](https://render.com) Web Service | NestJS + BullMQ workers + auto-migrate on startup | [spendwise-api-q01j.onrender.com](https://spendwise-api-q01j.onrender.com) |
| Postgres | [Neon](https://neon.tech) | PostgreSQL 16 + pgvector | — |
| Redis | [Upstash](https://upstash.com) | Redis 7 (`rediss://` TLS) | — |

> **Note:** BullMQ job processors (`JOB_EMBED_TRANSACTIONS`, `JOB_DETECT_SUBSCRIPTIONS`, `JOB_COMPUTE_INSIGHTS`) run inside the API process — no separate worker service required. The `worker.ts` entry point exists for scale-out if needed.

> Render free tier spins down after 15 min of inactivity — first request may take ~30 s. Acceptable for portfolio/demo use.

### Environment variables (Render API service)

```env
DATABASE_URL=<neon postgres connection string>
REDIS_URL=<upstash rediss:// url>
JWT_SECRET=<32+ char random string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<32+ char random string>
JWT_REFRESH_EXPIRES_IN=7d
GEMINI_API_KEY=<from aistudio.google.com/apikey — starts with AIzaSy>
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://<your-vercel-url>.vercel.app
```

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are optional — the app starts and runs fully without them (email alerts are silently skipped).

### Vercel environment variable

```env
NEXT_PUBLIC_API_URL=https://<your-render-api-url>/api
```

### Deploy order

1. **Neon** — create project → copy `DATABASE_URL` (pgvector is pre-installed)
2. **Upstash** — create Redis database → copy `REDIS_URL`
3. **Render API** — new Web Service → Docker → Dockerfile path `./apps/api/Dockerfile` → set all env vars → deploy → copy service URL
4. **Vercel** — import repo → root directory `apps/web` → set `NEXT_PUBLIC_API_URL` → deploy → copy Vercel URL → update `FRONTEND_URL` on Render

The API container runs `prisma migrate deploy` automatically on every startup, so the Neon schema is always in sync with the code.

---

7 test suites · 90 tests · 100% pass rate

| Suite | Coverage |
|-------|---------|
| `auth.service.spec.ts` | Signup, login, token rotation, bcrypt, duplicate email |
| `csv-parser.service.spec.ts` | All Indian bank date formats, split debit/credit columns, amount parsing, deduplication, error handling |
| `subscription-detector.service.spec.ts` | Weekly/monthly/annual detection, confidence scoring, edge cases |
| `insights.service.spec.ts` | ISO week grouping, category aggregation, credit exclusion, merchant ranking |
| `transactions.controller.spec.ts` | Pagination, search clamping, userId guard, filter pass-through |
| `ai.service.spec.ts` | Cache hit, rate limiting, Gemini mock, context injection, malformed response handling |
| `uploads.service.spec.ts` | Magic byte validation, full import flow, duplicate skipping, job enqueueing, cache busting |

