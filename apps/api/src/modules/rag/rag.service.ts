import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../common/prisma/prisma.service';

const TOP_K = 8;
const EMBEDDING_DIMS = 768;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.genAI = new GoogleGenerativeAI(this.config.get('GEMINI_API_KEY', ''));
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
    const results: number[][] = [];
    for (const text of texts) {
      // outputDimensionality is a valid API parameter not yet reflected in the SDK types;
      // using a typed cast instead of `as any` for safety.
      const request = {
        content: { role: 'user', parts: [{ text }] } as { role: string; parts: { text: string }[] },
        outputDimensionality: EMBEDDING_DIMS,
      };
      const result = await model.embedContent(request as Parameters<typeof model.embedContent>[0]);
      results.push(result.embedding.values);
    }
    return results;
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
      const embeddings = await this.embedTexts(texts);

      for (let i = 0; i < txns.length; i++) {
        const embedding = embeddings[i];
        if (!embedding) continue;

        // Use Prisma tagged template ($executeRaw) — parameters are bound, not interpolated.
        // The embedding array is serialised to a string first, then passed as a typed $1 parameter.
        const vectorLiteral = `[${embedding.join(',')}]`;
        await this.prisma.$executeRaw`UPDATE transactions SET embedding = ${vectorLiteral}::vector WHERE id = ${txns[i].id} AND user_id = ${userId}`;
      }
    } catch (err) {
      this.logger.error('Failed to embed transactions', err);
    }
  }

  async embedAllForUser(userId: string): Promise<void> {
    const txns = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM transactions WHERE user_id = ${userId} AND embedding IS NULL
    `;
    if (txns.length === 0) return;
    const ids = txns.map((t) => t.id);
    for (let i = 0; i < ids.length; i += 50) {
      await this.embedTransactions(userId, ids.slice(i, i + 50));
    }
  }

  async search(userId: string, query: string): Promise<string[]> {
    let queryEmbedding: number[];
    try {
      const embeddings = await this.embedTexts([query]);
      queryEmbedding = embeddings[0] ?? [];
    } catch (err) {
      this.logger.error('Failed to embed query', err);
      return [];
    }

    if (queryEmbedding.length !== EMBEDDING_DIMS) return [];

    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<
      Array<{ merchant: string; category: string; amount: number; date: Date; type: string }>
    >`
      SELECT merchant, category, amount::float, date, type
      FROM transactions
      WHERE user_id = ${userId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT 8
    `;

    return results.map(
      (r) =>
        `${new Date(r.date).toISOString().slice(0, 10)}: ${r.merchant} (${r.category}) - ₹${r.amount} [${r.type}]`,
    );
  }
}
