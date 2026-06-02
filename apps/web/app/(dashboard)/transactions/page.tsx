"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Download, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TransactionsPage, Transaction } from "@/lib/api";
import { useUIStore } from "@/store";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "food", label: "🍔 Food & Dining" },
  { value: "shopping", label: "🛒 Shopping" },
  { value: "travel", label: "🚗 Transport" },
  { value: "utilities", label: "💡 Bills & Utilities" },
  { value: "entertainment", label: "🎬 Entertainment" },
  { value: "income", label: "💰 Income" },
  { value: "health", label: "🏥 Health" },
  { value: "subscriptions", label: "🔄 Subscriptions" },
  { value: "other", label: "📦 Other" },
];

const CAT_META: Record<string, { emoji: string; label: string; color: string }> = {
  food: { emoji: "🍔", label: "Food & Dining", color: "bg-orange-500/20 text-orange-400" },
  shopping: { emoji: "🛒", label: "Shopping", color: "bg-blue-500/20 text-blue-400" },
  travel: { emoji: "🚗", label: "Travel", color: "bg-purple-500/20 text-purple-400" },
  utilities: { emoji: "💡", label: "Bills & Utilities", color: "bg-yellow-500/20 text-yellow-400" },
  entertainment: { emoji: "🎬", label: "Entertainment", color: "bg-pink-500/20 text-pink-400" },
  income: { emoji: "💰", label: "Income", color: "bg-emerald-500/20 text-emerald-400" },
  health: { emoji: "🏥", label: "Health", color: "bg-red-500/20 text-red-400" },
  subscriptions: { emoji: "🔄", label: "Subscriptions", color: "bg-cyan-500/20 text-cyan-400" },
  other: { emoji: "📦", label: "Other", color: "bg-zinc-500/20 text-zinc-400" },
};

const ITEMS_PER_PAGE = 20;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function TransactionsPage() {
  const qc = useQueryClient();
  const { setUploadDialog } = useUIStore();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const params = new URLSearchParams({
    page: String(page),
    limit: String(ITEMS_PER_PAGE),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(category !== "all" ? { category } : {}),
  });

  const txQuery = useQuery<TransactionsPage>({
    queryKey: ["transactions", page, debouncedSearch, category],
    queryFn: () => api.get<TransactionsPage>(`/transactions?${params}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, cat }: { id: string; cat: string }) =>
      api.patch(`/transactions/${id}/category`, { category: cat }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setEditingId(null);
      toast.success("Category updated");
    },
    onError: () => toast.error("Failed to update category"),
  });

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleCategoryFilter = useCallback((v: string) => {
    setCategory(v);
    setPage(1);
  }, []);

  const exportCsv = () => {
    const items = txQuery.data?.items ?? [];
    if (!items.length) { toast.error("No data to export"); return; }
    const header = "Date,Merchant,Category,Type,Amount,Currency";
    const rows = items.map((t) =>
      [new Date(t.date).toISOString().slice(0, 10), `"${t.merchant}"`, t.category, t.type, t.amount, t.currency].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const items = txQuery.data?.items ?? [];
  const total = txQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="text-zinc-400 mt-1">View and manage all your transactions.</p>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search merchants..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>
            <Select value={category} onValueChange={handleCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px] bg-zinc-800 border-white/10 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-white focus:bg-zinc-800 focus:text-white">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} className="border-white/10 text-white hover:bg-white/10">
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">
            {txQuery.isLoading ? "Loading..." : `${total} Transaction${total !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20 bg-zinc-800" />
                  <Skeleton className="h-4 flex-1 bg-zinc-800" />
                  <Skeleton className="h-6 w-24 bg-zinc-800" />
                  <Skeleton className="h-4 w-16 bg-zinc-800" />
                  <Skeleton className="h-4 w-24 bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Upload className="h-8 w-8 text-zinc-600 mb-3" />
              <p className="text-zinc-400 font-medium">No transactions found</p>
              <p className="text-zinc-500 text-sm mt-1">
                {search || category !== "all" ? "Try adjusting your filters" : "Upload a bank statement to get started"}
              </p>
              {!search && category === "all" && (
                <Button onClick={() => setUploadDialog(true)} size="sm" className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-black">
                  Upload Statement
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Date</TableHead>
                      <TableHead className="text-zinc-400">Merchant</TableHead>
                      <TableHead className="text-zinc-400">Category</TableHead>
                      <TableHead className="text-zinc-400">Type</TableHead>
                      <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((tx: Transaction) => (
                      <TableRow key={tx.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-zinc-400 text-sm">
                          {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-white font-medium">{tx.merchant}</TableCell>
                        <TableCell>
                          {editingId === tx.id ? (
                            <Select
                              value={tx.category}
                              onValueChange={(val) => updateCategory.mutate({ id: tx.id, cat: val })}
                            >
                              <SelectTrigger className="w-[160px] h-8 bg-zinc-800 border-white/10 text-white text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10">
                                {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                                  <SelectItem key={c.value} value={c.value} className="text-white text-xs focus:bg-zinc-800 focus:text-white">{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              className={`cursor-pointer ${CAT_META[tx.category]?.color ?? "bg-zinc-500/20 text-zinc-400"}`}
                              onClick={() => setEditingId(tx.id)}
                            >
                              {CAT_META[tx.category]?.emoji} {CAT_META[tx.category]?.label ?? tx.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={tx.type === "credit" ? "border-emerald-500/50 text-emerald-500" : "border-red-500/50 text-red-400"}>
                            {tx.type === "credit" ? "Credit" : "Debit"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${tx.type === "credit" ? "text-emerald-500" : "text-red-400"}`}>
                          {tx.type === "credit" ? "+" : "-"}Rs.{Math.abs(Number(tx.amount)).toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                  <p className="text-zinc-500 text-sm">
                    Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="border-white/10 text-white hover:bg-white/10">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-zinc-400 text-sm px-2">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="border-white/10 text-white hover:bg-white/10">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
