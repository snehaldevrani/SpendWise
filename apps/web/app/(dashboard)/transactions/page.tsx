'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Amount } from '@/components/ui/amount';
import { CategoryBadge } from '@/components/ui/category-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/page-skeleton';
import { api } from '@/lib/api';
import { formatDate, CATEGORY_LABELS, CATEGORY_EMOJI, CATEGORY_COLORS } from '@/lib/utils';
import { useTransactionFilters } from '@/store';
import type { Transaction } from '@/lib/types';

const CATEGORIES = Object.keys(CATEGORY_LABELS);

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const filters = useTransactionFilters();
  const [editingId, setEditingId] = useState<string | null>(null);

  const queryKey = ['transactions', filters.search, filters.categories, filters.startDate, filters.endDate, filters.page];

  const { data, isLoading } = useQuery<{ total: number; items: Transaction[]; page: number; limit: number }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(filters.page));
      params.set('limit', '50');
      if (filters.search) params.set('search', filters.search);
      if (filters.categories.length === 1) params.set('category', filters.categories[0]);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      return api.get(`/transactions?${params}`).then((r) => r.data);
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      api.patch(`/transactions/${id}/category`, { category }).then((r) => r.data),
    onMutate: async ({ id, category }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: { items: Transaction[] } | undefined) => ({
        ...old,
        items: old?.items.map((t) => (t.id === id ? { ...t, category } : t)) ?? [],
      }));
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(queryKey, ctx?.prev);
      toast.error("Couldn't save category — try again");
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success('Category updated');
    },
  });

  const activeFilterCount =
    filters.categories.length + (filters.startDate ? 1 : 0) + (filters.search ? 1 : 0);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      filters.setFilter('search', e.target.value);
      filters.setFilter('page', 1);
    },
    [filters],
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      {/* Filter bar */}
      <Card className="p-3 lg:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-8 h-8 text-sm"
              value={filters.search}
              onChange={handleSearch}
            />
          </div>

          <Select
            value={filters.categories[0] ?? 'all'}
            onValueChange={(v) => {
              filters.setFilter('categories', v === 'all' ? [] : [v] as string[]);
              filters.setFilter('page', 1);
            }}
          >
            <SelectTrigger className="h-8 text-sm w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="h-8 text-sm w-36"
            value={filters.startDate ?? ''}
            onChange={(e) => { filters.setFilter('startDate', e.target.value || null); filters.setFilter('page', 1); }}
          />
          <Input
            type="date"
            className="h-8 text-sm w-36"
            value={filters.endDate ?? ''}
            onChange={(e) => { filters.setFilter('endDate', e.target.value || null); filters.setFilter('page', 1); }}
          />

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[var(--color-brand)] gap-1 px-2"
              onClick={filters.reset}
            >
              <X className="h-3 w-3" />
              Clear {activeFilterCount > 1 ? `${activeFilterCount} filters` : 'filter'}
            </Button>
          )}
        </div>
      </Card>

      {/* Summary row */}
      {total > 0 && (
        <div className="flex items-center gap-2 px-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> transactions
          </p>
          <span className="text-muted-foreground">·</span>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              ₹{items.reduce((s, t) => s + (t.type === 'debit' ? t.amount : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>{' '}
            total spend
          </p>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={10} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No transactions match your filters"
            description="Try adjusting the date range or clearing category filters"
          />
        ) : (
          <>
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-border bg-secondary/30">
              {['Date', 'Merchant', 'Category', 'Amount', 'Type'].map((h) => (
                <p key={h} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </p>
              ))}
            </div>

            <div className="divide-y divide-border">
              {items.map((txn) => (
                <div
                  key={txn.id}
                  className="grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-3 lg:gap-4 items-center px-5 py-3 hover:bg-secondary/40 transition-colors"
                >
                  {/* Date */}
                  <p className="text-sm text-muted-foreground">{formatDate(txn.date, 'short')}</p>

                  {/* Merchant */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: `${CATEGORY_COLORS[txn.category] ?? '#cbd5e1'}15` }}
                    >
                      {CATEGORY_EMOJI[txn.category] ?? '📦'}
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{txn.merchant}</span>
                  </div>

                  {/* Category — inline edit */}
                  <div className="hidden lg:block">
                    {editingId === txn.id ? (
                      <Select
                        defaultValue={txn.category}
                        onValueChange={(v) => v && updateCategory.mutate({ id: txn.id, category: v })}
                        open
                        onOpenChange={(o) => { if (!o) setEditingId(null); }}
                      >
                        <SelectTrigger className="h-6 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <CategoryBadge
                        category={txn.category}
                        onClick={() => setEditingId(txn.id)}
                      />
                    )}
                  </div>

                  {/* Amount */}
                  <Amount value={txn.amount} positive={txn.type === 'credit'} size="sm" />

                  {/* Type */}
                  <div className="hidden lg:block">
                    <Badge
                      variant="secondary"
                      className="text-xs capitalize"
                    >
                      {txn.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {total > 50 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {(filters.page - 1) * 50 + 1}–{Math.min(filters.page * 50, total)} of {total}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={filters.page <= 1}
                    onClick={() => filters.setFilter('page', filters.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={filters.page * 50 >= total}
                    onClick={() => filters.setFilter('page', filters.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
