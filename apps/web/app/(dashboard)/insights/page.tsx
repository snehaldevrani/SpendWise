'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Sparkles, Send, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Amount } from '@/components/ui/amount';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { AiRecommendation } from '@/lib/types';

interface ChatMessage { role: 'user' | 'assistant'; content: string; sources?: number; }

const SUGGESTED = [
  'What did I spend most on last month?',
  'Which subscriptions should I cancel?',
  'How does this month compare to last?',
  'What are my biggest spend leaks?',
];

export default function InsightsPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: recommendations, isLoading } = useQuery<AiRecommendation>({
    queryKey: ['ai-recommendations'],
    queryFn: () => api.get('/ai/recommendations').then((r) => r.data),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const chat = useMutation({
    mutationFn: (question: string) =>
      api.post('/ai/chat', { question }).then((r) => r.data as { answer: string; sourcesUsed: number }),
    onMutate: (question) => {
      setMessages((prev) => [...prev, { role: 'user', content: question }]);
      setInput('');
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, sources: data.sourcesUsed },
      ]);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chat.isPending]);

  const handleSend = (q?: string) => {
    const question = q ?? input.trim();
    if (!question) return;
    chat.mutate(question);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 h-[calc(100vh-8rem)] pb-20 lg:pb-0">

      {/* Chat panel */}
      <Card className="lg:col-span-3 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border flex-shrink-0">
          <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
          <p className="text-sm font-semibold text-foreground">Ask AI about your finances</p>
          <span className="ml-auto text-[10px] text-muted-foreground">Powered by Claude + RAG</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand-muted)] flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-[var(--color-brand)]" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">Ask anything about your spending</p>
                <p className="text-sm text-muted-foreground">Your data stays private — only used to answer your questions</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-xs text-muted-foreground bg-secondary hover:bg-secondary/80 px-3 py-2 rounded-xl transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-[var(--color-brand-muted)] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'max-w-[75%]' : ''}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-foreground text-background rounded-br-sm'
                      : 'bg-secondary text-foreground rounded-bl-sm border border-border'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && msg.sources !== undefined && (
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">
                    Based on {msg.sources} transactions
                  </p>
                )}
              </div>
            </div>
          ))}

          {chat.isPending && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--color-brand-muted)] flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-brand)]" />
              </div>
              <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`w-1.5 h-1.5 bg-muted-foreground rounded-full typing-dot`} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border flex-shrink-0">
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGGESTED.slice(0, 2).map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs text-muted-foreground bg-secondary hover:bg-secondary/80 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              className="flex-1 resize-none bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] min-h-[40px] max-h-32"
              placeholder="Ask about your spending..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || chat.isPending}
              className="w-10 h-10 bg-[var(--color-brand)] hover:opacity-90 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-opacity flex-shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Recommendations panel */}
      <div className="lg:col-span-2 overflow-y-auto space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          AI Recommendations
        </p>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : !recommendations ? (
          <Card className="p-5 border-dashed text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Upload transactions to unlock AI recommendations</p>
          </Card>
        ) : (
          <>
            {/* Savings summary */}
            <Card className="p-4 bg-[var(--color-success-muted)] border-[var(--color-success)]/20">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-[var(--color-success)]" />
                <p className="text-xs font-semibold text-[var(--color-success)] uppercase tracking-wider">
                  Potential Savings
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(recommendations.estimatedMonthlySavings)}
              </p>
              <p className="text-xs text-muted-foreground">/month if you act on all recommendations</p>
            </Card>

            {/* Top leaks */}
            {recommendations.topLeaks.map((leak, i) => (
              <Card key={i} className="p-4 border-l-4 border-l-rose-400">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-foreground">{leak.merchant}</p>
                  <Amount value={leak.estimatedMonthlySavings} size="sm" positive />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{leak.reason}</p>
                <p className="text-[10px] text-muted-foreground mt-1">/mo potential saving</p>
              </Card>
            ))}

            {/* Action checklist */}
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action Plan</p>
              </div>
              <div className="space-y-2">
                {recommendations.actionChecklist.map((action, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-brand-muted)] text-[var(--color-brand)] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </Card>

            {recommendations.uncertaintyNotes && (
              <p className="text-xs text-muted-foreground px-1 italic">{recommendations.uncertaintyNotes}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
