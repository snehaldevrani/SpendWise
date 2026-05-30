'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, TrendingDown, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Amount } from '@/components/ui/amount';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Subscription } from '@/lib/types';

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();

  const { data: subs, isLoading } = useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: () => api.get('/subscriptions').then((r) => r.data),
  });

  const { data: leaks } = useQuery<Subscription[]>({
    queryKey: ['subscription-leaks'],
    queryFn: () => api.get('/subscriptions/leaks').then((r) => r.data),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => api.patch(`/subscriptions/${id}/dismiss`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Subscription dismissed');
    },
  });

  const confirm = useMutation({
    mutationFn: (id: string) => api.patch(`/subscriptions/${id}/confirm`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Subscription confirmed');
    },
  });

  const totalMonthly = subs?.reduce((s, sub) => s + (Number(sub.avgAmount) * 30) / sub.estimatedCycleDays, 0) ?? 0;
  const unusedCount = subs?.filter((s) => s.isLikelyUnused).length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="lg:col-span-2 h-40 rounded-xl" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (!subs || subs.length === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="No subscriptions detected yet"
        description="Upload a bank statement — we'll automatically find recurring charges like Netflix, Spotify, gym fees, and more."
        action={{ label: 'Upload a statement', onClick: () => {} }}
      />
    );
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Monthly Recurring</p>
          <p className="text-3xl font-bold font-mono text-foreground">{formatCurrency(totalMonthly)}</p>
          <p className="text-sm text-muted-foreground mt-1">{formatCurrency(totalMonthly * 12)}/year</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Active Subscriptions</p>
          <p className="text-3xl font-bold font-mono text-foreground">{subs.length}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {subs.filter((s) => s.confirmed).length} confirmed · {subs.filter((s) => !s.confirmed).length} auto-detected
          </p>
        </Card>

        {unusedCount > 0 ? (
          <Card className="p-5 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
                  Potential Savings
                </p>
                <p className="text-3xl font-bold font-mono text-amber-800 dark:text-amber-400">
                  {formatCurrency(leaks?.filter((l) => l.isLikelyUnused).reduce((s, l) => s + (Number(l.avgAmount) * 30) / l.estimatedCycleDays, 0) ?? 0)}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">/mo from {unusedCount} likely unused</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5 bg-[var(--color-success-muted)] border-[var(--color-success)]/20">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-[var(--color-success)] mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[var(--color-success)] uppercase tracking-wider mb-1">All Clear</p>
                <p className="text-sm text-muted-foreground mt-1">No unused subscriptions detected</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Unused subs banner */}
      {unusedCount > 0 && leaks && (
        <Card className="p-4 border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              These subscriptions haven't been used recently
            </p>
          </div>
          <div className="space-y-2">
            {leaks.filter((l) => l.isLikelyUnused).slice(0, 3).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between gap-3 bg-white dark:bg-card rounded-lg px-4 py-3 border border-amber-100 dark:border-amber-800/50">
                <div>
                  <p className="text-sm font-semibold text-foreground">{sub.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    Last seen {formatDate(sub.lastChargeDate, 'short')} · {formatCurrency(Number(sub.avgAmount))}/cycle
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => confirm.mutate(sub.id)}>
                    Keep
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-rose-500 hover:bg-rose-600 text-white"
                    onClick={() => dismiss.mutate(sub.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Subscription list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">All Subscriptions</p>
        {subs.map((sub) => {
          const monthly = (Number(sub.avgAmount) * 30) / sub.estimatedCycleDays;
          return (
            <Card key={sub.id} className="px-5 py-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-muted)] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[var(--color-brand)]">
                    {sub.merchant[0]?.toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{sub.merchant}</p>
                    {sub.confirmed && <Badge className="text-[10px] h-4 bg-[var(--color-success-muted)] text-[var(--color-success)] border-0">Confirmed</Badge>}
                    {sub.isLikelyUnused && <Badge className="text-[10px] h-4 bg-amber-100 text-amber-700 border-0 dark:bg-amber-950 dark:text-amber-400">Review</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-muted-foreground">
                      Every ~{sub.estimatedCycleDays}d · Next {formatDate(sub.nextExpectedDate, 'short')}
                    </p>
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-brand)] rounded-full"
                          style={{ width: `${sub.confidenceScore * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {(sub.confidenceScore * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <Amount value={monthly} size="md" />
                  <p className="text-xs text-muted-foreground">/mo</p>
                </div>

                <div className="hidden lg:flex gap-1.5">
                  {!sub.confirmed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-[var(--color-success)]"
                      onClick={() => confirm.mutate(sub.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => dismiss.mutate(sub.id)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
