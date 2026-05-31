"use client";

import Sidebar from "@/components/layout/sidebar";
import { RefreshCw, TrendingUp, AlertTriangle, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const statCards = [
  {
    title: "Monthly Cost",
    value: "₹3,840",
    icon: RefreshCw,
    description: "7 active subscriptions",
  },
  {
    title: "Active",
    value: "7",
    icon: Check,
    description: "Confirmed subscriptions",
  },
  {
    title: "Annual Savings",
    value: "₹18,240",
    icon: TrendingUp,
    description: "If you cancel unused",
  },
];

const subscriptions = [
  {
    id: 1,
    name: "Netflix",
    logo: "🎬",
    amount: 649,
    cycle: "Monthly",
    lastCharged: "2024-01-15",
    annualCost: 7788,
    confidence: 95,
    isUnused: false,
  },
  {
    id: 2,
    name: "Spotify Premium",
    logo: "🎵",
    amount: 119,
    cycle: "Monthly",
    lastCharged: "2024-01-18",
    annualCost: 1428,
    confidence: 98,
    isUnused: false,
  },
  {
    id: 3,
    name: "Cult.fit Membership",
    logo: "🏋️",
    amount: 833,
    cycle: "Monthly",
    lastCharged: "2024-01-16",
    annualCost: 9996,
    confidence: 72,
    isUnused: true,
  },
  {
    id: 4,
    name: "Adobe Creative Cloud",
    logo: "🎨",
    amount: 1675,
    cycle: "Monthly",
    lastCharged: "2024-01-10",
    annualCost: 20100,
    confidence: 88,
    isUnused: true,
  },
  {
    id: 5,
    name: "iCloud Storage",
    logo: "☁️",
    amount: 75,
    cycle: "Monthly",
    lastCharged: "2024-01-20",
    annualCost: 900,
    confidence: 99,
    isUnused: false,
  },
  {
    id: 6,
    name: "Swiggy One",
    logo: "🍔",
    amount: 489,
    cycle: "Quarterly",
    lastCharged: "2024-01-05",
    annualCost: 1956,
    confidence: 85,
    isUnused: false,
  },
];

export default function SubscriptionsPage() {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="md:ml-[240px] p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
            <p className="text-zinc-400 mt-1">
              Manage your recurring payments and find savings opportunities.
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {statCards.map((stat) => (
              <Card
                key={stat.title}
                className="bg-zinc-900/50 border-white/10 backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-xl bg-emerald-500/10">
                      <stat.icon className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stat.value}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Subscriptions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.map((sub) => (
              <Card
                key={sub.id}
                className="bg-zinc-900/50 border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{sub.logo}</span>
                      <div>
                        <CardTitle className="text-white text-lg">
                          {sub.name}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className="bg-zinc-800 text-zinc-400 text-xs mt-1"
                        >
                          {sub.cycle}
                        </Badge>
                      </div>
                    </div>
                    {sub.isUnused && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-0 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Likely unused
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Confidence bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-zinc-500 text-xs">
                        Detection confidence
                      </span>
                      <span className="text-white text-xs font-medium">
                        {sub.confidence}%
                      </span>
                    </div>
                    <Progress
                      value={sub.confidence}
                      className="h-1.5 bg-zinc-800"
                    />
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Last charged</span>
                      <span className="text-white">
                        {formatDate(sub.lastCharged)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Annual cost</span>
                      <span className="text-white">
                        ₹{sub.annualCost.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-zinc-400 font-medium">Amount</span>
                      <span className="text-emerald-500 font-bold text-lg">
                        ₹{sub.amount}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
