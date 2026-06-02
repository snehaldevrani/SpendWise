-- HNSW vector index for fast approximate nearest-neighbour search on transaction embeddings
-- ef_construction=128 gives a good recall/speed tradeoff for up to ~1M rows per user
-- Note: CONCURRENTLY removed — Prisma wraps migrations in a transaction which forbids it
CREATE INDEX IF NOT EXISTS transactions_embedding_hnsw
  ON transactions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

-- HNSW index for document chunk embeddings
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);
