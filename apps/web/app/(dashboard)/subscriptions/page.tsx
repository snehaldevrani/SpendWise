"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, AlertTriangle, Check, X, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Subscription } from "@/lib/api";
import { useUIStore } from "@/store";

function fmt(n: number) { return Math.round(n).toLocaleString("en-IN"); }

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const { setUploadDialog } = useUIStore();

  const subsQuery = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () => api.get<Subscription[]>("/subscriptions").then((r) => r.data),
  });

  const leaksQuery = useQuery<Subscription[]>({
    queryKey: ["subscriptions-leaks"],
    queryFn: () => api.get<Subscription[]>("/subscriptions/leaks").then((r) => r.data),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => api.patch(`/subscriptions/${id}/dismiss`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["subscriptions-leaks"] });
      toast.success("Dismissed");
    },
    onError: () => toast.error("Failed to dismiss"),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => api.patch(`/subscriptions/${id}/confirm`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription confirmed");
    },
    onError: () => toast.error("Failed to confirm"),
  });

  const leakIds = new Set(leaksQuery.data?.map((l) => l.id) ?? []);
  const subs = subsQuery.data ?? [];

  const monthlyCost = subs.reduce((acc, s) => acc + (Number(s.avgAmount) * 30) / s.estimatedCycleDays, 0);
  const annualSavings = (leaksQuery.data ?? []).reduce(
    (acc, s) => acc + (Number(s.avgAmount) * 365) / s.estimatedCycleDays, 0
  );

  const isLoading = subsQuery.isLoading;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-zinc-400 mt-1">Manage recurring payments and find savings opportunities.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="p-2 rounded-xl bg-emerald-500/10 w-fit mb-4"><RefreshCw className="h-5 w-5 text-emerald-500" /></div>
            <p className="text-zinc-400 text-sm">Monthly Cost</p>
            {isLoading ? <Skeleton className="h-8 w-24 bg-zinc-800 mt-1" /> : <p className="text-2xl font-bold text-white mt-1">₹{fmt(monthlyCost)}</p>}
            <p className="text-zinc-500 text-xs mt-1">{subs.length} active subscription{subs.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="p-2 rounded-xl bg-emerald-500/10 w-fit mb-4"><Check className="h-5 w-5 text-emerald-500" /></div>
            <p className="text-zinc-400 text-sm">Active</p>
            {isLoading ? <Skeleton className="h-8 w-12 bg-zinc-800 mt-1" /> : <p className="text-2xl font-bold text-white mt-1">{subs.length}</p>}
            <p className="text-zinc-500 text-xs mt-1">Detected subscriptions</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="p-2 rounded-xl bg-emerald-500/10 w-fit mb-4"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
            <p className="text-zinc-400 text-sm">Potential Annual Savings</p>
            {leaksQuery.isLoading ? <Skeleton className="h-8 w-24 bg-zinc-800 mt-1" /> : <p className="text-2xl font-bold text-white mt-1">₹{fmt(annualSavings)}</p>}
            <p className="text-zinc-500 text-xs mt-1">If you cancel {leaksQuery.data?.length ?? 0} unused</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 bg-zinc-800 rounded-lg" />)}
        </div>
      ) : subs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 rounded-full bg-emerald-500/10 mb-4"><Upload className="h-8 w-8 text-emerald-500" /></div>
          <h2 className="text-xl font-semibold text-white mb-2">No subscriptions detected yet</h2>
          <p className="text-zinc-400 max-w-sm mb-6">Upload a bank statement with a few months of history for SpendWise to detect recurring charges.</p>
          <Button onClick={() => setUploadDialog(true)} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
            <Upload className="h-4 w-4 mr-2" />Upload Statement
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subs.map((sub) => {
            const isLeak = leakIds.has(sub.id);
            const annualCost = (Number(sub.avgAmount) * 365) / sub.estimatedCycleDays;
            const cycleName = sub.estimatedCycleDays <= 8 ? "Weekly" : sub.estimatedCycleDays <= 16 ? "Bi-weekly" : sub.estimatedCycleDays <= 35 ? "Monthly" : sub.estimatedCycleDays <= 95 ? "Quarterly" : "Yearly";
            return (
              <Card key={sub.id} className="bg-zinc-900/50 border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">{sub.merchant}</CardTitle>
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-xs mt-1">{cycleName}</Badge>
                    </div>
                    {isLeak && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-0 flex items-center gap-1 shrink-0">
                        <AlertTriangle className="h-3 w-3" />Likely unused
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-zinc-500 text-xs">Detection confidence</span>
                      <span className="text-white text-xs font-medium">{Math.round(sub.confidenceScore * 100)}%</span>
                    </div>
                    <Progress value={sub.confidenceScore * 100} className="h-1.5 bg-zinc-800" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Last charged</span>
                      <span className="text-white">{new Date(sub.lastChargeDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Next expected</span>
                      <span className="text-white">{new Date(sub.nextExpectedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Annual cost</span>
                      <span className="text-white">₹{fmt(annualCost)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-zinc-400 font-medium">Amount</span>
                      <span className="text-emerald-500 font-bold text-lg">₹{fmt(Number(sub.avgAmount))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                      disabled={dismiss.isPending} onClick={() => dismiss.mutate(sub.id)}>
                      <X className="h-4 w-4 mr-1" />Dismiss
                    </Button>
                    <Button size="sm" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black"
                      disabled={confirm.isPending || sub.confirmed} onClick={() => confirm.mutate(sub.id)}>
                      <Check className="h-4 w-4 mr-1" />{sub.confirmed ? "Confirmed" : "Confirm"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
