# SpendWise

**An AI-powered personal finance manager for Indian users.**

Upload your bank statement once. SpendWise automatically categorises every transaction, detects recurring subscription charges, computes weekly spending summaries, lets you set monthly budgets, and gives you an AI assistant that answers questions grounded in your *own* transaction history â€” not generic advice.

> Built with NestJS Â· Next.js 15 Â· PostgreSQL + pgvector Â· Redis Â· Claude Sonnet 4.6 Â· Voyage AI

---

## Features

| Feature | Details |
|---------|---------|
| **Multi-bank CSV import** | HDFC, ICICI, SBI, Axis Bank â€” automatic column alias normalisation, magic-byte validation, deduplication |
| **Smart categorisation** | 9 categories (Food, Travel, Utilities, Entertainment, Health, Shopping, Subscriptions, Income, Other) â€” keyword-based auto-classify, inline editing |
| **Subscription leak detection** | Confidence-scored recurring charge detection across 6 billing cycles (7/14/30/90/180/365 days); flags unused subscriptions with annual cost |
| **Monthly budgets** | Set per-category spending limits; live progress bars, prorated month-end forecast, health score |
| **6-month category trends** | Stacked bar chart showing month-by-month spend across all categories |
| **Weekly spending summaries** | ISO-week groupings with total spend, income, category breakdown, top merchants |
| **RAG AI chat** | Ask questions about your own finances; Voyage AI embeddings + pgvector cosine search feeds relevant chunks into Claude Sonnet 4.6 |
| **AI recommendations** | Structured savings recommendations: top leaks, estimated monthly savings, action checklist â€” Redis-cached 6h, per-user rate limited |
| **Weekly email digest** | Every Monday: last week's spend, income, net savings, top categories and merchants â€” opt-in via Settings |
| **Email alerts** | New subscription leak detected â†’ immediate notification |
| **Secure auth** | httpOnly SameSite=Lax cookies, bcrypt refresh tokens, silent 401 rotation, per-user AI rate limits |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15.5 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Backend | NestJS 10, TypeScript 5, Passport JWT, class-validator |
| Database | PostgreSQL 16 + pgvector (1024-dim, HNSW index) |
| ORM | Prisma 5 |
| Cache / Queue | Redis 7 + BullMQ 5 |
| AI â€” chat & recs | Claude Sonnet 4.6 (Anthropic SDK) |
| AI â€” embeddings | Voyage AI `voyage-3-lite` (1024 dims) |
| Email | Resend |
| State | TanStack Query 5, Zustand 5 |
| Charts | Recharts 3 |
| Monorepo | Turborepo / npm workspaces |
| Containers | Docker + Docker Compose |
| CI | GitHub Actions |

---

## Project Structure

```text
SpendWise/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ api/                    NestJS REST API (port 3001)
â”‚   â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”‚   â”œâ”€â”€ modules/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ auth/           JWT auth, httpOnly cookies, refresh rotation
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ users/          Profile + notification preferences (GET/PATCH)
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ transactions/   CRUD, filters, category edit, overview stats
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ uploads/        CSV/XLSX parsing, magic-byte validation
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ subscriptions/  Recurring charge detection + dismiss/confirm
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ budgets/        Monthly budget CRUD, forecast, health score
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ insights/       ISO-week summaries, category trends
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ ai/             Claude Sonnet recs + RAG chat, rate limits
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ rag/            Voyage AI embeddings, pgvector search
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ alerts/         Resend email alerts
â”‚   â”‚   â”‚   â”œâ”€â”€ jobs/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ import.processor.ts   BullMQ: embed â†’ detect â†’ insights
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ digest/               Weekly email cron (Mon 08:00 IST)
â”‚   â”‚   â”‚   â”œâ”€â”€ common/             Prisma service, Redis cache, JWT guard
â”‚   â”‚   â”‚   â”œâ”€â”€ main.ts             HTTP server entry (Helmet CSP, CORS, Swagger)
â”‚   â”‚   â”‚   â””â”€â”€ worker.ts           Separate BullMQ worker entry point
â”‚   â”‚   â””â”€â”€ prisma/
â”‚   â”‚       â”œâ”€â”€ schema.prisma       All models (User, Transaction, Budget, â€¦)
â”‚   â”‚       â””â”€â”€ migrations/         All applied migrations
â”‚   â”‚
â”‚   â””â”€â”€ web/                    Next.js 15 frontend (port 3000)
â”‚       â”œâ”€â”€ app/
â”‚       â”‚   â”œâ”€â”€ (auth)/             /login, /signup
â”‚       â”‚   â””â”€â”€ (dashboard)/
â”‚       â”‚       â”œâ”€â”€ dashboard/      Stat cards, area chart, recent transactions
â”‚       â”‚       â”œâ”€â”€ transactions/   Table, search, filters, CSV export, inline edit
â”‚       â”‚       â”œâ”€â”€ subscriptions/  Leak cards, dismiss/confirm
â”‚       â”‚       â”œâ”€â”€ budgets/        Budget CRUD, progress bars, forecast
â”‚       â”‚       â”œâ”€â”€ insights/       AI chat, weekly cards, 6-month trends chart
â”‚       â”‚       â””â”€â”€ settings/       Notification preferences
â”‚       â”œâ”€â”€ components/             shadcn/ui + custom layout components
â”‚       â”œâ”€â”€ store/                  Zustand: auth, UI state
â”‚       â””â”€â”€ lib/api.ts              Axios + TanStack Query, 401 race-condition fix
â”‚
â””â”€â”€ packages/
    â””â”€â”€ shared-types/               TransactionCategory, AuthTokens, AiRecommendationâ€¦
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
ANTHROPIC_API_KEY="sk-ant-..."
VOYAGE_API_KEY="pa-..."
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="alerts@yourdomain.com"
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

API keys:
- **Anthropic** â€” [console.anthropic.com](https://console.anthropic.com)
- **Voyage AI** â€” [dash.voyageai.com](https://dash.voyageai.com)
- **Resend** â€” [resend.com](https://resend.com)

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
| `api` | NestJS HTTP server â€” runs `prisma migrate deploy` on startup |
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
| HDFC | Net Banking â†’ Accounts â†’ Download Statement â†’ CSV |
| ICICI | Net Banking â†’ Statements â†’ Download â†’ Excel/CSV |
| SBI | YONO / Net Banking â†’ e-Statements â†’ Date range â†’ Download CSV |
| Axis | Net Banking â†’ Accounts â†’ Account Statement â†’ CSV Download |

The file must include at minimum: a **date column**, a **description/narration column**, and **debit/credit amount columns**. Column names are normalised automatically.

### 3. Upload

Click **Upload Statement** from the sidebar or dashboard. After upload, three background jobs run:

1. **Embed** â€” each transaction is embedded with Voyage AI and stored in pgvector
2. **Detect subscriptions** â€” recurring charges are scored and flagged
3. **Compute insights** â€” weekly summaries are calculated

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
- Live progress bar (green â†’ amber â†’ red as you approach the limit)
- Prorated month-end forecast
- Remaining balance
- Overall budget health score

### 8. Insights

Two panels:
- **6-month category trends** â€” stacked bar chart across the last 6 months
- **Weekly insight cards** â€” spend/income/savings per ISO week with category breakdown and top merchants

### 9. AI Chat

Ask any question about your spending history. The assistant retrieves your most relevant transactions before answering.

**Example questions:**
- "How much did I spend on food in April?"
- "What was my biggest single expense last month?"
- "Which week did I spend the most overall?"
- "Am I spending more on subscriptions than last quarter?"

Rate limits: 20 chat messages/day Â· 4 AI recommendation calls/day (per user).

### 10. Settings

Toggle email notifications:
- **Weekly digest** â€” Monday summary email
- **New subscription alert** â€” email when a new leak is detected
- **Spending spike alert** â€” email when weekly spend is unusually high

---

## Security

- Passwords hashed with **bcrypt** (12 rounds)
- Tokens stored in **httpOnly SameSite=Lax cookies** â€” inaccessible to JavaScript
- Refresh tokens **hashed in the database** â€” a leaked DB row cannot be replayed
- **Atomic refresh token rotation** â€” old token deleted and new token inserted in a single Prisma transaction
- **Helmet** with a strict Content Security Policy (`script-src 'self'`, no inline scripts)
- **File upload magic-byte validation** â€” XLSX/XLS files are rejected if content doesn't match expected binary signatures
- **Per-user AI rate limits** â€” Redis counters with 24h TTL

---

## Background Job Pipeline

```
CSV upload
    â”‚
    â”œâ”€â–º JOB_EMBED_TRANSACTIONS
    â”‚       Generate Voyage AI embeddings â†’ upsert into pgvector
    â”‚
    â”œâ”€â–º JOB_DETECT_SUBSCRIPTIONS
    â”‚       Group by merchant â†’ compute interval stddev â†’ score confidence
    â”‚       â†’ upsert Subscription records â†’ send email alert if new leaks found
    â”‚
    â””â”€â–º JOB_COMPUTE_INSIGHTS
            Group by ISO week â†’ compute totals, category breakdown, top merchants
            â†’ upsert weekly Insight records

Weekly cron (Mon 08:00 IST):
    â””â”€â–º Send weekly digest email to opted-in users
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
| `GET` | `/api/ai/recommendations` | Claude Sonnet savings advice |
| `POST` | `/api/ai/chat` | RAG-augmented AI chat |
| `GET` | `/api/users/preferences` | Notification settings |
| `PATCH` | `/api/users/preferences` | Update notification settings |
| `GET` | `/health` | Health check |

---

## Tests

```bash
npm test --workspace=apps/api
```

7 test suites Â· 90 tests Â· 100% pass rate

| Suite | Coverage |
|-------|---------|
| `auth.service.spec.ts` | Signup, login, token rotation, bcrypt, duplicate email |
| `csv-parser.service.spec.ts` | All Indian bank date formats, split debit/credit columns, amount parsing, deduplication, error handling |
| `subscription-detector.service.spec.ts` | Weekly/monthly/annual detection, confidence scoring, edge cases |
| `insights.service.spec.ts` | ISO week grouping, category aggregation, credit exclusion, merchant ranking |
| `transactions.controller.spec.ts` | Pagination, search clamping, userId guard, filter pass-through |
| `ai.service.spec.ts` | Cache hit, rate limiting, Anthropic mock, context injection, malformed response handling |
| `uploads.service.spec.ts` | Magic byte validation, full import flow, duplicate skipping, job enqueueing, cache busting |

