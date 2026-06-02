# SpendWise Interview Preparation Guide

---

## Part 1: The One-Paragraph Pitch

> "SpendWise is a full-stack AI personal finance platform. Users upload bank statements, and the system automatically categorises transactions, detects recurring subscriptions, generates weekly spending summaries, and provides an AI assistant that answers questions grounded in your own transaction history using RAG. It also ships an MCP server, so Claude Desktop can natively query your finances as first-class tools. The stack is NestJS + Next.js 15, PostgreSQL with pgvector for semantic search, Redis + BullMQ for async job processing, Google Gemini 2.5 Flash for AI chat and recommendations, and Gemini embedding-2 for 768-dim vector embeddings. The project originally used Claude Sonnet 4.6 and Voyage AI, but I migrated to Gemini for cost reasons — the free tier is generous enough for a real product. Auth uses httpOnly cookies — no tokens in localStorage. Everything that can fail asynchronously runs through a retryable BullMQ queue."

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

### Request Flow: CSV Upload

```text
1. User uploads CSV via multipart/form-data
2. CsvParserService normalises bank-specific column aliases
   (HDFC: "Withdrawal Amt." ? amount; ICICI: "Transaction Amount" ? amount)
3. Transactions saved to DB
4. Three BullMQ jobs enqueued in order:
   a. JOB_EMBED_TRANSACTIONS  → Gemini gemini-embedding-2 embeds each transaction → pgvector (768-dim)
   b. JOB_DETECT_SUBSCRIPTIONS ? stddev confidence scoring ? Subscription table
   c. JOB_COMPUTE_INSIGHTS   ? weekly summaries ? Insight table
5. All 3 jobs: 3 attempts with exponential backoff on failure
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
7. Claude answers grounded in complete, accurate transaction data
8. AI can only see the user's own data (userId scoping on every query)
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
const result = await model.embedContent({
  content: { role: 'user', parts: [{ text }] },
  outputDimensionality: 768,
} as any);
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

## Part 4: Questions They Will Ask

**"Walk me through your tech stack choices."**

> "Frontend: Next.js 15 with the App Router — all pages are client components using TanStack Query for data fetching, so the UX stays snappy with background refetching and cache invalidation. Backend: NestJS because I wanted strong TypeScript, DI, and module boundaries. Database: PostgreSQL because I needed both relational queries and vector search in one place — pgvector handles both. Redis for BullMQ job queue persistence — jobs survive server restarts. Claude Sonnet 4.6 for AI because its structured output and tool use are the most reliable. Voyage AI for embeddings specifically because they outperform OpenAI's ada-002 on retrieval benchmarks for multilingual and short-text tasks, which matters for transaction descriptions. I also built an MCP server so Claude Desktop can query SpendWise natively — that required extending the JWT strategy to accept Bearer tokens in addition to cookies."

**"How does your auth work?"**

Explain the full cookie flow: signup ? tokens set as httpOnly cookies ? every API call browser sends cookie automatically ? JWT Strategy reads from cookie ? 401 ? Axios interceptor calls /refresh ? new cookies set ? retry original request. Mention refresh token rotation and why it matters.

**"What would you add if you had more time?"**

> "Three things. First, hybrid search — combine pgvector cosine similarity with full-text search on merchant names so users can search by exact merchant name alongside semantic queries. Second, PDF parsing — most Indian banks export PDFs, not CSVs. Third, a Bull Board dashboard for the BullMQ queues so I can see job health, retry failed jobs, and monitor throughput without SSH-ing into the server."

**"How do you handle sensitive financial data?"**

> "Data in transit: HTTPS only, httpOnly cookies prevent JavaScript access. Data at rest: PostgreSQL with encrypted disk volumes in production. Application layer: every query is scoped by userId — no cross-user data access is architecturally possible. No PII is sent to Gemini — only anonymised transaction descriptions and amounts. Refresh tokens are stored hashed in the DB."

**"Your project stores transaction descriptions in a third-party embedding service — isn't that a privacy concern?"**

> "Yes, and it's a deliberate trade-off I'd improve in production. Currently Gemini receives transaction description text. The mitigations are: descriptions are not linked to user identity in the API call, and Google's terms cover standard API usage. A stronger solution would be a locally-hosted embedding model (e.g., a quantised sentence-transformer) so no financial text leaves the infrastructure. That's on my roadmap."

---

## Part 5: Trade-offs to Articulate

| Decision | What you chose | What you gave up | Why it's fine |
|----------|---------------|-----------------|---------------|
| httpOnly cookies over localStorage | XSS safety | Slightly more complex refresh flow | Worth it — token theft is a real attack |
| BullMQ over sync processing | Resilience, non-blocking uploads | Added complexity (Redis dependency) | Users shouldn't wait 8 seconds for embeddings |
| pgvector over Pinecone | Single service, SQL joins | Scale ceiling (~10M vectors) | More than enough for this use case |
| Gemini over Claude + Voyage | Free tier, single API key | Claude's more reliable structured output | Gemini 2.5 Flash handles JSON output well enough; cost wins |
| gemini-embedding-2 with outputDimensionality | 768-dim, compatible with existing schema | Native 3072-dim would be higher quality | Matryoshka truncation retains quality; smaller vectors = faster search |
| JSON summaryJson in Insight table | Flexible schema for weekly data | No SQL filtering on summary internals | Weekly summaries are read-only blobs |
| MCP server as separate process | Reuses API endpoints, no code duplication | Extra process to manage | Clean separation — MCP server is just an API client |
| Global exception filter | Consistent error shape, no stack traces in prod | Slightly less granular per-route control | One place to change error format for the whole API |

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
| Subscription confidence | stddev-based score measuring how closely a merchant's charge intervals match a known billing cycle |
| ISO week grouping | Monday-anchored week boundaries — ensures consistent weekly spend summaries |
| Turborepo | Monorepo build system — runs api and web concurrently with shared TypeScript types |
| MCP server | Node.js process exposing SpendWise as 6 typed tools Claude Desktop can call natively via MCP protocol |
| Global exception filter | `@Catch()` decorator catches all unhandled exceptions and returns consistent JSON error responses |
| TanStack Query | Client-side data fetching with automatic caching, background refetch, and request deduplication |

---

## Part 7: Red Flags to Avoid

1. **Don't say "I used Gemini because it's free"** — say "cost was a factor, but Gemini 2.5 Flash handles structured output reliably and the model quality is competitive. The migration from Claude was a business decision, not a technical compromise."
2. **Don't hand-wave the RAG pipeline** — be ready to explain exactly what `<=>` does, what 768-dim means, why `outputDimensionality: 768` is different from a 768-dim native model, and why top-5 was chosen
3. **Don't say tokens are "secure"** — say "httpOnly cookies protect against XSS token theft; SameSite=Lax mitigates CSRF. No system is completely secure."
4. **Don't claim subscriptions are perfectly detected** — say "confidence ? 0.7 gives reasonable precision; false positives are possible on irregular but frequent merchants, which is why users can manually dismiss detections"
5. **Don't forget the async angle** — interviewers love asking why you chose a job queue; be ready with the "synchronous = 8 second user wait + timeout risk" answer

---

## Part 8: Your Story Arc

**"Tell me about a challenging technical problem in SpendWise."**

> "The AI chat was giving confidently wrong answers — it would say the biggest transaction was Amazon ₹844 when the actual largest was a ₹14,000 charge. The root cause was subtle: pure cosine similarity retrieves the 8 most semantically similar chunks, not the numerically largest ones. A ₹14,000 charge from an obscure merchant doesn't necessarily match the query 'biggest transaction' semantically. The fix was to stop treating RAG as the only data source. The chat method now fetches all transactions from the DB sorted by amount, pre-computes summary stats (total debits, category breakdown, largest single debit), and injects the complete structured context alongside the RAG chunks. The AI then answers from complete data, not a semantic sample. The lesson: vector similarity search is not a substitute for direct data access on factual/aggregate questions."

**"Why did you build SpendWise?"**

> "Indian bank apps export transaction history only as PDFs or CSVs — there's no API. But the raw data is rich: you can detect Netflix, Spotify, gym memberships, insurance premiums all hiding in your statement. I wanted to build a system that actually reads that data and tells you what's leaking. The RAG chat was an interesting engineering problem — how do you let an AI answer questions about data it's never seen? That led me to embeddings and pgvector."

---

## Part 9: Deployment

### 3.9 Production Stack

**Q: How is SpendWise deployed?**

> Frontend on **Vercel** (Next.js). API and Worker as Docker containers on **Render** (free Web Service + Background Worker). PostgreSQL on **Neon** (serverless Postgres with pgvector). Redis on **Upstash**. Total cost: $0.

**Q: Why Render over Railway or Fly.io?**

> Render has a free tier for both web services and background workers with no credit card required. The trade-off is a ~30 second cold start after 15 minutes of inactivity — acceptable for a portfolio project. Railway's free tier was removed; Fly.io requires a credit card. For a paying product I'd use Railway ($5/month) for always-on containers.

**Q: How does the database schema get applied in production?**

> The API Dockerfile's `CMD` runs `prisma migrate deploy` before starting the server. This means every deployment automatically applies any pending migrations against the production database. No manual step needed, no risk of schema drift.

**Q: Why Neon for Postgres?**

> Neon is the only free-tier managed Postgres provider that ships with `pgvector` support. Supabase also has pgvector but their free tier pauses after 1 week of inactivity. Neon's free tier stays active as long as you have recent queries — better fit for a demo app.

**Q: Why Upstash for Redis?**

> Upstash is the only serverless Redis with a meaningful free tier (10,000 commands/day). It's HTTP-based under the hood but exposes a standard Redis API — `ioredis` connects to it without any changes.

**Q: How does the worker run separately from the API?**

> The repo has two entry points: `main.ts` (HTTP server) and `worker.ts` (BullMQ processor). Both compile into `dist/`. On Render, the API service runs `node apps/api/dist/main` (default Dockerfile CMD) and the Worker service overrides the start command to `node apps/api/dist/worker.js`. They share the same Redis and Postgres but are independent processes — a crash in one doesn't affect the other.

**Q: How do the frontend and API handle cross-origin cookies in production?**

> Vercel and Render are on different domains, so cookies must be `SameSite=None; Secure`. The auth controller checks `NODE_ENV === 'production'` and sets those flags automatically. In development, `SameSite=Lax` is used — no HTTPS needed.

**Q: What environment variables does the production deployment need?**

> `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, `FRONTEND_URL`, `NODE_ENV=production`, `PORT=3001`. `RESEND_API_KEY` is optional — the app starts and runs without it; email alerts are silently skipped.
