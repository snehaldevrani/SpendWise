-- Switch embedding dimensions from 512 (Voyage AI) to 768 (Google text-embedding-004)
-- Existing embeddings are nulled because they are incompatible with the new dimension.
-- Re-embedding happens automatically via the BullMQ embed job on next upload.

-- Drop HNSW indexes before altering column type
DROP INDEX IF EXISTS transactions_embedding_hnsw;
DROP INDEX IF EXISTS document_chunks_embedding_hnsw;

-- Resize embedding columns — NULL existing values (dimension change requires full re-embed)
ALTER TABLE transactions
  ALTER COLUMN embedding TYPE vector(768) USING NULL::vector(768);

ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE vector(768) USING NULL::vector(768);

-- Recreate HNSW indexes for new dimension
CREATE INDEX IF NOT EXISTS transactions_embedding_hnsw
  ON transactions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);
