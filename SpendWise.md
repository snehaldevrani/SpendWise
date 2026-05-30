# SpendWise AI Blueprint

## 1) What You Are Building
SpendWise AI is a full-stack personal finance web app.

In simple words:
- User uploads bank/expense statements (CSV or PDF).
- App categorizes expenses.
- App finds recurring subscriptions and spend leaks.
- AI assistant explains where money is leaking and what to do.
- RAG-powered conversational Q&A over the user's own financial history.
- MCP server so Claude can natively query SpendWise as a tool.

This is a strong real-world full-stack project because it solves an everyday pain: unnecessary spending.

---

## 2) Project Aim and Impact
### Aim
Help users save money by identifying invisible recurring expenses and bad spending patterns.

### Real impact goals
- Reduce avoidable monthly spend.
- Help users cancel unused subscriptions.
- Give clear weekly action steps.

### Resume impact
Shows complete software engineering skillset:
- Frontend + backend + database + async jobs + AI integration + RAG + MCP

---

## 3) Product Scope
### MVP (must build)
- Signup/login
- CSV upload of transactions
- Transaction list and category breakdown
- Recurring charge detection
- AI chat summary: where money leaks and how to reduce

### V2 (strong additions)
- PDF upload support (bank statements as PDFs via RAG pipeline)
- Semantic search over transaction history (RAG)
- Conversational Q&A: "Was February better than last year?" (RAG)
- Price increase detection for same merchant
- Weekly alert emails
- Goal tracking (save X this month)
- Smart reminders (cancel/downgrade/review)

### V3 (differentiator)
- SpendWise as an MCP server: expose financial tools for Claude to call natively
- Tools: get_spending_summary, get_subscriptions, find_anomalies, get_recommendations, search_transactions

---

## 4) Recommended Tech Stack
### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Recharts (graphs)

### Backend
- Node.js + NestJS
- REST APIs

### Database
- PostgreSQL (main source of truth)
- pgvector extension (vector embeddings for RAG — no extra infra needed)

### Cache and jobs
- Redis (for caching + background jobs)
- BullMQ (scheduled/queued tasks)

### AI layer
- Claude API (primary — structured output, tool use, MCP)
- RAG pipeline: embed transactions → pgvector → semantic retrieval → Claude generation
- MCP server: expose SpendWise tools so Claude can query the app natively

### Auth
- Auth.js or Clerk

### Deployment
- Frontend: Vercel
- Backend + DB + Redis: Railway/Render/Fly or AWS

---

## 5) High-Level Architecture
```
Browser UI
-> Next.js frontend
-> Backend API
-> PostgreSQL + pgvector (transactions, users, plans, embeddings)
-> Redis (cache and job queue)
-> RAG pipeline (embed -> search -> inject -> generate)
-> Claude API (analysis prompt / MCP tool calls)
-> MCP Server (SpendWise tools exposed to Claude Desktop / external agents)
```

### Request flow — CSV upload
1. User uploads CSV.
2. Backend parses and normalizes rows.
3. Data saved in PostgreSQL.
4. Background job computes recurring subscriptions.
5. Transactions embedded and stored in pgvector.
6. Dashboard fetches summaries.
7. AI assistant reads summaries and returns actions.

### Request flow — RAG Q&A
1. User asks: "Which month did I overspend on food?"
2. Query embedded via Claude Embeddings.
3. pgvector similarity search retrieves relevant transaction chunks.
4. Chunks injected as context into Claude prompt.
5. Claude answers grounded in real user data.

### Request flow — MCP
1. Claude Desktop or external agent connects to SpendWise MCP server.
2. Claude calls `get_spending_summary(month="March")` as a tool.
3. MCP server queries PostgreSQL and returns structured JSON.
4. Claude uses the result to reason and respond.

---

## 6) Folder Structure
```
spendwise/
- README.md
- docker-compose.yml
- TODO.md
- apps/
  - web/          (Next.js)
  - api/          (NestJS)
  - mcp-server/   (SpendWise MCP server)
- packages/
  - shared-types/
  - config/
- infra/
  - db/
  - scripts/
- docs/
  - api-spec.md
```

### Backend structure
```
api/src/
- modules/
  - auth/
  - users/
  - transactions/
  - uploads/
  - subscriptions/
  - insights/
  - ai/
  - rag/
  - alerts/
- jobs/
- utils/
```

---

## 7) Core Data Model
### users
- id
- email
- password_hash or oauth_id
- created_at

### transactions
- id
- user_id
- date
- merchant
- amount
- currency
- category
- type (debit/credit)
- raw_text
- embedding (vector — pgvector)

### subscriptions
- id
- user_id
- merchant
- estimated_cycle_days
- avg_amount
- confidence_score
- last_charge_date
- next_expected_date

### insights
- id
- user_id
- week_start
- summary_json
- created_at

### documents (for RAG PDF uploads)
- id
- user_id
- filename
- content_type
- uploaded_at

### document_chunks
- id
- document_id
- user_id
- chunk_text
- chunk_index
- embedding (vector — pgvector)

---

## 8) Feature Build Plan

### Feature A: Auth
- signup/login/logout
- JWT + refresh tokens
- route protection middleware
- secure password hashing

### Feature B: CSV Ingestion
- upload endpoint
- CSV parser + row normalization
- input validation
- idempotency (hash-based dedup to prevent duplicate imports)
- error reporting to UI

### Feature C: Categorization
- keyword rules engine (food, travel, bills, etc.)
- manual user recategorization
- category aggregation queries

### Feature D: Recurring Detection
- group transactions by merchant
- detect periodic intervals
- confidence scoring
- subscriptions table management

### Feature E: Leak Detection
- identify low-usage / zero-use subscriptions
- price increase detection (same merchant, rising amount)
- anomaly detection (unusual spikes)

### Feature F: AI Assistant (Claude API)
- aggregated stats sent to Claude
- structured JSON response: top leaks, savings plan, action checklist
- guardrails: suggestions not guarantees, show reasoning from data

### Feature G: RAG Pipeline
- pgvector setup in PostgreSQL
- embed transactions on insert (Claude Embeddings or OpenAI)
- embed PDF/document chunks on upload
- semantic search endpoint
- conversational Q&A: query → embed → retrieve → inject → generate

### Feature H: MCP Server
- NestJS or standalone MCP server
- tools: get_spending_summary, get_subscriptions, find_anomalies, get_recommendations, search_transactions
- test with Claude Desktop

### Feature I: Weekly Alerts
- BullMQ scheduled job
- email summary (Nodemailer or Resend)
- retry + dead-letter handling

---

## 9) AI Design
Important:
- Financial guidance only, not investment promises.
- Suggestions, not guaranteed outcomes.
- Show reasoning from user's own data.

### AI output format
- Top 3 spend leaks
- Estimated monthly savings
- 5-item action checklist
- Risk / uncertainty notes

### Prompt policy
- Use only user transaction aggregates.
- Never claim certainty when confidence is low.
- Return structured JSON for UI rendering.

### RAG policy
- Only retrieve chunks owned by the requesting user (user_id scoped queries).
- Never expose one user's data in another user's context.
- Chunk size: ~300 tokens with 50-token overlap.

---

## 10) API Endpoints
- POST /auth/signup
- POST /auth/login
- POST /uploads/csv
- POST /uploads/pdf
- GET /transactions
- GET /summary/monthly
- GET /subscriptions
- GET /insights/current
- POST /ai/recommendations
- POST /ai/chat (RAG-powered Q&A)
- GET /search/transactions (semantic)
- POST /alerts/test

---

## 11) UI Pages
- /login
- /dashboard
- /transactions
- /subscriptions
- /insights
- /settings

### Dashboard widgets
- This month spend
- Category pie chart
- Recurring charges list
- Leak alerts
- AI action plan card
- Ask AI (RAG chat input)

---

## 12) Security and Privacy
- Encrypt sensitive fields where needed.
- Do not log raw personal finance data in plain text logs.
- Rate limiting on upload and AI endpoints.
- Secrets in env vars only.
- Data deletion endpoint for user.
- RAG queries scoped strictly to user_id.

---

## 13) Testing Strategy
### Unit tests
- CSV parser
- categorization rules
- recurring detection algorithm
- RAG chunking logic

### Integration tests
- upload → parse → DB → embed flow
- auth-protected routes
- AI endpoint schema validation
- MCP tool responses

### E2E tests
- signup → upload CSV → see dashboard insights
- ask RAG question → receive grounded answer

---

## 14) Deployment Plan
### Local
- Docker Compose: web + api + mcp-server + postgres (with pgvector) + redis

### Staging
- Deploy API + DB + Redis on Railway/Render
- Deploy web frontend on Vercel
- Deploy MCP server (expose publicly for Claude Desktop testing)

### Production
- Add monitoring and backups
- Add BullMQ job queue dashboard
- Add Prometheus + Grafana for observability

---

## 15) Definition of Done
- User can upload statement and get useful insights.
- Recurring subscriptions detected with confidence score.
- AI gives clear actionable weekly plan grounded in real data.
- User can ask natural language questions about their own finances (RAG).
- MCP server is live and Claude Desktop can call SpendWise tools.
- App is deployed and demoable publicly.
- README includes architecture diagram, setup instructions, and screenshots.

---

## 16) Resume Bullet (After Completion)
Built a full-stack AI personal finance platform using Next.js, NestJS, PostgreSQL + pgvector, and Claude API — featuring RAG-powered conversational expense analysis, recurring subscription detection, and an MCP server exposing financial intelligence tools for agentic AI workflows.
