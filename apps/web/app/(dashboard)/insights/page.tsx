"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Sparkles, Lightbulb, Upload, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Insight, CategoryTrendsRow } from "@/lib/api";
import { useUIStore } from "@/store";

const CATEGORY_COLORS: Record<string, string> = {
  food: "bg-orange-500", shopping: "bg-blue-500", utilities: "bg-yellow-500",
  transport: "bg-purple-500", entertainment: "bg-pink-500", health: "bg-red-500",
  subscriptions: "bg-cyan-500", income: "bg-emerald-500", other: "bg-zinc-500",
};
const CHART_COLORS: Record<string, string> = {
  food: "#f97316", shopping: "#3b82f6", utilities: "#eab308",
  transport: "#8b5cf6", entertainment: "#ec4899", health: "#ef4444",
  subscriptions: "#06b6d4", other: "#6b7280",
};
const CATEGORY_LABELS: Record<string, string> = {
  food: "Food", shopping: "Shopping", utilities: "Bills", transport: "Transport",
  entertainment: "Entertainment", health: "Health", subscriptions: "Subscriptions",
  income: "Income", other: "Other",
};

const SUGGESTED = [
  "What's my biggest spending category?",
  "Find my unused subscriptions",
  "Compare this month vs last month",
  "Where can I save the most money?",
];

interface Message { id: number; role: "user" | "assistant"; content: string }

const GREETING: Message = {
  id: 0,
  role: "assistant",
  content: "Hi! I'm your SpendWise AI. Ask me anything about your spending Ã¢â‚¬â€ I analyse your real transaction history to give you personalised answers.",
};

export default function InsightsPage() {
  const { setUploadDialog } = useUIStore();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const insightsQuery = useQuery<Insight[]>({
    queryKey: ["insights"],
    queryFn: () => api.get<Insight[]>("/insights").then((r) => r.data),
  });

  const trendsQuery = useQuery<CategoryTrendsRow[]>({
    queryKey: ["category-trends"],
    queryFn: () => api.get<CategoryTrendsRow[]>("/transactions/category-trends?months=6").then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const insights = insightsQuery.data ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const res = await api.post<{ answer: string; sourcesUsed: number }>("/ai/chat", { question });
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: res.data.answer }]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Sorry, I couldn't answer that right now. Please try again.";
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: msg }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">AI Insights</h1>
        <p className="text-zinc-400 mt-1">Chat with AI about your finances and view weekly spending breakdowns.</p>
      </div>

      <div className="grid lg:grid-cols-[58%_42%] gap-6">
        {/* Chat */}
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20"><Sparkles className="h-5 w-5 text-emerald-500" /></div>
              <div>
                <CardTitle className="text-white">SpendWise AI</CardTitle>
                <p className="text-zinc-500 text-sm">Ask anything about your finances</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                {m.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-emerald-500/20 text-emerald-500 text-xs">SW</AvatarFallback>
                  </Avatar>
                )}
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap", m.role === "assistant" ? "bg-zinc-800 text-white" : "bg-slate-700 text-white ml-auto")}>
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-emerald-500/20 text-emerald-500 text-xs">SW</AvatarFallback>
                </Avatar>
                <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 text-xs rounded-full border border-white/10 text-zinc-400 hover:text-white hover:border-emerald-500/50 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder="Ask about your spending..."
                className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500"
                disabled={isTyping}
              />
              <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping} className="bg-emerald-500 hover:bg-emerald-600 text-black">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Weekly Insights + Trends */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          {/* 6-Month Category Trends Chart */}
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" />6-Month Trends
          </h2>
          <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-4">
              {trendsQuery.isLoading ? (
                <Skeleton className="h-48 w-full bg-zinc-800" />
              ) : !trendsQuery.data?.length || trendsQuery.data.every((r) => Object.keys(r).length <= 1) ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <p className="text-zinc-500 text-sm">No trend data yet</p>
                  <p className="text-zinc-600 text-xs mt-1">Upload a few months of statements to see category trends</p>
                </div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendsQuery.data} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false}
                        tickFormatter={(v: string) => { const [y, m] = v.split("-"); return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", { month: "short" }); }} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [`₹${Math.round(Number(value ?? 0)).toLocaleString("en-IN")}`, CATEGORY_LABELS[String(name ?? "")] ?? String(name ?? "")]}
                      />
                      <Legend iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-zinc-400 text-xs">{CATEGORY_LABELS[value] ?? value}</span>} />
                      {Object.keys(CHART_COLORS)
                        .filter((cat) => trendsQuery.data?.some((r) => (r[cat] ?? 0) > 0))
                        .map((cat) => (
                          <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[cat]} radius={cat === "other" ? [3, 3, 0, 0] : undefined} />
                        ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <h2 className="text-lg font-semibold text-white flex items-center gap-2 pt-2">
            <Lightbulb className="h-5 w-5 text-emerald-500" />Weekly Insights
          </h2>

          {insightsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 bg-zinc-800 rounded-lg" />)
          ) : insights.length === 0 ? (
            <Card className="bg-zinc-900/50 border-white/10">
              <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                <Upload className="h-6 w-6 text-zinc-600" />
                <p className="text-zinc-400 text-sm">No weekly insights yet.</p>
                <p className="text-zinc-500 text-xs">Upload a statement to generate AI-powered weekly breakdowns.</p>
                <Button size="sm" onClick={() => setUploadDialog(true)} className="bg-emerald-500 hover:bg-emerald-600 text-black mt-1">Upload Statement</Button>
              </CardContent>
            </Card>
          ) : (
            insights.slice(0, 8).map((insight, i) => {
              const summary = insight.summaryJson;
              const weekLabel = i === 0 ? "This Week" : i === 1 ? "Last Week" : `${i} Weeks Ago`;
              const cats = Object.entries(summary.byCategory ?? {}).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 4);
              const total = cats.reduce((sum, [, v]) => sum + (v as number), 0) || 1;
              return (
                <Card key={insight.id} className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm font-medium">{weekLabel}</span>
                      <span className="text-white font-bold">Ã¢â€šÂ¹{Math.round(summary.totalSpend ?? 0).toLocaleString("en-IN")}</span>
                    </div>
                    {cats.length > 0 && (
                      <>
                        <div className="h-2 rounded-full overflow-hidden flex">
                          {cats.map(([cat, val]) => (
                            <div key={cat} className={cn(CATEGORY_COLORS[cat] ?? "bg-zinc-500")} style={{ width: `${Math.round(((val as number) / total) * 100)}%` }} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {cats.map(([cat, val]) => (
                            <div key={cat} className="flex items-center gap-1.5">
                              <div className={cn("h-2 w-2 rounded-full", CATEGORY_COLORS[cat] ?? "bg-zinc-500")} />
                              <span className="text-zinc-400 text-xs">{CATEGORY_LABELS[cat] ?? cat}</span>
                              <span className="text-zinc-500 text-xs">{Math.round(((val as number) / total) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {summary.topMerchants?.[0] && (
                      <p className="text-zinc-500 text-xs border-t border-white/10 pt-3">
                        Top: <span className="text-zinc-300">{summary.topMerchants[0].merchant}</span> Ã¢â‚¬â€ Ã¢â€šÂ¹{Math.round(summary.topMerchants[0].total).toLocaleString("en-IN")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
