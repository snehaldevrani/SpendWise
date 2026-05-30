import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

const TOP_K = 8;
const EMBEDDING_DIMS = 1024;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private voyageApiKey: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.voyageApiKey = this.config.get('VOYAGE_API_KEY', '');
  }

  private async callVoyageEmbed(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.voyageApiKey}`,
      },
      body: JSON.stringify({ input: texts, model: 'voyage-3-lite' }),
    });
    if (!response.ok) throw new Error(`Voyage API error: ${response.status}`);
    const json = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return json.data.map((d) => d.embedding);
  }

  async embedTransactions(userId: string, transactionIds: string[]): Promise<void> {
    const txns = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, userId },
      select: { id: true, merchant: true, category: true, amount: true, date: true, type: true },
    });

    if (txns.length === 0) return;

    const texts = txns.map(
      (t) =>
        `${t.date.toISOString().slice(0, 10)} ${t.merchant} ${t.category} ${t.type} ${t.amount}`,
    );

    try {
      const embeddings = await this.callVoyageEmbed(texts);

      for (let i = 0; i < txns.length; i++) {
        const embedding = embeddings[i];
        if (!embedding) continue;

        await this.prisma.$executeRawUnsafe(
          `UPDATE transactions SET embedding = $1::vector WHERE id = $2`,
          `[${embedding.join(',')}]`,
          txns[i].id,
        );
      }
    } catch (err) {
      this.logger.error('Failed to embed transactions', err);
    }
  }

  async embedAllForUser(userId: string): Promise<void> {
    const txns = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM transactions WHERE user_id = $1 AND embedding IS NULL`,
      userId,
    );
    if (txns.length === 0) return;
    const ids = txns.map((t) => t.id);
    for (let i = 0; i < ids.length; i += 50) {
      await this.embedTransactions(userId, ids.slice(i, i + 50));
    }
  }

  async search(userId: string, query: string, topK = TOP_K): Promise<string[]> {
    let queryEmbedding: number[];
    try {
      const embeddings = await this.callVoyageEmbed([query]);
      queryEmbedding = embeddings[0] ?? [];
    } catch (err) {
      this.logger.error('Failed to embed query', err);
      return [];
    }

    if (queryEmbedding.length !== EMBEDDING_DIMS) return [];

    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRawUnsafe<
      Array<{ merchant: string; category: string; amount: number; date: Date; type: string }>
    >(
      `SELECT merchant, category, amount::float, date, type
       FROM transactions
       WHERE user_id = $1 AND embedding IS NOT NULL
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      userId,
      vectorStr,
      topK,
    );

    return results.map(
      (r) =>
        `${new Date(r.date).toISOString().slice(0, 10)}: ${r.merchant} (${r.category}) - ₹${r.amount} [${r.type}]`,
    );
  }
}
