"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Upload,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { OverviewData, DailySpend, Transaction, Subscription, AiRecommendation } from "@/lib/api";
import { useAuthStore, useUIStore } from "@/store";

const CATEGORY_COLORS: Record<string, string> = {
  food: "#10b981", shopping: "#3b82f6", utilities: "#f59e0b",
  travel: "#8b5cf6", entertainment: "#ec4899", health: "#ef4444",
  subscriptions: "#06b6d4", income: "#84cc16", other: "#6b7280",
};
const CATEGORY_LABELS: Record<string, string> = {
  food: "Food & Dining", shopping: "Shopping", utilities: "Bills & Utilities",
  travel: "Travel", entertainment: "Entertainment", health: "Health",
  subscriptions: "Subscriptions", income: "Income", other: "Others",
};
const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍕", shopping: "🛒", utilities: "💡", travel: "✈️",
  entertainment: "🎥", health: "💊", subscriptions: "🔄", income: "💰", other: "📦",
};

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-IN");
}

function EmptyState() {
  const { setUploadDialog } = useUIStore();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 rounded-full bg-emerald-500/10 mb-4">
        <Upload className="h-8 w-8 text-emerald-500" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">No data yet</h2>
      <p className="text-zinc-400 max-w-sm mb-6">
        Upload your first bank statement to see spending trends, subscription leaks, and AI insights.
      </p>
      <Button onClick={() => setUploadDialog(true)} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
        <Upload className="h-4 w-4 mr-2" />Upload Statement
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const overview = useQuery<OverviewData | null>({
    queryKey: ["overview"],
    queryFn: () => api.get<OverviewData | null>("/transactions/overview").then((r) => r.data),
    retry: false,
  });

  const dailySpend = useQuery<DailySpend[]>({
    queryKey: ["daily-spend"],
    queryFn: () => api.get<DailySpend[]>("/transactions/daily-spend?days=60").then((r) => r.data),
    enabled: !!overview.data,
  });

  const recentTx = useQuery<{ total: number; items: Transaction[] }>({
    queryKey: ["recent-transactions"],
    queryFn: () => api.get<{ total: number; items: Transaction[] }>("/transactions?limit=8&page=1").then((r) => r.data),
    enabled: !!overview.data,
  });

  const subs = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () => api.get<Subscription[]>("/subscriptions").then((r) => r.data),
    enabled: !!overview.data,
  });

  const aiRec = useQuery<AiRecommendation>({
    queryKey: ["ai-recommendations"],
    queryFn: () => api.get<AiRecommendation>("/ai/recommendations").then((r) => r.data),
    enabled: !!overview.data,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });

  if (!overview.isLoading && overview.data === null) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Welcome, {user?.email?.split("@")[0]}!</p>
        </div>
        <EmptyState />
      </div>
    );
  }

  const current = overview.data?.current;
  const previous = overview.data?.previous;
  const spendDiff = current && previous && previous.total > 0
    ? (((current.total - previous.total) / previous.total) * 100).toFixed(0)
    : null;
  const subsMonthlyCost = subs.data?.reduce(
    (acc, s) => acc + (Number(s.avgAmount) * 30) / s.estimatedCycleDays, 0
  ) ?? 0;

  const categoryData = current?.breakdown?.map((b) => ({
    name: CATEGORY_LABELS[b.category] ?? b.category,
    value: Math.round(b.total),
    color: CATEGORY_COLORS[b.category] ?? "#6b7280",
  })) ?? [];

  const spendingData = dailySpend.data?.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    amount: d.amount,
  })) ?? [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Welcome back, {user?.email?.split("@")[0]}! Here&apos;s your financial overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10"><Wallet className="h-5 w-5 text-emerald-500" /></div>
              {!overview.isLoading && spendDiff !== null && (
                <div className={`flex items-center gap-1 text-sm ${Number(spendDiff) > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {Number(spendDiff) > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {spendDiff}%
                </div>
              )}
            </div>
            <p className="text-zinc-400 text-sm">This Month</p>
            {overview.isLoading ? <Skeleton className="h-8 w-24 bg-zinc-800 mt-1" /> : <p className="text-2xl font-bold text-white mt-1">₹{fmt(current?.total ?? 0)}</p>}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10"><CreditCard className="h-5 w-5 text-emerald-500" /></div>
            </div>
            <p className="text-zinc-400 text-sm">Last Month</p>
            {overview.isLoading ? <Skeleton className="h-8 w-24 bg-zinc-800 mt-1" /> : <p className="text-2xl font-bold text-white mt-1">₹{fmt(previous?.total ?? 0)}</p>}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
            </div>
            <p className="text-zinc-400 text-sm">Savings This Month</p>
            {overview.isLoading ? <Skeleton className="h-8 w-24 bg-zinc-800 mt-1" /> : (
              <p className={`text-2xl font-bold mt-1 ${(current?.savings ?? 0) >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                ₹{fmt(current?.savings ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10"><RefreshCw className="h-5 w-5 text-emerald-500" /></div>
              {!subs.isLoading && <span className="text-xs text-zinc-500">₹{fmt(Math.round(subsMonthlyCost))}/mo</span>}
            </div>
            <p className="text-zinc-400 text-sm">Active Subs</p>
            {subs.isLoading ? <Skeleton className="h-8 w-12 bg-zinc-800 mt-1" /> : <p className="text-2xl font-bold text-white mt-1">{subs.data?.length ?? 0}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-white">60-Day Spending Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dailySpend.isLoading ? <Skeleton className="h-full w-full bg-zinc-800" /> : spendingData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No spend data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendingData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} interval={9} />
                    <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }} labelStyle={{ color: "#fff" }} formatter={(value) => [`₹${value ?? 0}`, "Spent"]} />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-white">By Category</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {overview.isLoading ? <Skeleton className="h-full w-full bg-zinc-800" /> : categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                      {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }} formatter={(value) => [`₹${value ?? 0}`, ""]} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(value) => <span className="text-zinc-400 text-xs">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Recent Transactions + Subs + AI */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Recent Transactions</CardTitle>
            <a href="/transactions" className="text-sm text-emerald-500 hover:underline">View all</a>
          </CardHeader>
          <CardContent>
            {recentTx.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-zinc-800" />)}</div>
            ) : !recentTx.data?.items?.length ? (
              <p className="text-zinc-500 text-sm text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-1">
                {recentTx.data.items.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-zinc-500 w-20">{new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                      <div>
                        <p className="text-white font-medium text-sm">{tx.merchant}</p>
                        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-xs mt-0.5">
                          {CATEGORY_EMOJI[tx.category]} {CATEGORY_LABELS[tx.category] ?? tx.category}
                        </Badge>
                      </div>
                    </div>
                    <span className={`font-semibold text-sm ${tx.type === "credit" ? "text-emerald-500" : "text-red-400"}`}>
                      {tx.type === "credit" ? "+" : "-"}₹{fmt(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-base">Active Subscriptions</CardTitle>
              <a href="/subscriptions" className="text-sm text-emerald-500 hover:underline">View all</a>
            </CardHeader>
            <CardContent>
              {subs.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full bg-zinc-800" />)}</div>
              ) : !subs.data?.length ? (
                <p className="text-zinc-500 text-sm text-center py-4">None detected yet</p>
              ) : (
                <div className="space-y-3">
                  {subs.data.slice(0, 4).map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <p className="text-white text-sm truncate max-w-[130px]">{s.merchant}</p>
                      <span className="text-zinc-400 text-sm">₹{fmt(Math.round(Number(s.avgAmount)))}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10"><Sparkles className="h-4 w-4 text-emerald-500" /></div>
                <CardTitle className="text-white text-base">AI Insight</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {aiRec.isLoading ? (
                <div className="space-y-2"><Skeleton className="h-4 w-full bg-zinc-800" /><Skeleton className="h-4 w-3/4 bg-zinc-800" /><Skeleton className="h-4 w-5/6 bg-zinc-800" /></div>
              ) : aiRec.isError || !aiRec.data ? (
                <div className="text-center py-2">
                  <p className="text-zinc-500 text-xs">Upload data for AI insights</p>
                  <Button variant="ghost" size="sm" onClick={() => router.push("/insights")} className="text-emerald-500 hover:text-emerald-400 mt-1 text-xs">Open AI Chat →</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiRec.data.topLeaks[0] && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-amber-400 text-xs font-medium">Top Leak Detected</p>
                      <p className="text-white text-sm mt-1">{aiRec.data.topLeaks[0].merchant}</p>
                      <p className="text-zinc-400 text-xs mt-0.5">Save ₹{fmt(aiRec.data.topLeaks[0].estimatedMonthlySavings)}/mo</p>
                    </div>
                  )}
                  {aiRec.data.actionChecklist[0] && <p className="text-zinc-400 text-xs">{aiRec.data.actionChecklist[0]}</p>}
                  <Button variant="ghost" size="sm" onClick={() => router.push("/insights")} className="w-full text-emerald-500 hover:text-emerald-400 text-xs border border-emerald-500/20">Ask follow-up →</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
