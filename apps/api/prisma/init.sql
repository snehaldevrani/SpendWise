-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionCategory" AS ENUM (
    'food', 'travel', 'utilities', 'entertainment',
    'health', 'shopping', 'subscriptions', 'income', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- users
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  token      TEXT UNIQUE NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- transactions
CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TIMESTAMPTZ NOT NULL,
  merchant    TEXT NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'INR',
  category    "TransactionCategory" NOT NULL DEFAULT 'other',
  type        "TransactionType" NOT NULL,
  raw_text    TEXT NOT NULL,
  dedup_key   TEXT NOT NULL,
  embedding   vector(1024),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date     ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_user_merchant ON transactions(user_id, merchant);

-- subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant             TEXT NOT NULL,
  estimated_cycle_days INT NOT NULL,
  avg_amount           DECIMAL(12,2) NOT NULL,
  confidence_score     FLOAT NOT NULL,
  last_charge_date     TIMESTAMPTZ NOT NULL,
  next_expected_date   TIMESTAMPTZ NOT NULL,
  dismissed            BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, merchant)
);

-- insights
CREATE TABLE IF NOT EXISTS insights (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start   TIMESTAMPTZ NOT NULL,
  summary_json JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- documents
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- document_chunks
CREATE TABLE IF NOT EXISTS document_chunks (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  chunk_text  TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding   vector(1024)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_user ON document_chunks(user_id);

-- Prisma migrations table (so Prisma client recognises the schema)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  id                  TEXT PRIMARY KEY,
  checksum            TEXT NOT NULL,
  finished_at         TIMESTAMPTZ,
  migration_name      TEXT NOT NULL,
  logs                TEXT,
  rolled_back_at      TIMESTAMPTZ,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_steps_count INT NOT NULL DEFAULT 0
);
