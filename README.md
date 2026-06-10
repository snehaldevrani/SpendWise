?# SpendWise

**An AI-powered personal finance manager for Indian users.**

Upload your bank statement once. SpendWise automatically categorises every transaction, detects recurring subscription charges, computes weekly spending summaries, lets you set monthly budgets, and gives you an AI assistant that answers questions grounded in your *own* transaction history — not generic advice.

> Built with NestJS · Next.js 15 · PostgreSQL + pgvector · Redis · Google Gemini 3.1 Flash Lite

**Live demo:** [spendwise-web-nine.vercel.app](https://spendwise-web-nine.vercel.app) &nbsp;|&nbsp; **API:** [spendwise-api-q01j.onrender.com/api](https://spendwise-api-q01j.onrender.com/api)

> The Render free tier spins down after 15 min of inactivity — first request may take ~30 s.

---

## Features

| Feature | Details |
|---------|---------|
| **Multi-bank statement import** | HDFC, ICICI, SBI, Axis Bank, Kotak — CSV, XLSX (.xlsx only), and PDF formats; automatic column alias normalisation, magic-byte validation, deduplication |
| **Real-time import progress** | After upload, an SSE stream (`GET /uploads/progress`) polls BullMQ job states every 1.5 s; upload dialog shows three live step indicators (embed → subscriptions → insights) updating in real time |
| **Smart categorisation** | 9 built-in categories (Food, Travel, Utilities, Entertainment, Health, Shopping, Subscriptions, Income, Other) — keyword-based auto-classify, inline editing |
| **User-defined custom categories** | Create unlimited named categories with emoji, colour, and merchant keyword rules; rules auto-apply on every new upload and retroactively re-categorise existing transactions; merchant list sourced from `GET /transactions/merchants` |
| **Subscription leak detection** | Confidence-scored recurring charge detection across 6 billing cycles (7/14/30/90/180/365 days); flags unused subscriptions with annual cost |
| **Monthly & recurring budgets** | Per-category budgets with a Recurring toggle — one recurring budget auto-applies every month; explicit month budgets override recurring for that month; live progress bars, prorated forecast, health score |
| **Dashboard date range** | Dropdown to view stat cards across This month / Last 2 months / Last 3 months / Last 6 months — aggregates Money Out / Money In / Net Savings over the selected window |
| **6-month category trends** | Stacked bar chart showing month-by-month spend across all categories |
| **Weekly spending summaries** | ISO-week groupings with total spend, income, category breakdown, top merchants |
| **RAG AI chat** | Ask questions about your own finances; Gemini `gemini-embedding-2` embeddings + pgvector cosine search provides supplemental context; full transaction history injected into every prompt for factually accurate answers; chat history persisted in localStorage across refreshes and sessions |
| **Agentic AI actions** | The AI chat can execute real actions on request — create, update, and delete categories and budgets — powered by Gemini function calling (5 declared tools: `create_category`, `update_category`, `delete_category`, `create_budget`, `delete_budget`); categories can be created with zero merchants (optional); confirmed actions shown with a green pill; React Query caches invalidated automatically |
| **AI recommendations** | Structured savings recommendations: top leaks, estimated monthly savings, action checklist — Redis-cached 6h, per-user rate limited |
| **Weekly email digest** | Every Monday: last week's spend, income, net savings, top categories and merchants — opt-in via Settings |
| **Email alerts** | New subscription leak detected → immediate notification |
| **Secure auth** | httpOnly SameSite=Lax cookies, bcrypt refresh tokens, silent 401 rotation, per-user AI rate limits |
| **Google OAuth** | "Continue with Google" on login/signup — account auto-linked by email if a password account already exists; `prompt: 'select_account'` forces the Google account picker on every sign-in so users can always switch accounts |
| **Password reset** | Forgot password → Resend email with single-use 1-hour token; Change password in Settings |
| **Privacy policy** | `/privacy` page — full breakdown of what data is stored, what leaves the server, and how to delete your account |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15.5 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Backend | NestJS 10, TypeScript 5, Passport JWT, class-validator |
| Database | PostgreSQL 16 + pgvector (768-dim, HNSW index) |
| ORM | Prisma 5 |
| Cache / Queue | Redis 7 + BullMQ 5 |
| AI — chat & recs | Google Gemini `gemini-3.1-flash-lite` → `gemini-3.5-flash` → `gemini-3-flash` (waterfall fallback on rate-limit) |
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

Google Gemini provides a **generous free tier** via Google AI Studio (`gemini-3.1-flash-lite` and `gemini-embedding-2` are both available on the free plan), which made the switch an easy cost-cutting decision without compromising capability.

**What changed:**

| Component | Before | After |
|-----------|--------|-------|
| Chat / Recommendations | Claude Sonnet 4.6 (Anthropic SDK) | `gemini-3.1-flash-lite` (Google Generative AI SDK) |
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
│   │   │   │   ├── uploads/        CSV/XLSX/PDF parsing, magic-byte validation
│   │   │   │   ├── subscriptions/  Recurring charge detection + dismiss/confirm
│   │   │   │   ├── budgets/        Monthly budget CRUD, forecast, health score
│   │   │   │   ├── insights/       ISO-week summaries, category trends
│   │   │   │   ├── ai/             Gemini 3.1 Flash Lite recs + RAG chat + function calling, rate limits
│   │   │   │   ├── custom-categories/ User-defined category rules (CRUD + applyRules)
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
│       │       ├── dashboard/      Stat cards (with date range), area chart, recent transactions
│       │       ├── transactions/   Table, search, filters, CSV export, inline edit
│       │       ├── subscriptions/  Leak cards, dismiss/confirm
│       │       ├── budgets/        Budget CRUD (monthly + recurring), progress bars, forecast
│       │       ├── categories/     Custom category CRUD — name, emoji, colour, merchant rules
│       │       ├── insights/       AI chat (persisted + agentic), weekly cards, 6-month trends chart
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

# Web
cp apps/web/.env.example apps/web/.env.local
```

Fill in `apps/api/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/spendwise?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="<min 32 chars>"
JWT_REFRESH_SECRET="<min 32 chars>"
GEMINI_API_KEY="AQ..."              # from aistudio.google.com/apikey — free tier keys start with AQ.
RESEND_API_KEY="re_..."             # from resend.com — required for password reset emails
RESEND_FROM_EMAIL="onboarding@resend.dev"  # Resend's built-in test address, no domain verification needed
FRONTEND_URL="http://localhost:3000"
PORT=3001
# Google OAuth — required for "Continue with Google" on login/signup
GOOGLE_CLIENT_ID="<OAuth 2.0 Client ID from console.cloud.google.com>"
GOOGLE_CLIENT_SECRET="<OAuth 2.0 Client Secret>"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"
```

API keys:
- **Google Gemini** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier, no credit card)
- **Resend** — [resend.com](https://resend.com) (free tier, 3,000 emails/month — needed for password reset emails; use `onboarding@resend.dev` as `RESEND_FROM_EMAIL` for zero-config sending)
- **Google OAuth** — [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application); add `http://localhost:3001/api/auth/google/callback` as authorised redirect URI

### 3. Set up the database

```bash
cd apps/api
npx prisma migrate deploy    # apply all migrations (includes pgvector extension + HNSW index)
npx prisma generate          # generate Prisma client
cd ../..
```

### 4. Run in development

Run the API and web app in separate terminals:

```bash
npm run dev:api
npm run dev:web
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

SpendWise supports **HDFC, ICICI, SBI, Axis Bank, and Kotak** statement exports in **CSV, Excel (XLSX), and PDF** formats.

| Bank | Export path |
|------|------------|
| HDFC | Net Banking → Accounts → Download Statement → CSV or PDF |
| ICICI | Net Banking → Statements → Download → Excel/CSV or PDF |
| SBI | YONO / Net Banking → e-Statements → Date range → Download CSV or PDF |
| Axis | Net Banking → Accounts → Account Statement → CSV or PDF Download |
| Kotak | Net Banking → Accounts → Statements → Download → Excel or PDF |

> **PDF note:** Only digital (text-based) PDFs are supported — the kind you download from net banking. Scanned / image PDFs will not parse.

The file must include at minimum: a **date column**, a **description/narration column**, and **debit/credit amount columns**. Column names are normalised automatically.

### 3. Upload

Click **Upload Statement** from the sidebar or dashboard. After upload, three background jobs run:

1. **Embed** — each transaction is embedded with Gemini `gemini-embedding-2` (768-dim) and stored in pgvector
2. **Detect subscriptions** — recurring charges are scored and flagged
3. **Compute insights** — weekly summaries are calculated

The upload dialog shows **live step indicators** for all three jobs as they complete, powered by an SSE stream from the API. Processing typically completes in under 30 seconds.

> **PDF uploads:** `pdf-parse` extracts text from digital PDFs. Each line beginning with a date pattern is treated as a transaction row. Works with all major Indian bank digital statements.

### 4. Dashboard

The dashboard shows:
- Stat cards with a **date range dropdown** — choose This month, Last 2 months, Last 3 months, or Last 6 months. Single-month view shows This Month vs Last Month spend comparison; multi-month view shows aggregated Money Out / Money In / Net Savings
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

Set per-category spending limits. Each budget card shows:
- Live progress bar (green → amber → red as you approach the limit)
- Prorated month-end forecast
- Remaining balance
- Overall budget health score

Toggle **Recurring** when creating a budget — it applies automatically every month. An explicit budget for a specific month always overrides the recurring one for that month.

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
- **File upload magic-byte validation** — XLSX/PDF files are rejected if content doesn't match expected binary signatures
- **UPI reference ID sanitisation** — raw UPI transaction IDs (e.g. `UPIAR/013914520250/DR/`) are stripped from merchant names before any data is sent to the Gemini API, reducing financial PII exposure
- **Per-user AI rate limits** — Redis counters with 24h TTL; when the Gemini free-tier quota is exhausted the service waterfalls through `gemini-3.1-flash-lite` → `gemini-3.5-flash` → `gemini-3-flash` before returning a 429 to the client; the frontend displays a specific "rate-limited" message instead of the generic error
- **Redis-backed rate limiting** — `@nest-lab/throttler-storage-redis` ensures rate limit counters survive server restarts; auth endpoints throttled to 5/15 min, uploads to 10/hour, password reset to 3/hour
- **Password reset via email** — single-use bcrypt-hashed token, 1-hour expiry; all sessions revoked on reset
- **Google OAuth** — `passport-google-oauth20`; `prompt: 'select_account'` forces account picker on every sign-in; after Google's callback the API redirects to `/callback` (not directly to `/dashboard`) so the Next.js client can call `/users/me`, populate the Zustand auth store, and then navigate to `/dashboard`; `AuthGuard` always calls `/users/me` on every mount — no fast-path bypass — closing the stale-session window
- **ThrottlerGuard registered as global APP_GUARD** — all `@Throttle()` decorators are now actively enforced; auth endpoints: 5 req/15 min; uploads: 10/hour; password reset: 3/hour
- **SSE job ownership check** — `GET /uploads/progress` verifies `job.data.userId === authenticatedUser.id`; prevents polling another user's import jobs
- **Strict MIME type allowlist on upload** — only `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx), and `application/pdf` accepted; `application/octet-stream`, `text/plain`, and `application/vnd.ms-excel` (.xls) removed
- **xlsx package replaced with exceljs** — dropped abandoned `xlsx@0.18.5` (known prototype-pollution and ReDoS CVEs) in favour of actively maintained `exceljs@4.4.0`; legacy `.xls` (OLE2) format no longer accepted — only `.xlsx` (OOXML/ZIP) files are supported
- **`@MaxLength(128)` on all password DTO fields** — caps both bcrypt and regex work on public auth endpoints; prevents ReDoS amplification attacks
- **`@Max(9_999_999)` on budget `limitAmount`** — prevents `Infinity`/numeric overflow reaching the DB
- **`@ArrayMaxSize(50)` + `@MaxLength(2000)` on AI chat history** — prevents token-stuffing (previously unbounded history could send megabytes per request to Gemini)
- **CSV/XLSX row + column + amount caps** — 10,000 row limit, 50 column limit, ₹1 billion amount cap; prevents DoS via oversized sheets
- **Password reset O(1) lookup** — reset URL now includes `?id=<recordId>` for direct DB lookup; eliminates O(N) bcrypt scan across all active tokens
- **AI prompt injection hardening** — merchant names sanitized (`sanitizeForPrompt`: strip `\r\n\x00`, truncate to 100 chars); user chat question stripped of control characters before `sendMessage` to prevent delimiter-escape attacks; system instruction anti-injection framing; `--- BEGIN/END TRANSACTION DATA ---` and `--- USER QUESTION ---` delimiters in every Gemini call
- **Duplicate category guard** — `CustomCategoriesService.create()` checks for an existing `(userId, slug)` pair before the `prisma.customCategory.create()` call and throws a `ConflictException` (409); without this, Prisma's `@@unique([userId, slug])` constraint violation surfaced as an unhandled 500
- **`create_category` merchants optional** — removed `merchants` from the Gemini tool's `required` array; the model no longer invents merchants when the user explicitly says "no merchants"; `executeTool` defaults to `[]` when the arg is absent
- **Safe response-text extraction** — `safeResponseText()` helper catches the SDK exception thrown when a Gemini follow-up response contains a function call instead of a text part, returning a sensible fallback string instead of a 500
- **Nested function-call guard** — if the model issues a second function call in the follow-up turn (regression from the `required` bug above), the backend executes it, runs one more confirmation turn, and returns a clean text answer; actionsPerformed accumulates all executed tools
- **Frontend error message whitelisting** — raw server error strings in upload toasts, password-change toasts, and AI chat replaced with keyword-whitelisted or static fallbacks; prevents internal error details leaking to the UI
- **Redis TLS cert validation configurable** — `rejectUnauthorized` controlled by `REDIS_TLS_REJECT_UNAUTHORIZED` env var; defaults to `true` in production; set to `'false'` only in dev
- **Swagger UI hidden in production** — `SwaggerModule.setup()` only runs when `NODE_ENV !== 'production'`
- **PII removed from log messages** — email addresses replaced with user IDs in all server log output
- **Google OAuth startup warning** — `GoogleStrategy` emits a `Logger.warn` at boot if `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing; missing OAuth credentials surface immediately in logs rather than silently 500-ing at login time
- **Privacy policy page** at `/privacy` — documents all data flows including what Gemini receives
- **Constant-time login** — `bcrypt.compare` runs against a dummy hash even when the email doesn't exist; eliminates the ~100 ms vs ~1 ms timing oracle that would otherwise reveal valid email addresses via response time
- **Stateless Google OAuth** — `state: true` was intentionally removed from `GoogleStrategy`; the app uses JWT cookies (not sessions), so `express-session` is never set up — `state: true` requires session middleware and caused a 500 on every OAuth attempt by trying to write a nonce to `req.session` which was always `undefined`. Stateless OAuth is safe here because the callback URL itself validates that Google is calling back to our registered server.
- **RAG UPDATE scoped to user** — `UPDATE transactions SET embedding = ...` includes `AND user_id = $userId` guard; closes a defense-in-depth gap where the SELECT was already scoped but the UPDATE was not
- **`@MaxLength` on email and token DTO fields** — `email` fields capped at 254 chars (RFC 5321 max); `refreshToken` at 1024 chars; `token` and `recordId` on reset-password capped at 512 / 36 chars; prevents long-string DoS via JWT verification and validator.js regex on public endpoints
- **HTML escaping in email templates** — merchant names from CSV/PDF data are escaped (`&`, `<`, `>`, `"`, `'`) before insertion into Resend HTML email bodies; prevents XSS payloads in HTML-capable email clients
- **`@Throttle` on AI endpoints** — `GET /ai/recommendations` limited to 10 req/min, `POST /ai/chat` to 30 req/min per user; separate from the daily Redis counters; prevents per-burst token-amplification attacks
- **Transaction query parameter bounds** — `?days` clamped to 1–365, `?months` to 1–24, `?month`/`?year` validated to real calendar ranges (2000–2100); date-range queries validate ISO format and reject ranges over 2 years; prevents billion-iteration loops and full-table scans via crafted query strings
- **Next.js security headers** — `headers()` export in `next.config.ts` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a `Content-Security-Policy` (including `connect-src` scoped to the API origin) on every page response
- **CORS explicit config** — `app.enableCors()` specifies exact `methods`, `allowedHeaders`, and `origin`; removes the default behaviour of reflecting any method or header from preflight requests
- **GuestGuard server-side verification** — login/signup pages call `GET /users/me` before rendering; active sessions are redirected to dashboard without relying on stale Zustand state, eliminating redirect-loop scenarios after cookie expiry
- **Zustand persisted to localStorage** — both `useChatStore` and `useAuthStore` use a custom `localStorage` adapter; chat history survives page refreshes and new tabs; financial data is still cleared explicitly on logout via `clearHistory()`, preventing data leakage between users on the same device
- **PDF parser row ceiling** — `parsePdf()` now enforces the same `MAX_ROWS = 10,000` limit as CSV/XLSX parsers; previously the PDF path had no cap, allowing unbounded memory use via crafted large PDFs
- **Production log level restriction** — NestJS app created with `logger: ['log', 'warn', 'error']` in production; `debug` and `verbose` levels (which can emit request bodies and token fragments) are only enabled in development

---

## Background Job Pipeline

```
CSV / XLSX / PDF upload
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

All 3 job IDs returned in POST /uploads/csv response → frontend opens
EventSource to GET /uploads/progress?jobs=id1,id2,id3 → SSE stream
pushes per-job status every 1.5 s until all complete.

Weekly cron (Mon 08:00 IST):
    └─► Send weekly digest email to opted-in users
```

All jobs use 3-attempt exponential-backoff retry. The BullMQ worker runs as a **separate process** (`worker.ts`) so heavy uploads cannot starve the HTTP server.

---

## API Reference

Full interactive docs are available in local development at `http://localhost:3001/api/docs` (Swagger UI). Swagger is disabled when `NODE_ENV=production`.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/signup` | Create account |
| `POST` | `/api/auth/login` | Login, sets cookies |
| `POST` | `/api/auth/refresh` | Silent token rotation |
| `POST` | `/api/auth/logout` | Clear cookies |
| `POST` | `/api/uploads/csv` | Upload bank statement; returns `jobIds[]` |
| `GET` | `/api/uploads/progress` | SSE stream — real-time BullMQ job status (`?jobs=id1,id2,id3`) |
| `GET` | `/api/transactions` | List with pagination, search, filters |
| `PATCH` | `/api/transactions/:id/category` | Edit transaction category |
| `PATCH` | `/api/transactions/bulk-category` | Bulk re-categorise by merchant (used by custom category rules) |
| `GET` | `/api/transactions/merchants` | Unique merchant list — powers the category rule builder |
| `GET` | `/api/transactions/overview` | Dashboard stat cards (current vs previous month) |
| `GET` | `/api/transactions/range-overview` | Aggregated stats across arbitrary date window (`?start=&end=`) |
| `GET` | `/api/transactions/category-trends` | 6-month stacked spend data |
| `GET` | `/api/subscriptions` | All detected subscriptions |
| `GET` | `/api/subscriptions/leaks` | Flagged unused subscriptions |
| `GET` | `/api/budgets` | Budget summary for a month (merges recurring + monthly) |
| `POST` | `/api/budgets` | Create or update a budget (`recurring: true` for all-months) |
| `DELETE` | `/api/budgets/:id` | Remove a budget |
| `GET` | `/api/insights` | Weekly insight cards |
| `GET` | `/api/custom-categories` | List user-defined categories |
| `POST` | `/api/custom-categories` | Create category (name, emoji, colour, merchants[]) |
| `PATCH` | `/api/custom-categories/:id` | Update category |
| `DELETE` | `/api/custom-categories/:id` | Delete category |
| `GET` | `/api/ai/recommendations` | Gemini 3.1 Flash Lite savings advice (cached 6h, rate-limited 4/day) |
| `POST` | `/api/ai/chat` | RAG-augmented AI chat with Gemini function calling — returns `actionsPerformed[]` |
| `GET` | `/api/users/preferences` | Notification settings |
| `PATCH` | `/api/users/preferences` | Update notification settings |
| `POST` | `/api/auth/forgot-password` | Send password reset email (public, 3/hour) |
| `POST` | `/api/auth/reset-password` | Reset password with token (public, 5/hour) |
| `POST` | `/api/auth/change-password` | Change password (authenticated) |
| `GET` | `/api/auth/google` | Initiate Google OAuth redirect |
| `GET` | `/api/auth/google/callback` | Google OAuth callback — sets httpOnly cookies, redirects to `/callback` (frontend hydration page) |
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

> **Note:** The API imports the BullMQ processors, so a single Render web service can process jobs for a free-tier demo. `docker-compose.yml` also includes a separate `worker` service to show the scale-out path for heavier uploads.

> Render free tier spins down after 15 min of inactivity — first request may take ~30 s. Acceptable for portfolio/demo use.

### Environment variables (Render API service)

```env
DATABASE_URL=<neon postgres connection string>
REDIS_URL=<upstash rediss:// url>
JWT_SECRET=<32+ char random string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<32+ char random string>
JWT_REFRESH_EXPIRES_IN=7d
GEMINI_API_KEY=<from aistudio.google.com/apikey — free tier keys start with AQ.>
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
GOOGLE_CLIENT_ID=<OAuth 2.0 Client ID from console.cloud.google.com>
GOOGLE_CLIENT_SECRET=<OAuth 2.0 Client Secret>
GOOGLE_CALLBACK_URL=https://<your-render-api-url>/api/auth/google/callback
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://<your-vercel-url>.vercel.app
# Optional — only needed in local dev with self-signed Redis certs
# REDIS_TLS_REJECT_UNAUTHORIZED=false
```

### Vercel environment variable

```env
NEXT_PUBLIC_API_URL=https://<your-render-api-url>/api
```

### Deploy order

1. **Neon** — create project → copy `DATABASE_URL` (pgvector is pre-installed)
2. **Upstash** — create Redis database → copy `REDIS_URL`
3. **Resend** — sign up at [resend.com](https://resend.com) → copy API key; set `RESEND_FROM_EMAIL=onboarding@resend.dev` (Resend's built-in test sender — works on free tier with no domain verification)
4. **Google OAuth** — [console.cloud.google.com](https://console.cloud.google.com) → create project → APIs & Services → OAuth consent screen (External) → Credentials → OAuth 2.0 Client ID (Web application) → add Render callback URL as authorised redirect URI and Vercel URL as authorised JavaScript origin; copy Client ID + Secret
5. **Render API** — new Web Service → Docker → Dockerfile path `./apps/api/Dockerfile` → set all env vars (including `RESEND_*` and `GOOGLE_*`) → deploy → copy service URL
6. **Vercel** — import repo → root directory `apps/web` → set `NEXT_PUBLIC_API_URL=https://<render-url>/api` → deploy → copy Vercel URL → update `FRONTEND_URL` on Render; also add the Vercel URL as an authorised JavaScript origin in Google Console

The API container runs `prisma migrate deploy` automatically on every startup, so the Neon schema is always in sync with the code.

---

7 test suites · 100 tests · 100% pass rate

| Suite | Coverage |
|-------|---------|
| `auth.service.spec.ts` | Signup, login, token rotation, bcrypt, duplicate email, forgot/reset password, Google OAuth validate |
| `csv-parser.service.spec.ts` | All Indian bank date formats, split debit/credit columns, amount parsing, deduplication, error handling |
| `subscription-detector.service.spec.ts` | Weekly/monthly/annual detection, confidence scoring, edge cases |
| `insights.service.spec.ts` | ISO week grouping, category aggregation, credit exclusion, merchant ranking |
| `transactions.controller.spec.ts` | Pagination, search clamping, userId guard, filter pass-through |
| `ai.service.spec.ts` | Cache hit, rate limiting, Gemini mock, context injection, malformed response handling, function calling actions, UPI sanitisation |
| `uploads.service.spec.ts` | Magic byte validation, full import flow, duplicate skipping, job enqueueing, cache busting |

