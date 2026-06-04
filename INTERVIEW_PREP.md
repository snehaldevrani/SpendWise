# SpendWise Interview Preparation Guide

---

## Part 1: The One-Paragraph Pitch

> "SpendWise is a full-stack AI personal finance platform. Users upload bank statements, and the system automatically categorises transactions, detects recurring subscriptions, generates weekly spending summaries, and provides an AI assistant that answers questions grounded in your own transaction history using RAG. The dashboard supports flexible date range views (1–6 months) and the budgets page lets you set recurring budgets that auto-apply every month without recreation. Upload progress is streamed live to the browser over SSE — three BullMQ job steps show real-time status in the upload dialog. It also ships an MCP server, so Claude Desktop can natively query your finances as first-class tools. The stack is NestJS + Next.js 15, PostgreSQL with pgvector for semantic search, Redis + BullMQ for async job processing, Google Gemini 2.5 Flash for AI chat and recommendations, and Gemini embedding-2 for 768-dim vector embeddings. Auth uses httpOnly cookies — no tokens in localStorage. Everything that can fail asynchronously runs through a retryable BullMQ queue."

---

## Part 2: Architecture Deep Dive

### System Overview

```text
Browser (Next.js 15)          Claude Desktop
    ?                               ?
    ? httpOnly cookie                ? MCP protocol
    ? (access_token 15m              ? (Authorization: Bearer)
    ?  + refresh_token 7d)           ?
    ?                               ?
NestJS REST API  ???????????? MCP Server (6 tools)
    ?
    ??? Auth         ? bcrypt + JWT + DB-persisted refresh tokens
    ??? Uploads       ? CSV parse ? queue 3 jobs
    ??? Transactions
    ??? Subscriptions
    ??? Budgets
    ??? Insights
    ??? AI/RAG        ? Gemini 2.5 Flash + gemini-embedding-2
    ??? Alerts        ? Resend email (weekly digest cron)
    ?
    ??? PostgreSQL + pgvector
    ?       ??? Transaction embeddings (768-dim cosine similarity)
    ?
    ??? Redis (BullMQ)
            ??? JOB_EMBED_TRANSACTIONS
            ??? JOB_DETECT_SUBSCRIPTIONS
            ??? JOB_COMPUTE_INSIGHTS
```

### Request Flow: CSV / XLSX / PDF Upload

```text
1. User uploads file via multipart/form-data (CSV, XLSX, or PDF)
2. Magic-byte validation: PDF must start with %PDF (25 50 44 46), XLSX with PK header
3. For PDF: pdf-parse extracts raw text; each line starting with a date pattern is parsed as a transaction row (date + description + decimal amounts + CR/DR marker)
   For CSV/XLSX: CsvParserService normalises bank-specific column aliases
   (HDFC: "Withdrawal Amt." → amount; BankStatementWizard: "Source Date" overrides serial-number "Date" column)
4. UPI reference IDs stripped from merchant names before any DB write or AI call
5. Transactions saved to DB
6. Three BullMQ jobs enqueued in order:
   a. JOB_EMBED_TRANSACTIONS  → Gemini gemini-embedding-2 embeds each transaction → pgvector (768-dim)
   b. JOB_DETECT_SUBSCRIPTIONS → stddev confidence scoring → Subscription table
   c. JOB_COMPUTE_INSIGHTS   → weekly summaries → Insight table
7. All 3 job IDs returned in POST /uploads/csv response as `jobIds: string[]`
8. Browser opens EventSource to GET /uploads/progress?jobs=id1,id2,id3 (withCredentials: true)
   → NestJS @Sse endpoint uses RxJS interval(1500).pipe(exhaustMap, takeWhile, take(200))
   → polls BullMQ job states every 1.5 s
   → browser shows live step indicators until payload.done === true
9. All 3 jobs: 3 attempts with exponential backoff on failure
```

### Request Flow: RAG Chat

```text
1. User sends message
2. AiController calls rag.search(message) first
3. RagService embeds the query via Gemini `gemini-embedding-2` (768-dim, `outputDimensionality: 768`)
4. pgvector cosine search (<=> operator): top-N semantically relevant chunks returned
5. AiService fetches ALL transactions from DB sorted by amount desc — pre-computes
   total debits/credits, category breakdown, largest single debit
6. Full transaction list + RAG chunks both injected into Gemini 2.5 Flash system prompt
7. Gemini answers grounded in complete, accurate transaction data
8. AI can only see the user's own data (userId scoping on every query)
9. UPI reference IDs are sanitised before the prompt is built — merchant names like "UPIAR/013914520250/DR/Zomato" become "Zomato"
```

---

## Part 3: What You Must Know Cold

### 3.1 Authentication — httpOnly Cookies

**Why not localStorage?**

localStorage is readable by any JavaScript running on the page. If there's an XSS vulnerability anywhere in your app (malicious ad, injected script, open redirect), an attacker can steal the token and make authenticated API calls silently.

httpOnly cookies are not readable by JavaScript at all. The browser sends them automatically on every request, but `document.cookie` cannot access them. This eliminates the entire class of token-theft XSS attacks.

**Interview question:**
> "Aren't cookies also vulnerable to CSRF?"

**Your answer:**
> "Yes — but you mitigate CSRF with `SameSite=Lax`. With Lax, cookies are only sent on same-site navigations and top-level GET requests. Cross-site POST requests (what CSRF attacks use) don't get the cookie. For additional protection you can add a CSRF token header, but `SameSite=Lax` alone is sufficient for most applications. `Secure=true` in production ensures cookies are only sent over HTTPS."

**Your implementation:**
- `access_token`: httpOnly, SameSite=Lax, maxAge=15min
- `refresh_token`: httpOnly, SameSite=Lax, maxAge=7 days, stored in DB (can be revoked)
- On 401: Axios interceptor silently calls POST /auth/refresh ? browser sends refresh cookie automatically ? new tokens set as cookies ? original request retried
- Logout: server deletes DB record + clears both cookies

**Interview question:**
> "What's refresh token rotation and why does it matter?"

**Your answer:**
> "On every successful refresh, the old refresh token is deleted from the DB and a new one is issued. This means a stolen refresh token can only be used once — after the legitimate user refreshes, the stolen token becomes invalid. Without rotation, a stolen refresh token is valid for its full TTL (7 days in our case)."

---

### 3.2 BullMQ Async Job Pipeline

**Why async jobs at all?**

Embedding 500 transactions via Voyage AI takes ~3-8 seconds. Doing that synchronously in the upload response would make the user wait and risk HTTP timeouts. BullMQ offloads this to background workers.

**Your job flow:**

| Job | What it does | Why it can fail |
|-----|-------------|-----------------|
| `JOB_EMBED_TRANSACTIONS` | Calls Voyage AI for batch embeddings, upserts into pgvector | External API call, rate limits |
| `JOB_DETECT_SUBSCRIPTIONS` | Groups by merchant, runs stddev scoring, upserts Subscription rows | DB constraint, edge cases in data |
| `JOB_COMPUTE_INSIGHTS` | Groups by ISO week, aggregates totals, upserts Insight rows | DB write failure |
After all 3 jobs are enqueued, their IDs are returned in the upload response. The browser opens an SSE connection to `GET /uploads/progress?jobs=...` and receives per-job status frames every 1.5 s until `done: true`.
**Interview question:**
> "What happens if JOB_EMBED_TRANSACTIONS fails?"

**Your answer:**
> "BullMQ retries with exponential backoff — 3 attempts by default. If all 3 fail, the job lands in the failed queue. The transaction data is still saved to the DB; the user can still see their transactions. They just won't have RAG chat available until embeddings succeed. In production I'd add a webhook or email alert on persistent job failure."

**Interview question:**
> "Why not use a simple setTimeout or setInterval instead of BullMQ?"

**Your answer:**
> "setTimeout is in-memory — if the server restarts, you lose the job. BullMQ persists jobs in Redis, so jobs survive server restarts. It also gives you retries, priority queues, rate limiting, dead-letter queues, and observability (via Bull Board). For any production workload, an in-memory approach is unacceptable."

---

### 3.3 RAG — Retrieval Augmented Generation

**What it is:** Instead of asking the AI to answer from its training data alone, you first retrieve relevant context from your own database, then inject it into the prompt. The AI answers based on that specific context.

**Why it matters for SpendWise:**
- Claude has no knowledge of your transactions
- Without RAG: "Did I spend more in February?" ? Claude has to guess
- With RAG: fetch your February transactions from pgvector ? Claude sees them ? accurate answer

**Your implementation details:**
- Embedding model: `gemini-embedding-2` (Google Generative AI SDK), 768-dimensional vectors (matryoshka-truncated from 3072)
- Storage: pgvector extension on PostgreSQL, using `<=>` cosine distance operator
- Batch size: transactions embedded one at a time in a serial loop (Google SDK doesn't batch)
- Retrieval: top-5 chunks by cosine similarity, scoped to `userId`

**Interview question:**
> "Why cosine similarity for transaction search, not Euclidean distance?"

**Your answer:**
> "Cosine similarity measures the angle between vectors, not their magnitude. For text embeddings, what matters is the semantic direction, not the scale. Two sentences can have very different token counts but similar meaning — cosine similarity handles that correctly. Euclidean distance is sensitive to vector magnitude, which makes it less reliable for semantic search. pgvector's `<=>` operator computes cosine distance (1 - cosine similarity), so lower values mean more similar."

**Interview question:**
> "What's the risk of RAG giving wrong answers?"

**Your answer:**
> "Retrieval quality. Pure cosine similarity retrieves semantically similar chunks, not the numerically largest ones. For example, asking 'what was my biggest transaction?' wouldn't reliably surface a ₹14,000 charge if it wasn't near the top cosine matches. I solved this by also injecting the full transaction list (sorted by amount) into every prompt, so the AI always has complete, accurate data for factual/aggregate questions. RAG chunks serve as supplemental semantic context. The real-world lesson: vector search is not a substitute for structured data access."

---

### 3.4 AI Stack Migration: Claude + Voyage → Gemini

This is a story interviewers love because it shows you made a deliberate architectural trade-off, not just a random technology swap.

**Original stack:**
- **Claude Sonnet 4.6** (Anthropic SDK) — AI chat and recommendations
- **Voyage AI `voyage-3-lite`** — 512-dim embeddings, optimised for short multilingual text

**Why it worked well:**
- Claude's structured JSON output mode produced reliably parseable recommendation payloads — you could define an exact schema and it would follow it
- `voyage-3-lite` outperforms OpenAI ada-002 on short-text retrieval benchmarks, which matters for bank descriptions like "UPI-SWIGGY*ORDER#123"
- Both APIs have excellent latency

**Why I migrated:**
Cost. Anthropic has no meaningful free tier — you pay per input+output token. Voyage AI similarly charges for every embed call. For a personal project or an early-stage product, running real users through this stack is expensive. Google's AI Studio provides a **generous free tier** for both `gemini-2.5-flash` (chat) and `gemini-embedding-2` (embeddings). The migration let me keep all AI features live without any API spend.

**What changed and what stayed the same:**

| Component | Before | After |
|-----------|--------|-------|
| Chat / Recs model | Claude Sonnet 4.6 | `gemini-2.5-flash` |
| Embedding model | `voyage-3-lite` (512-dim) | `gemini-embedding-2` (768-dim with `outputDimensionality`) |
| SDK | `@anthropic-ai/sdk` + `voyageai` | `@google/generative-ai` (single package) |
| API keys | `ANTHROPIC_API_KEY` + `VOYAGE_API_KEY` | `GEMINI_API_KEY` (one key) |
| DB vector column | `vector(512)` | `vector(768)` |
| RAG architecture | Unchanged | Unchanged |
| BullMQ job pipeline | Unchanged | Unchanged |
| Rate limiting | Unchanged | Unchanged |

**Engineering detail — matryoshka truncation:**

`gemini-embedding-2` natively outputs **3072-dim** vectors. To keep the DB schema and HNSW index lightweight, I pass `outputDimensionality: 768` in the SDK call:

```typescript
const request = {
  content: { role: 'user', parts: [{ text }] } as { role: string; parts: { text: string }[] },
  outputDimensionality: 768,
};
const result = await model.embedContent(request as Parameters<typeof model.embedContent>[0]);
```

This uses **matryoshka representation learning** — the first N dimensions of a longer embedding are trained to be independently meaningful. So the first 768 dims of a 3072-dim vector carry nearly the same semantic information as a native 768-dim model. You get compact storage and fast search without sacrificing retrieval quality.

**Interview question:**
> "Wasn't Claude more reliable for structured output? What did you lose?"

**Your answer:**
> "Claude has a dedicated structured output mode where you pass a JSON schema and it guarantees the response matches. Gemini 2.5 Flash doesn't have the same first-class schema enforcement, but JSON mode is still reliable enough in practice — I prompt it with a strict JSON template and it follows it consistently. For a side project the reliability difference is negligible. If I were building this for production at scale, I'd add a parsing fallback: try to parse the JSON, and if it fails, retry the call once before returning a degraded response. That's a known risk I've accepted."

**Interview question:**
> "If cost was the only reason, why not just use OpenAI GPT-4o-mini?"

**Your answer:**
> "Two reasons. First, I was already invested in the Google SDK for embeddings — using the same vendor for both chat and embeddings means one API key, one billing account, one SDK. Second, Gemini 2.5 Flash is genuinely competitive with GPT-4o-mini on reasoning tasks and has a larger context window. The simplification (single SDK, single key) is worth more than any marginal quality difference at this scale."

---

### 3.5 Subscription Detection Algorithm

**The problem:** Given a list of charges from the same merchant, detect if they're recurring on a predictable schedule.

**Your algorithm:**
1. Group transactions by merchant name
2. Filter: only merchants with ? 2 charges
3. Sort by date, compute day-intervals between consecutive charges
4. Compute mean and stddev of intervals
5. For each known billing cycle (7, 14, 30, 90, 180, 365 days):
   - `relative_error = |mean - cycle| / cycle`
   - `confidence = 1 - min(0.3/stddev, relative_error)` clamped to [0, 1]
6. Best confidence across all cycles ? stored as the subscription's confidence score
7. Threshold ? 0.7 = confirmed subscription

**Interview question:**
> "What makes something 'likely unused'?"

**Your answer:**
> "Two signals: the last charge is older than 60 days (suggesting no recent activity), or the description contains keywords like 'free trial', 'auto-renew', or the amount is very low (under ?50). In practice the most reliable signal is merchant recency — if you haven't been charged in 2 billing cycles, the subscription has either lapsed or you're not using it."

**Interview question:**
> "Why stddev? Couldn't you just check the mean interval?"

**Your answer:**
> "Mean alone doesn't capture regularity. If a merchant charges you every 28-32 days, the mean is ~30 but the stddev is ~2 — clearly monthly. If a merchant charges you at irregular intervals (15 days, then 45 days, then 20 days), the mean might still look monthly but stddev is high — that's not a subscription, that's ad-hoc billing. Low stddev is what separates subscriptions from irregular charges."

---

### 3.6 Database Design

**Why pgvector instead of a dedicated vector DB (Pinecone, Weaviate)?**

For the scale of SpendWise (hundreds to low thousands of transactions per user), a dedicated vector DB is over-engineered. pgvector colocates vector search with your relational data — you can do `WHERE userId = ? ORDER BY embedding <=> query_embedding LIMIT 5` in a single query, with full ACID guarantees and no extra service to manage. At 10M+ vectors you'd reconsider.

**Key tables:**

| Table | Key columns | Notes |
|-------|-------------|-------|
| `User` | id, email, passwordHash | bcrypt cost 12 |
| `RefreshToken` | token, userId, expiresAt | DB-persisted, deleted on rotation |
| `Transaction` | id, userId, amount, merchant, category, embedding | embedding is pgvector `vector(768)` column |
| `Subscription` | userId, merchant, confidence, annualCost, isLikelyUnused | upserted by BullMQ job |
| `Insight` | userId, weekStart, summaryJson | JSON blob of weekly aggregate |

**Interview question:**
> "Why store embeddings in PostgreSQL instead of Prisma's JSON column?"

**Your answer:**
> "pgvector adds a native `vector(768)` column type that PostgreSQL understands at the storage and index level. It uses HNSW or IVFFlat indexes for approximate nearest neighbour search — dramatically faster than scanning a JSON array. A plain JSON column with embeddings would require fetching every row and computing cosine similarity in application code, which is O(N) and unusable at any real scale."

---

### 3.7 NestJS Architecture

**Module structure matters in interviews — be able to explain it:**

Each feature is a NestJS module: `AuthModule`, `TransactionsModule`, `InsightsModule`, etc. Modules declare their providers (services) and export those that need to be injected into other modules.

Key cross-module wiring:
- `InsightsModule` exports `InsightsService` ? imported by `JobsModule` so the BullMQ processor can call `insightsService.compute(userId)` after upload
- `AlertsModule` exports `AlertsService` ? injected where emails need to be sent
- `RagModule` injected into `AiModule` ? `AiController.chat()` calls `ragService.search()` first, then passes chunks to `aiService.chat()`

**Global infrastructure registered in `main.ts`:**
- `HttpExceptionFilter` (`@Catch()`) — catches all unhandled exceptions; returns consistent JSON `{ statusCode, message, timestamp, path }`; hides raw stack traces in production
- `LoggingInterceptor` — logs every request with method, URL, and response time in ms
- `ValidationPipe` with `whitelist: true` — strips undeclared fields before they reach any handler

**Interview question:**
> "Why NestJS over plain Express?"

**Your answer:**
> "NestJS adds structure that becomes essential as the codebase grows: dependency injection (modules declare providers, framework wires them up), decorators for routing/validation, built-in Swagger integration, and native BullMQ/Prisma adapters. For a solo developer shipping fast, the opinionated structure prevents the 'where does this logic go?' problem that kills Express projects. The trade-off is heavier bootstrapping and more boilerplate for simple endpoints."

---

### 3.8 MCP Server

**What it is:** A separate Node.js process (`apps/mcp-server`) that speaks the Model Context Protocol, exposing SpendWise data as 6 tools that Claude Desktop can call natively.

**The 6 tools:**

| Tool | What it returns |
|------|-----------------|
| `get_spending_overview` | Total income/expenses, category breakdown |
| `get_transactions` | Paginated transaction list with filters |
| `get_subscriptions` | Detected recurring charges + annual cost |
| `get_insights` | Weekly AI-generated summaries |
| `get_budgets` | Budget vs actual spend with utilisation % |
| `chat_with_ai` | Full RAG chat — passes question through the API's AI module |

**How authentication works:** The MCP server reads `SPENDWISE_API_KEY` from its env, sends it as `Authorization: Bearer <token>` on every API call. The JWT strategy was extended to accept both cookie and Bearer header extractors so the same endpoints serve both browser and MCP requests without duplication.

**Interview question:**
> "What is MCP and why does it matter?"

**Your answer:**
> "MCP (Model Context Protocol) is an open standard by Anthropic that lets AI assistants call external tools in a structured, typed way — similar to OpenAPI but designed for LLM tool use. By shipping an MCP server, SpendWise becomes a first-class data source for Claude Desktop without the user having to copy-paste transaction data or screenshots. You can ask Claude 'how much did I spend on food this month?' and it queries SpendWise directly, gets structured data back, and answers accurately. It's the difference between a chatbot and a genuinely integrated AI assistant."

---

### 3.10 SSE Real-time Import Progress

**Why SSE over polling?**

The browser could poll `GET /uploads/status?jobId=...` every 2 seconds. SSE is cleaner: the server pushes updates as they happen. No repeated request overhead, and the connection closes automatically when the Observable completes. NestJS has a first-class `@Sse` decorator that returns `Observable<MessageEvent>` — no WebSocket handshake, no socket.io, just a long-lived HTTP response with `Content-Type: text/event-stream`.

**Why SSE over WebSockets?**

Upload progress is **unidirectional** — server sends status to browser, browser never sends back. WebSockets add bidirectional capability we don't need, plus extra handshake and keepalive complexity. SSE maps perfectly to a one-way status stream and is simpler to implement and debug.

**The RxJS pipeline:**

```typescript
return new Observable<MessageEvent>((subscriber) => {
  interval(1500).pipe(
    exhaustMap(async () => { /* poll BullMQ job states */ }),
    takeWhile((payload) => !payload.done, /* inclusive= */ true),
    take(200), // 5-min safety cap
  ).subscribe(subscriber);
});
```

**`exhaustMap` vs `switchMap`:**
- `exhaustMap` — if the current inner Observable (the async poll) hasn't finished, new source ticks are dropped. This avoids a growing backlog of overlapping polls if BullMQ is slow to respond.
- `switchMap` would cancel the in-flight poll on every new tick — could cause polls to never complete and miss the final `done` state.

**`takeWhile(..., true)` — the inclusive flag:**
Without `true`, `takeWhile` unsubscribes the moment the predicate is false — the final `done: true` frame is never emitted and the browser never gets the completion signal. The `true` (inclusive) flag emits one final frame even when the predicate turns false.

**Auth on SSE:**
The browser opens `new EventSource(url, { withCredentials: true })`. This sends the httpOnly access cookie automatically — the same JWT guard that protects every other endpoint also protects the SSE route. No token management code needed in the frontend.

**Interview question:**
> "Why did you return jobIds from the upload endpoint instead of streaming directly?"

**Your answer:**
> "Separation of concerns. The upload endpoint does one thing: parse, validate, save, enqueue. The progress endpoint does one thing: stream job status. Coupling them would mean the SSE connection has to stay alive for the entire upload AND processing pipeline. By returning jobIds and letting the browser open a separate SSE connection, the upload response is fast and the progress stream is independent. The user sees the upload succeed immediately, then watches processing live."

---

### 3.11 Recurring Budgets

**The problem:** Users don't want to recreate a ₹500 Food budget every month — it should just carry over.

**Implementation:**
- A `recurring Boolean @default(false)` column was added to the `Budget` model in Prisma
- Recurring budgets are stored with the sentinel values `month=0, year=0` in the DB
- `getBudgets(userId, month, year)` fetches two sets: explicit rows for that month/year AND all `month=0, year=0` rows. They're merged by category — the explicit row wins if both exist.
- `upsertBudget` forces `month=0, year=0` when `recurring: true` is passed in the DTO
- The frontend sends `{ recurring: true }` (omitting month/year) for recurring budgets; the controller uses `now` as the fallback only for non-recurring requests

**Interview question:**
> "Why a sentinel value (month=0) instead of a separate table?"

**Your answer:**
> "A separate table adds a JOIN and another migration. The sentinel approach fits in the existing schema with a single migration adding one boolean column. The merge logic is in the service layer and is easy to test in isolation. At this scale, the simplicity win is worth the minor schema oddity. month=0 is a clear marker — no real calendar month is 0."

---

### 3.12 Dashboard Date Range

**Feature:** A dropdown on the dashboard lets users switch between "This month", "Last 2 months", "Last 3 months", and "Last 6 months" for their stat cards.

**Implementation:**
- A new `GET /transactions/range-overview?start=YYYY-MM-DD&end=YYYY-MM-DD` endpoint aggregates `totalDebit`, `totalIncome`, `savings`, and per-category breakdown over any arbitrary date window
- The frontend uses a `rangePreset` state. When it's `'month'`, the existing `/transactions/overview` call is used (This Month vs Last Month). When it's a multi-month preset, `rangeQuery` is enabled pointing at the new endpoint
- The stat cards swap between a two-column "this vs last" layout and a three-column "Money Out / Money In / Net Savings" layout depending on the preset

---

This section is critical for a fintech project — interviewers will probe it directly.

**Where user data lives:**

| Data | Storage | Protection |
|------|---------|-----------|
| Passwords | Neon PostgreSQL | `bcrypt` hashed, cost factor 12 — plaintext never stored |
| Refresh tokens | Neon PostgreSQL | `bcrypt` hashed before insert — a leaked DB row cannot be replayed |
| Password reset tokens | Neon PostgreSQL | `bcrypt` hashed, 1-hour expiry, single-use (usedAt marked) |
| Transactions (merchant, amount, category, date) | Neon PostgreSQL | Plain rows — Neon encrypts the volume at rest (AES-256) |
| Transaction embeddings | Neon PostgreSQL (pgvector column) | Same volume encryption |
| JWT access tokens | httpOnly SameSite=Lax cookie | Not accessible to JavaScript; cannot be stolen via XSS |
| Sessions / rate limit counters | Upstash Redis | **Redis-backed** so counters survive server restarts |

**In transit:**
- All API traffic over HTTPS — Render terminates TLS
- Frontend on HTTPS — Vercel
- Redis over `rediss://` TLS (Upstash requires it; ioredis connects with `tls: { rejectUnauthorized: false }`)
- Database over SSL (`sslmode=require` in the Neon connection string)

**Access control:**
- Every endpoint requires a valid JWT — no route is publicly readable
- Every Prisma query filters by `userId` — no cross-user data access is architecturally possible
- CORS locked to the Vercel frontend URL via `FRONTEND_URL` env var

**What Gemini receives:**
Sanitised merchant names (UPI reference IDs stripped), amounts, categories, and dates are sent to Google's Gemini API as plain text in prompts. No user email, name, or password is ever sent. Raw UPI strings like `UPIAR/013914520250/DR/Zomato` become `Zomato` before leaving the server. This is the main privacy trade-off:

**Interview question:**
> "You're sending financial transaction data to a third-party AI. Isn't that a privacy concern?"

**Your answer:**
> "Yes, and it's a deliberate trade-off I'd address in a production product. What Gemini sees is sanitised financial records — merchant brand names, amounts, categories, dates. Raw UPI reference IDs (e.g. `UPIAR/013914520250/DR/`) are stripped from merchant names before any prompt is built, so Gemini only ever sees 'Zomato' not the full UPI identifier. No user identity (email, name, address) is included in the prompt. Google's standard API terms of service cover this usage. A stronger production approach would be a locally-hosted embedding model (e.g. a quantised sentence-transformer) so no financial text leaves the infrastructure at all. For a demo project, the Google AI Studio free tier with UPI scrubbing and no identity data in prompts is an acceptable starting point. I've documented this trade-off explicitly."

**What's NOT done (and why that's fine to say):**
- No column-level encryption on the `transactions` table — Neon's volume encryption covers the data at rest; column-level encryption would require application-layer decryption on every query, adding latency and complexity not justified at this scale
- No data residency controls — Neon and Render run in US regions; relevant if building for EU users (GDPR)
- Scanned/image PDF support — digital PDFs (net banking downloads) are handled; OCR for scanned PDFs is out of scope for now

**Additional security features now shipped:**
- **Password reset flow** — `POST /auth/forgot-password` generates a `crypto.randomBytes(32)` token, bcrypt-hashes it, stores with 1-hour expiry. `POST /auth/reset-password` verifies the raw token against all non-expired candidates, marks it used (single-use), resets the password, and revokes all active sessions atomically.
- **Google OAuth** — `passport-google-oauth20` validates the Google profile; `validateGoogleUser()` finds by `googleId`, links by email, or creates new user. `passwordHash` is nullable so OAuth-only accounts are supported.
- **Redis-backed rate limiting** — `@nest-lab/throttler-storage-redis` stores counters in Upstash Redis. Counters persist across Render cold starts — a previous in-memory gap is now closed.

---

## Part 4: Questions They Will Ask

**"Walk me through your tech stack choices."**

> "Frontend: Next.js 15 with the App Router — all pages are client components using TanStack Query for data fetching, so the UX stays snappy with background refetching and cache invalidation. Backend: NestJS because I wanted strong TypeScript, DI, and module boundaries. Database: PostgreSQL because I needed both relational queries and vector search in one place — pgvector handles both. Redis for BullMQ job queue persistence — jobs survive server restarts. Google Gemini 2.5 Flash for AI chat and recommendations — it's competitive with GPT-4o-mini and the free tier is generous enough for a real product. Gemini embedding-2 for vector embeddings at 768 dims. I also built an MCP server so Claude Desktop can query SpendWise natively — that required extending the JWT strategy to accept Bearer tokens in addition to cookies."

**"How does your auth work?"**

Explain the full cookie flow: signup → tokens set as httpOnly cookies → every API call browser sends cookie automatically → JWT Strategy reads from cookie → 401 → Axios interceptor calls /refresh → new cookies set → retry original request. Mention refresh token rotation and why it matters. Also mention Google OAuth: clicking "Continue with Google" does a full-page redirect to `GET /auth/google` → Passport handles the Google consent → callback at `GET /auth/google/callback` sets httpOnly cookies and redirects to `/dashboard`.

**"How does your password reset work?"**

> "`crypto.randomBytes(32)` generates a secure random token. We bcrypt-hash it before storing in the DB (so a DB dump can't be used to generate valid reset links). The raw token is sent to the user's email as a URL query param. On reset, we scan all non-expired unused tokens, bcrypt-compare each one, find the match, mark it used, update the password hash, and delete all refresh tokens for that user in a single `$transaction` call. This means password reset also invalidates all existing sessions — if an attacker forced a reset, the legitimate user's sessions are gone but so is the attacker's. The token expires in 1 hour and can only be used once."

**"What would you add if you had more time?"**

> "Two things. First, hybrid search — combine pgvector cosine similarity with full-text search on merchant names so users can search by exact merchant name alongside semantic queries. Second, scanned PDF support via an OCR pipeline (e.g. Tesseract) — digital PDFs are already supported using pdf-parse, but image-based PDFs from older bank branches still require OCR. The SSE import progress, recurring budgets, dashboard date range, Google OAuth, password reset, Redis-backed rate limiting, and privacy policy are all shipped."

**"How do you handle sensitive financial data?"**

> "Data in transit: HTTPS only, httpOnly cookies prevent JavaScript access. Data at rest: PostgreSQL with encrypted disk volumes in production. Application layer: every query is scoped by userId — no cross-user data access is architecturally possible. UPI reference IDs are stripped from merchant names before anything is sent to Gemini — so the AI sees 'Zomato', not raw transaction identifiers. No user email, name, or password is ever included in a Gemini prompt. Refresh tokens are stored hashed in the DB."

**"Your project stores transaction descriptions in a third-party embedding service — isn't that a privacy concern?"**

> "Yes, and it's a deliberate trade-off I'd improve in production. What Gemini receives is sanitised financial records — merchant brand names, amounts, categories, dates. Raw UPI reference IDs (e.g. `UPIAR/013914520250/DR/`) are stripped from merchant strings before any data is sent to the API, so Gemini sees 'Zomato' not the full UPI identifier. No user identity (email, name, address) is included in any prompt. A stronger solution would be a locally-hosted embedding model (e.g., a quantised sentence-transformer) so no financial text leaves the infrastructure at all. That's on my roadmap."

---

## Part 5: Trade-offs to Articulate

| Decision | What you chose | What you gave up | Why it's fine |
|----------|---------------|-----------------|---------------|
| httpOnly cookies over localStorage | XSS safety | Slightly more complex refresh flow | Worth it — token theft is a real attack |
| BullMQ over sync processing | Resilience, non-blocking uploads | Added complexity (Redis dependency) | Users shouldn't wait 8 seconds for embeddings |
| SSE over WebSockets for progress | Server-push, simpler, NestJS `@Sse` native, no handshake | Bidirectional communication not possible | One-way status stream is all that's needed |
| Google OAuth over email-only | One-click login, no password to manage for OAuth users | `passwordHash` must be nullable; account linking logic needed | Email-based account linking is safe and standard |
| pgvector over Pinecone | Single service, SQL joins | Scale ceiling (~10M vectors) | More than enough for this use case |
| Gemini over Claude + Voyage | Free tier, single API key | Claude's more reliable structured output | Gemini 2.5 Flash handles JSON output well enough; cost wins |
| gemini-embedding-2 with outputDimensionality | 768-dim, compatible with existing schema | Native 3072-dim would be higher quality | Matryoshka truncation retains quality; smaller vectors = faster search |
| JSON summaryJson in Insight table | Flexible schema for weekly data | No SQL filtering on summary internals | Weekly summaries are read-only blobs |
| MCP server as separate process | Reuses API endpoints, no code duplication | Extra process to manage | Clean separation — MCP server is just an API client |
| Global exception filter | Consistent error shape, no stack traces in prod | Slightly less granular per-route control | One place to change error format for the whole API |
| pdf-parse for PDF import | Digital PDFs supported with no external service | Scanned/image PDFs not supported | Covers all major Indian bank net banking exports; OCR is out-of-scope for now |
| UPI ID sanitisation before Gemini | Reduced PII in prompts | Slightly more processing per transaction | Stripping reference numbers is cheap; keeps brand names that AI needs |
| Recurring budget sentinel (month=0,year=0) | No extra table, fits existing schema | Slightly unconventional DB value | month=0 is unambiguous; merge logic is in service layer, easy to test |

---

## Part 6: One-Liners for Rapid Fire

| Concept | One-liner |
|---------|-----------|
| RAG | Retrieve relevant context from your own DB, inject it into the AI prompt so it answers about your data |
| pgvector `<=>` | Cosine distance between two embedding vectors — lower = more semantically similar |
| BullMQ | Redis-backed job queue — jobs survive restarts, support retries and priority |
| httpOnly cookie | Browser-managed cookie inaccessible to JavaScript — eliminates token-theft XSS |
| SameSite=Lax | Blocks cross-site POST requests from including the cookie — mitigates CSRF |
| Refresh token rotation | Old token deleted on every use — stolen tokens invalidated after one legitimate refresh |
| Gemini `gemini-embedding-2` | 768-dim matryoshka embedding model — native 3072-dim truncated to 768 via `outputDimensionality`; works with the existing pgvector schema |
| `pdf-parse` PDF extraction | Line-by-line regex walk of extracted text; date-prefixed lines parsed as transactions; CR/DR marker for type |
| UPI sanitizeMerchant | Regex strips `UPIAR/digits/XX/` prefix; keeps human brand name; applied to every Gemini prompt |
| Tutorial page | `/tutorial` — 4-step onboarding with per-bank download guides (HDFC, ICICI, SBI, Axis, Kotak), budget setup, AI chat examples |
| ISO week grouping | Monday-anchored week boundaries — ensures consistent weekly spend summaries |
| Turborepo | Monorepo build system — runs api and web concurrently with shared TypeScript types |
| MCP server | Node.js process exposing SpendWise as 6 typed tools Claude Desktop can call natively via MCP protocol |
| Global exception filter | `@Catch()` decorator catches all unhandled exceptions and returns consistent JSON error responses |
| TanStack Query | Client-side data fetching with automatic caching, background refetch, and request deduplication |
| `@Sse` | NestJS decorator that returns `Observable<MessageEvent>` — Node.js streams one JSON frame per SSE tick to the connected browser client |
| `exhaustMap` | RxJS operator that ignores new source emissions while the current inner Observable hasn't completed — prevents poll queue buildup when BullMQ is slow |
| `takeWhile(pred, true)` | Inclusive variant — emits one final event even when the predicate turns false, so the browser sees the `done: true` completion frame |
| Recurring budget | `month=0, year=0` sentinel in DB; service merges explicit + recurring rows per category, explicit wins |
| `RangeOverview` | `GET /transactions/range-overview?start=&end=` — aggregates totalDebit/totalIncome/savings for any arbitrary date window |
| Google OAuth account linking | `validateGoogleUser()` — find by googleId → else find by email and link → else create new user; `passwordHash` nullable |
| Password reset token | `crypto.randomBytes(32)` raw token bcrypt-hashed before DB storage; 1-hour expiry; single-use (`usedAt`); all sessions revoked on reset |
| Redis-backed throttler | `@nest-lab/throttler-storage-redis` — rate limit counters in Upstash Redis survive Render cold starts; fixes in-memory gap |

---

## Part 7: Your Story Arc

**"Tell me about a challenging technical problem in SpendWise."**

> "The AI chat was giving confidently wrong answers — it would say the biggest transaction was Amazon ₹844 when the actual largest was a ₹14,000 charge. The root cause was subtle: pure cosine similarity retrieves the 8 most semantically similar chunks, not the numerically largest ones. A ₹14,000 charge from an obscure merchant doesn't necessarily match the query 'biggest transaction' semantically. The fix was to stop treating RAG as the only data source. The chat method now fetches all transactions from the DB sorted by amount, pre-computes summary stats (total debits, category breakdown, largest single debit), and injects the complete structured context alongside the RAG chunks. The AI then answers from complete data, not a semantic sample. The lesson: vector similarity search is not a substitute for direct data access on factual/aggregate questions."

**"Tell me about another interesting systems problem you solved."**

> "SSE real-time import progress. After uploading a file, users had no idea what was happening — three BullMQ jobs were running silently in the background. I wanted to show live step indicators without polling. NestJS has a `@Sse` decorator that returns `Observable<MessageEvent>`, so I built a pipeline: `interval(1500).pipe(exhaustMap(async () => { /* poll BullMQ */ }), takeWhile(pred, true), take(200))`. The tricky part was operator choice: `exhaustMap` was critical — it drops new ticks if the previous poll is still running, preventing a backlog of overlapping BullMQ queries. And the `true` flag on `takeWhile` is the inclusive variant — without it the final `done: true` frame is swallowed before the browser sees it. Auth worked automatically because EventSource sends httpOnly cookies with `withCredentials: true`. The whole thing — backend Observable + browser EventSource + live UI — came together cleanly once I got those two RxJS details right."

**"Why did you build SpendWise?"**

> "Indian bank apps export transaction history only as PDFs or CSVs — there's no API. But the raw data is rich: you can detect Netflix, Spotify, gym memberships, insurance premiums all hiding in your statement. I wanted to build a system that actually reads that data and tells you what's leaking. The RAG chat was an interesting engineering problem — how do you let an AI answer questions about data it's never seen? That led me to embeddings and pgvector."

---

## Part 8: Deployment

### 9.1 Production Stack Overview

**Q: How is SpendWise deployed and what does it cost?**

> Total cost: **$0**. Frontend on **Vercel**. API as a Docker container on **Render** (free Web Service). PostgreSQL on **Neon** (serverless Postgres). Redis on **Upstash** (serverless Redis). Everything uses free tiers.

---

### 9.2 Why Each Platform

**Q: Why Vercel for the frontend?**

> Vercel is the company that builds Next.js — their platform has first-class support for it. Zero-config deployment: point it at the `apps/web` directory, set one env var (`NEXT_PUBLIC_API_URL`), and it builds and deploys automatically on every push to `main`. Free tier is generous (100GB bandwidth/month). The alternative (self-hosting Next.js on Render) would require writing and maintaining a Dockerfile for the frontend too — unnecessary complexity for a side project.

**Q: Why Render for the API?**

> Render supports deploying Docker containers on a free tier **with no credit card required** — that's rare. Railway removed their free tier. Fly.io requires a credit card. Heroku is paid. Render's free Web Service tier gives you one always-on container slot (with the cold start caveat). For a portfolio project where the goal is "have a live URL to share", Render's free Docker hosting is unmatched.

**Q: Why Neon for PostgreSQL?**

> Two reasons: free tier and `pgvector`. SpendWise needs the `pgvector` extension for storing 768-dim transaction embeddings and running cosine similarity search. Managed Postgres options with pgvector on free tiers are very limited:
> - **Supabase** has pgvector but pauses the database after 1 week of inactivity — unacceptable for a demo
> - **Railway** postgres has pgvector but no free tier anymore
> - **Neon** stays active as long as you make queries and has native pgvector support
> Neon also provides connection pooling and branching (useful for staging environments), but the main reason is: free + pgvector + always-on.

**Q: Why Upstash for Redis?**

> SpendWise needs Redis for two things: BullMQ job queues and rate-limit counters. Upstash is the only **serverless** Redis provider with a meaningful free tier (10,000 commands/day, no credit card). Standard Redis hosting (Redis Cloud, Railway Redis) either pauses or costs money. Upstash is HTTP-based under the hood, but exposes a standard Redis-compatible API — `ioredis` connects to it using the `rediss://` URL (note the extra `s` — that means TLS/SSL). I had to explicitly enable TLS in the ioredis connection config:
> ```typescript
> const tls = redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined;
> new Redis(redisUrl, { tls })
> ```
> Without that, the connection fails with EPIPE/ECONNRESET.

---

### 9.3 The Slow First Request — Why and What To Say

**Q: Your app is slow to load sometimes. Why?**

> Render's free Web Service tier has a **cold start**: if no request hits the service for 15 minutes, Render scales it down to zero. The next request has to spin up a fresh Docker container — download the image, start Node.js, connect to Postgres and Redis, and register all NestJS modules. This takes ~25–35 seconds.

> This is a deliberate trade-off: free hosting in exchange for latency on infrequent use. It's completely acceptable for a portfolio/demo app. A paying user would use Render's Starter plan ($7/month) which keeps the container always-on.

> **How to demo around it:** Open the app URL and `/health` endpoint a few seconds before showing it to someone. The first request pays the cold start cost; subsequent requests are fast.

**Q: Does the database also have a cold start?**

> Neon also has a serverless cold start (their "scale-to-zero" feature), but it's much faster — typically under 1 second. The main visible latency is always Render's container startup.

---

### 9.4 Why Redis — Not Just "Because BullMQ Needs It"

**Q: Why do you need Redis at all? Why not just use `setTimeout` or a database table for jobs?**

> Three reasons Redis specifically:

> **1. Job persistence across restarts.** `setTimeout` is in-process memory. If the Node.js server restarts mid-job (Render redeploys, crash, OOM), the job is lost forever. Redis persists job state externally — BullMQ can resume where it left off after a restart.

> **2. Rate-limit counters.** SpendWise limits AI calls per user (20 chat messages/day, 4 recommendations/day). These counters need to be fast (sub-millisecond reads on every request) and have automatic TTL expiry. Redis `INCR` + `EXPIRE` is the canonical pattern. Using Postgres for this would add DB load on every single API call.

> **3. Recommendation caching.** AI recommendations are cached in Redis for 6 hours (`ai:recs:{userId}`). A fresh Gemini call costs latency and burns the user's daily quota. Redis `GET`/`SET` with TTL is the right tool — not Postgres (no TTL support on rows), not in-memory (doesn't survive restarts).

> **Why not a database table for the job queue?** Database polling (checking a `jobs` table every N seconds) is inefficient and adds latency. BullMQ uses Redis pub/sub for instant job delivery — a worker picks up a job the moment it's enqueued, with no polling lag.

---

### 9.5 Environment Variables — What Each One Does

**Q: Walk me through every env var you set on Render and why it's needed.**

| Variable | Value | Why it's needed |
|----------|-------|-----------------|
| `DATABASE_URL` | `postgresql://...@ep-long-shape.neon.tech/neondb?sslmode=require` | Prisma connection string. The `sslmode=require` is mandatory for Neon — connections without SSL are rejected. |
| `REDIS_URL` | `rediss://default:...@...upstash.io:6379` | `ioredis` connection. The `rediss://` prefix (double `s`) signals TLS — required by Upstash. Without this, BullMQ jobs queue up but the connection silently fails. |
| `JWT_SECRET` | 64-char hex string | Signs the 15-minute access token. Must be at least 32 chars; longer = harder to brute-force. Never reuse across environments. |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime. Short on purpose — limits the window of a stolen token. |
| `JWT_REFRESH_SECRET` | Different 64-char hex string | Signs the 7-day refresh token. **Must be different** from `JWT_SECRET` — if they were the same, a refresh token could be used as an access token. |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | How long the user stays logged in without re-entering their password. |
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio key. Starts with `AIzaSy`. Used for both Gemini 2.5 Flash (chat/recs) and Gemini embedding-2 (vector embeddings). Get it free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| `NODE_ENV` | `production` | NestJS and Express change behaviour in production: detailed error messages are hidden from responses, cookie flags change to `SameSite=None; Secure` for cross-origin support. |
| `PORT` | `3001` | The port NestJS listens on inside the container. Render routes external HTTPS traffic to this port. |
| `FRONTEND_URL` | `https://spendwise-web-nine.vercel.app` | Used in CORS config (`app.enableCors({ origin: FRONTEND_URL })`). Without this, the browser blocks all API responses — cross-origin requests from Vercel to Render are rejected. |
| `RESEND_API_KEY` | `re_...` | Optional. Used only for sending email alerts and weekly digests. If absent, the app starts normally and email features are silently skipped. |

**Q: How do you get the `GEMINI_API_KEY`?**

> 1. Go to [aistudio.google.com](https://aistudio.google.com)
> 2. Sign in with a Google account
> 3. Click **"Get API key"** → **"Create API key"**
> 4. Copy the key — it starts with `AIzaSy`
> 5. Free tier includes Gemini 2.5 Flash and gemini-embedding-2 with no credit card required

**Q: Why are two different JWT secrets needed?**

> If `JWT_SECRET` and `JWT_REFRESH_SECRET` were the same value, an attacker who obtained a valid refresh token (7-day lifetime) could use it as an access token by stripping the `Bearer` prefix — both tokens would verify against the same secret. Using separate secrets means a refresh token is cryptographically invalid as an access token, even if it passes signature verification.

---

### 9.6 How the RAG Pipeline Works End-to-End

**Q: Walk me through exactly what happens when a user sends an AI chat message.**

```text
User types: "What was my biggest expense last month?"

1. POST /api/ai/chat { question: "What was my biggest expense last month?" }

2. Rate limit check (Redis INCR ai:chat:rate:{userId})
   → If > 20 in 24h: return 429 Too Many Requests

3. RagService.search(userId, question, topK=8):
   a. Embed the question: Gemini gemini-embedding-2 API call
      → 768-dim vector of the question text
   b. pgvector cosine query:
      SELECT merchant, category, amount, date, type
      FROM transactions
      WHERE user_id = {userId} AND embedding IS NOT NULL
      ORDER BY embedding <=> {query_vector}::vector
      LIMIT 8
      → Returns 8 most semantically similar past transactions

4. AiService fetches ALL transactions for userId (sorted by amount DESC)
   → Pre-computes: total debits, total credits, category breakdown, largest single debit

5. Builds prompt:
   COMPLETE TRANSACTION LIST (all N transactions, sorted by amount):
   Summary: ₹X total debits, ₹Y total credits
   By category: Food ₹X, Shopping ₹Y, ...
   Largest single debit: Merchant ₹Z on YYYY-MM-DD
   [full transaction list line by line]

   Additional semantic matches (RAG):
   [8 most similar transactions from pgvector search]

   Question: What was my biggest expense last month?

6. Gemini 2.5 Flash generates answer from the combined context
   → Returns plain text

7. POST /api/ai/chat returns { answer: "...", sourcesUsed: 8 }
```

**Q: Why both RAG chunks AND the full transaction list? Isn't one enough?**

> They serve different purposes. RAG (cosine similarity search) is good at finding *semantically relevant* transactions — if you ask "tell me about my coffee spending" it surfaces Starbucks, Café Coffee Day, etc. But cosine similarity is bad at aggregate/numerical queries — "what was my biggest expense?" doesn't reliably return the highest-amount transaction because semantic similarity has nothing to do with amount. The full transaction list sorted by amount ensures factual accuracy for aggregate questions. The RAG chunks provide supplemental semantic context. Without both, the AI gives confidently wrong answers.

---

### 9.7 How the API Calls Flow (Frontend → API)

**Q: How does a page like the dashboard actually load its data?**

```text
1. Next.js renders the dashboard page (client component)

2. TanStack Query fires parallel requests:
   - GET /api/transactions/overview    → stat cards (total spent, income, etc.)
   - GET /api/transactions?limit=8     → recent transactions table
   - GET /api/transactions/daily-spend?days=60 → area chart data
   - GET /api/ai/recommendations       → AI savings card

3. Each request:
   a. Axios attaches the access_token cookie automatically (httpOnly, set by the API)
   b. NestJS JwtAuthGuard verifies the JWT signature and expiry
   c. If 401 → Axios interceptor fires POST /api/auth/refresh
                browser sends refresh_token cookie automatically
                API issues new tokens as new cookies
                original request retried
   d. Response returned, TanStack Query caches it

4. CORS: Render API has `Access-Control-Allow-Origin: https://spendwise-web-nine.vercel.app`
   → Browser allows the cross-origin response (Vercel → Render)
   → Without FRONTEND_URL set correctly on Render, ALL requests are blocked here
```

**Q: Why does it sometimes take longer for the AI recommendations card to load vs the rest of the dashboard?**

> Two reasons. First, if the result isn't cached in Redis, it makes a live Gemini API call which takes 2–4 seconds. Second, the recommendations endpoint fetches all the user's transactions from Postgres, builds a stats object, and sends it all to Gemini — more I/O than the other dashboard endpoints. The result is Redis-cached for 6 hours so subsequent loads are instant (cache hit returns in <10ms).

---

### 9.2b Why Each Platform (continued Q&A)

**Q: Why not just deploy everything on one platform?**

> Each platform is purpose-built for its role:
> - Vercel is optimised for Next.js with edge caching, automatic preview deployments on PRs, and zero-config builds
> - Render is the only free-tier Docker host — the API needs Docker because it runs Prisma migrations on startup, which requires the full Node + Prisma CLI environment
> - Neon's free tier is the only managed Postgres with pgvector that doesn't pause
> - Upstash is the only serverless Redis with a free tier
> Combining them gives a production-grade stack at $0.

**Q: How does auto-deploy work when you push code?**

> GitHub is connected to both Vercel and Render. Every push to `main`:
> 1. GitHub Actions CI runs (type-check + build verification on both API and web)
> 2. Vercel detects the push, rebuilds `apps/web`, deploys to CDN edge nodes worldwide
> 3. Render detects the push, rebuilds the Docker image from `apps/api/Dockerfile`, runs `prisma migrate deploy`, starts the new container

---

## Part 9: Red Flags to Avoid

1. **Don't say "I used Gemini because it's free"** — say "cost was a factor, but Gemini 2.5 Flash handles structured output reliably and the model quality is competitive. The migration from Claude was a business decision, not a technical compromise."
2. **Don't hand-wave the RAG pipeline** — be ready to explain exactly what `<=>` does, what 768-dim means, why `outputDimensionality: 768` is different from a 768-dim native model, and why top-8 was chosen for retrieval
3. **Don't say tokens are "secure"** — say "httpOnly cookies protect against XSS token theft; SameSite=Lax/None mitigates CSRF. No system is completely secure."
4. **Don't claim subscriptions are perfectly detected** — say "confidence ≥ 0.7 gives reasonable precision; false positives are possible on irregular but frequent merchants, which is why users can manually dismiss detections"
5. **Don't forget the async angle** — interviewers love asking why you chose a job queue; be ready with the "synchronous = 8 second user wait + timeout risk" answer
6. **Don't fumble the cold start question** — it's not a bug, it's a known free-tier trade-off. Have the Render spin-down/spin-up explanation ready.
7. **Don't say you "just set env vars"** — be ready to explain WHY each variable exists (see section 9.5)
8. **Don't say the privacy trade-off doesn't exist** — acknowledge that Gemini receives transaction text, explain the mitigations, and mention the local-model alternative

