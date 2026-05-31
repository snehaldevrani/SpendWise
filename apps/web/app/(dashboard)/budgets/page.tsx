"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { BudgetSummary, BudgetItem } from "@/lib/api";
import { useUIStore } from "@/store";

const CATEGORIES = [
  { value: "food", label: "🍔 Food & Dining" },
  { value: "shopping", label: "🛒 Shopping" },
  { value: "travel", label: "🚗 Transport" },
  { value: "utilities", label: "💡 Bills & Utilities" },
  { value: "entertainment", label: "🎬 Entertainment" },
  { value: "health", label: "🏥 Health" },
  { value: "subscriptions", label: "🔄 Subscriptions" },
  { value: "other", label: "📦 Other" },
];

const STATUS_CONFIG = {
  ok: { color: "bg-emerald-500", textColor: "text-emerald-500", icon: CheckCircle2, label: "On track" },
  warning: { color: "bg-amber-500", textColor: "text-amber-500", icon: AlertTriangle, label: "Warning" },
  over: { color: "bg-red-500", textColor: "text-red-500", icon: XCircle, label: "Over budget" },
};

function fmt(n: number) {
  return Math.round(n).toLocaleString("en-IN");
}

export default function BudgetsPage() {
  const qc = useQueryClient();
  const { setUploadDialog } = useUIStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [addOpen, setAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newLimit, setNewLimit] = useState("");

  const budgetQuery = useQuery<BudgetSummary>({
    queryKey: ["budgets", month, year],
    queryFn: () => api.get<BudgetSummary>(`/budgets?month=${month}&year=${year}`).then((r) => r.data),
  });

  const upsert = useMutation({
    mutationFn: (body: { category: string; limitAmount: number; month: number; year: number }) =>
      api.post("/budgets", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setAddOpen(false);
      setNewCategory("");
      setNewLimit("");
      toast.success("Budget saved");
    },
    onError: () => toast.error("Failed to save budget"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget removed");
    },
    onError: () => toast.error("Failed to remove budget"),
  });

  const handleAdd = () => {
    const limit = parseFloat(newLimit);
    if (!newCategory || isNaN(limit) || limit <= 0) {
      toast.error("Enter a valid category and amount");
      return;
    }
    upsert.mutate({ category: newCategory, limitAmount: limit, month, year });
  };

  const summary = budgetQuery.data;
  const items = summary?.items ?? [];
  const isLoading = budgetQuery.isLoading;

  // Month picker options (current month ± 3)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  });

  const healthColor = (summary?.healthScore ?? 100) >= 70 ? "text-emerald-500" : (summary?.healthScore ?? 100) >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Budgets</h1>
          <p className="text-zinc-400 mt-1">Set monthly spending limits and track your progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={`${year}-${month}`}
            onValueChange={(v) => { const [y, m] = v.split("-"); setYear(Number(y)); setMonth(Number(m)); }}
          >
            <SelectTrigger className="w-[180px] bg-zinc-800 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              {monthOptions.map((o) => (
                <SelectItem key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`} className="text-white focus:bg-zinc-800 focus:text-white">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAddOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
            <Plus className="h-4 w-4 mr-2" />Add Budget
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5">
            <p className="text-zinc-400 text-sm">Total Budget</p>
            {isLoading ? <Skeleton className="h-7 w-24 bg-zinc-800 mt-1" /> : <p className="text-xl font-bold text-white mt-1">₹{fmt(summary?.totalLimit ?? 0)}</p>}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5">
            <p className="text-zinc-400 text-sm">Total Spent</p>
            {isLoading ? <Skeleton className="h-7 w-24 bg-zinc-800 mt-1" /> : <p className="text-xl font-bold text-white mt-1">₹{fmt(summary?.totalSpent ?? 0)}</p>}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5">
            <p className="text-zinc-400 text-sm">Over Budget</p>
            {isLoading ? <Skeleton className="h-7 w-12 bg-zinc-800 mt-1" /> : <p className="text-xl font-bold text-red-400 mt-1">{summary?.overBudget ?? 0} categories</p>}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-5">
            <p className="text-zinc-400 text-sm">Health Score</p>
            {isLoading ? <Skeleton className="h-7 w-16 bg-zinc-800 mt-1" /> : <p className={`text-xl font-bold mt-1 ${healthColor}`}>{summary?.healthScore ?? 100}%</p>}
          </CardContent>
        </Card>
      </div>

      {/* Budget cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 bg-zinc-800 rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-full bg-emerald-500/10 mb-4"><TrendingUp className="h-8 w-8 text-emerald-500" /></div>
          <h2 className="text-xl font-semibold text-white mb-2">No budgets set</h2>
          <p className="text-zinc-400 max-w-sm mb-6">Create category budgets to track your spending and get forecasts for how the month will end.</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button onClick={() => setAddOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
              <Plus className="h-4 w-4 mr-2" />Create First Budget
            </Button>
            <Button variant="outline" onClick={() => setUploadDialog(true)} className="border-white/10 text-white hover:bg-white/10">
              <Upload className="h-4 w-4 mr-2" />Upload Statement
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((b: BudgetItem) => {
            const cfg = STATUS_CONFIG[b.status];
            const catLabel = CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category;
            return (
              <Card key={b.id} className="bg-zinc-900/50 border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base">{catLabel}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={`${cfg.color}/20 ${cfg.textColor} border-0 text-xs`}>
                        <cfg.icon className="h-3 w-3 mr-1" />{cfg.label}
                      </Badge>
                      <button
                        onClick={() => remove.mutate(b.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-400">₹{fmt(b.spent)} spent</span>
                      <span className="text-zinc-500">of ₹{fmt(b.limitAmount)}</span>
                    </div>
                    <Progress
                      value={Math.min(b.percentUsed, 100)}
                      className="h-2 bg-zinc-800"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-zinc-500 text-xs">Remaining</p>
                      <p className={`font-semibold ${b.remaining >= 0 ? "text-emerald-500" : "text-red-400"}`}>₹{fmt(Math.abs(b.remaining))}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Used</p>
                      <p className="text-white font-semibold">{b.percentUsed}%</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Forecast</p>
                      <p className={`font-semibold ${b.forecast > b.limitAmount ? "text-red-400" : "text-zinc-300"}`}>₹{fmt(b.forecast)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add budget dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Category</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="bg-zinc-800 border-white/10 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10">
                  {CATEGORIES.filter((c) => !items.find((b) => b.category === c.value)).map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-white focus:bg-zinc-800 focus:text-white">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Monthly Limit (₹)</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 5000"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-white/10 text-zinc-400" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black" onClick={handleAdd} disabled={upsert.isPending}>
                {upsert.isPending ? "Saving..." : "Save Budget"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
