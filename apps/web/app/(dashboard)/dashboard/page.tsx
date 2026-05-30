'use client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Sparkles, UploadCloud, AlertTriangle, ArrowDownLeft, ArrowUpRight, PiggyBank } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Amount } from '@/components/ui/amount';
import { CategoryBadge } from '@/components/ui/category-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/page-skeleton';
import { SpendingAreaChart } from '@/components/dashboard/spending-area-chart';
import { CategoryDonutChart } from '@/components/dashboard/category-donut-chart';
import { AIInsightCard } from '@/components/dashboard/ai-insight-card';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, CATEGORY_COLORS, CATEGORY_EMOJI, CATEGORY_LABELS } from '@/lib/utils';
import { useUIStore } from '@/store';
import type { Transaction, Subscription, AiRecommendation } from '@/lib/types';

interface MonthlySummary {
  month: number;
  year: number;
  total: number;
  totalIncome: number;
  savings: number;
  breakdown: Array<{ category: string; total: number; count: number }>;
}

interface Overview {
  current: MonthlySummary;
  previous: MonthlySummary;
  latestMonth: number;
  latestYear: number;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function StatCard({ label, value, sub, icon: Icon, color, valueColor }: {
  label: string; value: string; sub: string;
  icon: React.ElementType; color: string; valueColor?: string;
}) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono ${valueColor ?? 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const { setUploadDialog } = useUIStore();

  const { data: overview, isLoading: overviewLoading } = useQuery<Overview | null>({
    queryKey: ['overview'],
    queryFn: () => api.get('/transactions/overview').then((r) => r.data),
  });

  const { data: dailySpend } = useQuery<Array<{ date: string; amount: number }>>({
    queryKey: ['daily-spend'],
    queryFn: () => api.get('/transactions/daily-spend?days=60').then((r) => r.data),
    enabled: !!overview,
  });

  const { data: transactionsRes, isLoading: txnLoading } = useQuery<{ total: number; items: Transaction[] }>({
    queryKey: ['transactions', 'recent'],
    queryFn: () => api.get('/transactions?limit=8').then((r) => r.data),
  });

  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: () => api.get('/subscriptions').then((r) => r.data),
  });

  const { data: aiInsight } = useQuery<AiRecommendation>({
    queryKey: ['ai-recommendations'],
    queryFn: () => api.get('/ai/recommendations').then((r) => r.data),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const isLoading = overviewLoading || txnLoading;
  const hasData = (transactionsRes?.total ?? 0) > 0;

  if (isLoading) return <DashboardSkeleton />;

  if (!hasData) {
    return (
      <EmptyState
        icon={UploadCloud}
        title="Your financial picture starts here"
        description="Upload a bank statement CSV to see where your money goes, detect subscriptions, and get AI-powered savings recommendations."
        action={{ label: 'Upload your first statement', onClick: () => setUploadDialog(true) }}
        secondaryText="Supports CSV exports from HDFC, ICICI, SBI, Axis, and more."
        className="min-h-[60vh]"
      />
    );
  }

  const current = overview?.current;
  const previous = overview?.previous;
  const monthLabel = current ? `${MONTH_NAMES[(current.month ?? 1) - 1]} ${current.year}` : '';
  const totalSpend = current?.total ?? 0;
  const totalIncome = current?.totalIncome ?? 0;
  const savings = current?.savings ?? 0;
  const prevSpend = previous?.total ?? 0;
  const spendDelta = prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0;
  const topCategory = current?.breakdown?.[0];
  const subscriptionMonthly = subscriptions?.reduce((s, sub) => s + (Number(sub.avgAmount) * 30) / sub.estimatedCycleDays, 0) ?? 0;

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Month label */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{monthLabel}</span>
          {prevSpend > 0 && (
            <span className={`ml-2 text-xs font-medium ${spendDelta > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {spendDelta > 0 ? '▲' : '▼'} {Math.abs(spendDelta).toFixed(1)}% vs {MONTH_NAMES[(previous!.month ?? 1) - 1]}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{transactionsRes?.total} transactions total</p>
      </div>

      {/* Stat cards — Money Out / In / Savings / Top Category */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Money Out"
          value={formatCurrency(totalSpend)}
          sub={monthLabel}
          icon={ArrowUpRight}
          color="bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          valueColor="text-rose-600 dark:text-rose-400"
        />
        <StatCard
          label="Money In"
          value={formatCurrency(totalIncome)}
          sub={monthLabel}
          icon={ArrowDownLeft}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Net Savings"
          value={savings >= 0 ? formatCurrency(savings) : `-${formatCurrency(Math.abs(savings))}`}
          sub={savings >= 0 ? 'saved this month' : 'overspent this month'}
          icon={PiggyBank}
          color={savings >= 0
            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}
          valueColor={savings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
        />
        <StatCard
          label="Top Category"
          value={topCategory ? formatCurrency(topCategory.total) : '—'}
          sub={topCategory ? `${CATEGORY_EMOJI[topCategory.category] ?? ''} ${CATEGORY_LABELS[topCategory.category] ?? topCategory.category} · ${topCategory.count} txns` : 'No data yet'}
          icon={topCategory && totalSpend > 0 && topCategory.total / totalSpend > 0.3 ? TrendingUp : TrendingDown}
          color="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
      </div>

      {/* Category breakdown bar */}
      {current?.breakdown && current.breakdown.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Spend by Category</p>
          <div className="space-y-2">
            {current.breakdown.slice(0, 6).map((cat) => {
              const pct = totalSpend > 0 ? (cat.total / totalSpend) * 100 : 0;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-sm w-28 shrink-0 text-foreground font-medium truncate">
                    {CATEGORY_EMOJI[cat.category]} {CATEGORY_LABELS[cat.category] ?? cat.category}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat.category] ?? '#8b5cf6' }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-14 text-right shrink-0">
                    {formatCurrency(cat.total)}
                  </span>
                  <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Daily Spend — Last 60 Days
          </p>
          {dailySpend && dailySpend.length > 0 ? (
            <SpendingAreaChart data={dailySpend} />
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            By Category — {monthLabel}
          </p>
          {current?.breakdown && current.breakdown.length > 0 ? (
            <CategoryDonutChart data={current.breakdown} total={totalSpend} />
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No category data</p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent txns + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Transactions
              </CardTitle>
              <a href="/transactions" className="text-xs text-[var(--color-brand)] hover:underline font-medium">
                View all {transactionsRes?.total} →
              </a>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <div className="divide-y divide-border">
              {transactionsRes?.items.map((txn) => (
                <div key={txn.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: `${CATEGORY_COLORS[txn.category] ?? '#cbd5e1'}20` }}
                  >
                    {CATEGORY_EMOJI[txn.category] ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{txn.merchant}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(txn.date, 'short')}</p>
                  </div>
                  <Amount value={txn.amount} positive={txn.type === 'credit'} size="sm" />
                  <CategoryBadge category={txn.category} className="hidden sm:inline-flex" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {aiInsight ? (
            <AIInsightCard insight={aiInsight} />
          ) : (
            <Card className="p-5 border-dashed">
              <div className="flex flex-col items-center text-center gap-2 py-4">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">AI insights unavailable</p>
                <p className="text-xs text-muted-foreground/60">Add your Anthropic API key in Settings to enable</p>
              </div>
            </Card>
          )}

          {subscriptions && subscriptions.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Subscriptions · <span className="text-[var(--color-brand)]">{formatCurrency(subscriptionMonthly)}/mo</span>
              </p>
              <div className="space-y-2.5">
                {subscriptions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-[var(--color-brand-muted)] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[var(--color-brand)]">
                          {sub.merchant[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-foreground truncate">{sub.merchant}</span>
                    </div>
                    <Amount value={Number(sub.avgAmount)} size="sm" />
                  </div>
                ))}
              </div>
              <a href="/subscriptions" className="text-xs text-[var(--color-brand)] hover:underline font-medium mt-3 block">
                Manage all ({subscriptions.length}) →
              </a>
            </Card>
          )}
        </div>
      </div>

      {/* Leak alert */}
      {subscriptions?.some((s) => s.isLikelyUnused) && (
        <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Potential spend leaks</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                {subscriptions.filter((s) => s.isLikelyUnused).length} subscriptions haven&apos;t been used recently.{' '}
                <a href="/subscriptions" className="underline font-medium">Review now →</a>
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
