# SpendWise

A full-stack AI-powered personal finance platform. Upload a bank statement CSV, get automatic subscription detection, weekly spending summaries, and an RAG-augmented AI assistant that answers questions about your own transaction history.

---

## Features

- **CSV ingestion** — supports HDFC, ICICI, SBI, and Axis Bank statement formats; normalises column aliases automatically
- **Subscription leak detection** — stddev-based confidence scoring across 6 billing cycles (7/14/30/90/180/365 days); flags unused recurring charges with annualised cost
- **Weekly spending summaries** — groups transactions by ISO week; computes total spend, credits, category breakdown, and top 5 merchants per week
- **RAG chat** — Voyage AI embeddings (1024-dim, `voyage-3-lite`) stored in pgvector; cosine similarity search feeds relevant transaction chunks into every AI response
- **AI insights** — Claude Sonnet 4.6 generates structured savings recommendations with schema-validated JSON output and uncertainty notes
- **Async job pipeline** — BullMQ queue processes embedding, subscription detection, and insight computation in the background after every upload
- **Email alerts** — Resend API sends subscription leak notifications and weekly digests
- **httpOnly cookie auth** — JWT access token (15 min) + refresh token (7 days) stored in httpOnly `SameSite=Lax` cookies; silent rotation on 401

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript, Passport JWT |
| Database | PostgreSQL + pgvector extension |
| ORM | Prisma |
| Cache / Queue | Redis + BullMQ |
| AI | Claude Sonnet 4.6 (Anthropic), Voyage AI embeddings |
| Email | Resend |
| Monorepo | Turborepo |

---

## Project Structure

```text
apps/
  api/          NestJS REST API
    src/
      modules/
        auth/           JWT auth, httpOnly cookie flow, refresh token rotation
        users/          User profile
        transactions/   CRUD + category editing
        uploads/        CSV parsing (multi-bank alias normalisation)
        subscriptions/  Recurring charge detection with confidence scoring
        insights/       Weekly summary computation, upsert to DB
        ai/             Claude Sonnet integration, structured JSON output
        rag/            Voyage AI embed, pgvector search, batch chunking
        alerts/         Resend email alerts
        jobs/           BullMQ processors (embed, detect, insights)
      common/           Prisma service, guards, decorators

  web/          Next.js 14 frontend
    app/
      (auth)/     Login, signup pages
      (dashboard)/
        dashboard/      Spending charts, stat cards
        transactions/   Table with search, filter, inline category edit
        subscriptions/  Leak cards, dismiss/confirm flow
        insights/       AI recommendations + RAG chat
        settings/       Account management
    components/   Shared UI components
    store/        Zustand state (auth, filters, UI)
    lib/api.ts    Axios instance with httpOnly cookie flow

packages/
  shared-types/   Shared TypeScript types (AuthTokens, JwtPayload, etc.)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL with pgvector extension enabled
- Redis

### Environment variables

Copy `.env.example` and fill in all values:

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local  # only NEXT_PUBLIC_API_URL needed
```

Required API keys:
- `ANTHROPIC_API_KEY` — [console.anthropic.com](https://console.anthropic.com)
- `VOYAGE_API_KEY` — [dash.voyageai.com](https://dash.voyageai.com)
- `RESEND_API_KEY` — [resend.com](https://resend.com)

### Install and run

```bash
# Install all workspace dependencies
npm install

# Run database migrations
cd apps/api && npx prisma migrate dev && cd ../..

# Start both API and web in development
npm run dev
```

API runs at `http://localhost:3001/api`  
Frontend runs at `http://localhost:3000`  
Swagger docs at `http://localhost:3001/api/docs`

---

## Authentication

Auth uses **httpOnly cookies** — tokens are never accessible to JavaScript on the page.

| Cookie | TTL | Purpose |
|--------|-----|---------|
| `access_token` | 15 min | JWT, extracted by Passport on every request |
| `refresh_token` | 7 days | Stored in DB; rotated on each use |

On a 401 the Axios interceptor silently calls `POST /auth/refresh` — the browser sends the cookie automatically. On failure the user is redirected to `/login`.

---

## Job Pipeline

After every CSV upload, three BullMQ jobs are enqueued in order:

```text
JOB_EMBED_TRANSACTIONS
  → Generate Voyage AI embeddings for each transaction
  → Upsert into pgvector column for RAG retrieval

JOB_DETECT_SUBSCRIPTIONS
  → Group by merchant, compute stddev of intervals
  → Score confidence against 6 known billing cycles
  → Upsert into Subscription table

JOB_COMPUTE_INSIGHTS
  → Group transactions by ISO week
  → Compute totalSpent / totalCredits / categoryBreakdown / topMerchants
  → Upsert weekly Insight records
```

All jobs use exponential backoff retry (3 attempts).

---

## RAG Chat

1. User message is embedded via Voyage AI
2. Top-5 closest transaction chunks retrieved from pgvector (`<=>` cosine distance)
3. Chunks injected as context into Claude Sonnet prompt
4. Claude responds grounded in the user's actual transaction data

---

## Subscription Detection Algorithm

For each merchant with ≥ 2 charges:

1. Sort charge dates, compute day-intervals between consecutive charges
2. Calculate mean and stddev of intervals
3. For each known billing cycle (7/14/30/90/180/365 days), compute `|mean - cycle| / cycle`
4. Confidence = `1 - min(0.3 / stddev, relative_error)` (capped 0–1)
5. Charges with confidence ≥ 0.7 are flagged as subscriptions

Unused subscriptions (`isLikelyUnused`) are surfaced with annual cost on the leaks page.

---

## License

MIT
