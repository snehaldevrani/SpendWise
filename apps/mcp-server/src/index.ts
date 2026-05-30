import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const API_BASE = process.env.SPENDWISE_API_URL ?? 'http://localhost:3001/api';
const API_KEY = process.env.SPENDWISE_API_KEY ?? '';

async function apiFetch(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`SpendWise API ${res.status}: ${await res.text()}`);
  return res.json();
}

const server = new Server(
  { name: 'spendwise', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_spending_summary',
      description:
        'Get the monthly spending summary including total spend, breakdown by category, and comparison with the previous month.',
      inputSchema: {
        type: 'object',
        properties: {
          month: { type: 'number', description: 'Month number 1–12 (default: current month)' },
          year: { type: 'number', description: 'Full year e.g. 2025 (default: current year)' },
        },
      },
    },
    {
      name: 'get_transactions',
      description: 'Search and list transactions with optional filters.',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search term for merchant name' },
          category: {
            type: 'string',
            description:
              'Filter by category: food, travel, utilities, entertainment, health, shopping, subscriptions, income, other',
          },
          startDate: { type: 'string', description: 'ISO date string YYYY-MM-DD' },
          endDate: { type: 'string', description: 'ISO date string YYYY-MM-DD' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
      },
    },
    {
      name: 'get_subscriptions',
      description:
        'List detected recurring subscriptions with confidence scores and monthly cost estimates.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'find_anomalies',
      description:
        'Identify unusual or one-off large transactions that deviate from normal spending patterns.',
      inputSchema: {
        type: 'object',
        properties: {
          threshold: {
            type: 'number',
            description: 'Minimum amount to flag as anomaly (default: 5000)',
          },
        },
      },
    },
    {
      name: 'ask_financial_question',
      description:
        'Ask a natural language question about spending data. Uses semantic search over all transactions to ground the answer.',
      inputSchema: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            description: 'Plain-language question e.g. "How much did I spend on food last month?"',
          },
        },
      },
    },
    {
      name: 'get_ai_recommendations',
      description:
        'Get AI-generated savings recommendations with specific merchants and estimated monthly savings.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_spending_summary': {
        const now = new Date();
        const month = (args as { month?: number }).month ?? now.getMonth() + 1;
        const year = (args as { year?: number }).year ?? now.getFullYear();
        const data = await apiFetch(
          `/transactions/summary/monthly?month=${month}&year=${year}`,
        );
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'get_transactions': {
        const { search, category, startDate, endDate, limit = 20 } = args as {
          search?: string;
          category?: string;
          startDate?: string;
          endDate?: string;
          limit?: number;
        };
        const params = new URLSearchParams({ limit: String(limit) });
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const data = await apiFetch(`/transactions?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'get_subscriptions': {
        const data = await apiFetch('/subscriptions');
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'find_anomalies': {
        const threshold = (args as { threshold?: number }).threshold ?? 5000;
        const data = (await apiFetch(`/transactions?limit=500`)) as {
          items: Array<{ merchant: string; amount: number; date: string; category: string }>;
        };
        const anomalies = data.items?.filter((t) => t.amount >= threshold) ?? [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { count: anomalies.length, threshold, transactions: anomalies },
                null,
                2,
              ),
            },
          ],
        };
      }

      case 'ask_financial_question': {
        const { question } = z
          .object({ question: z.string() })
          .parse(args);
        const data = await fetch(`${API_BASE}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
          body: JSON.stringify({ question }),
        }).then((r) => r.json());
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'get_ai_recommendations': {
        const data = await apiFetch('/ai/recommendations');
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
