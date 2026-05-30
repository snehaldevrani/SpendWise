'use client';
import { Sparkles, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import type { AiRecommendation } from '@/lib/types';

export function AIInsightCard({ insight }: { insight: AiRecommendation }) {
  const router = useRouter();
  return (
    <Card className="p-5 bg-[var(--color-brand-muted)] border-[var(--color-brand)]/20">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
          <span className="text-xs font-semibold text-[var(--color-brand)] uppercase tracking-wider">
            AI Weekly Insight
          </span>
        </div>
      </div>

      {insight.topLeaks[0] && (
        <p className="text-sm text-foreground leading-relaxed mb-3">
          <strong className="font-semibold">{insight.topLeaks[0].merchant}</strong>{' '}
          {insight.topLeaks[0].reason} — could save{' '}
          <strong className="font-mono">{formatCurrency(insight.topLeaks[0].estimatedMonthlySavings)}/mo</strong>.
        </p>
      )}

      <div className="space-y-1.5 mb-4">
        {insight.actionChecklist.slice(0, 3).map((action, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-px">
              {i + 1}
            </span>
            <p className="text-xs text-muted-foreground">{action}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          className="text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 h-7 text-xs gap-1 px-2"
          onClick={() => router.push('/insights')}
        >
          <Sparkles className="h-3 w-3" />
          Ask follow-up
        </Button>
        <span className="text-[10px] text-muted-foreground">Powered by Claude</span>
      </div>
    </Card>
  );
}
