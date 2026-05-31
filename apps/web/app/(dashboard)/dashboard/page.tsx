"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

// 60-day spending data
const spendingData = Array.from({ length: 60 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (59 - i));
  return {
    date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    amount: Math.floor(Math.random() * 1500) + 500,
  };
});

// Category data
const categoryData = [
  { name: "Food & Dining", value: 8200, color: "#10b981" },
  { name: "Shopping", value: 5400, color: "#3b82f6" },
  { name: "Bills & Utilities", value: 4100, color: "#f59e0b" },
  { name: "Transport", value: 2800, color: "#8b5cf6" },
  { name: "Entertainment", value: 2100, color: "#ec4899" },
  { name: "Others", value: 1750, color: "#6b7280" },
];

// Recent transactions
const transactions = [
  { id: 1, date: "Today", merchant: "Swiggy", category: "🍔 Food", amount: -450, type: "debit" },
  { id: 2, date: "Today", merchant: "Amazon Pay", category: "🛒 Shopping", amount: -2199, type: "debit" },
  { id: 3, date: "Yesterday", merchant: "Salary Credit", category: "💰 Income", amount: 75000, type: "credit" },
  { id: 4, date: "Yesterday", merchant: "Netflix", category: "🎬 Entertainment", amount: -649, type: "debit" },
  { id: 5, date: "22 Jan", merchant: "Uber", category: "🚗 Transport", amount: -320, type: "debit" },
  { id: 6, date: "22 Jan", merchant: "Electricity Bill", category: "💡 Bills", amount: -1850, type: "debit" },
  { id: 7, date: "21 Jan", merchant: "Zomato", category: "🍔 Food", amount: -580, type: "debit" },
  { id: 8, date: "21 Jan", merchant: "Reliance Fresh", category: "🛒 Shopping", amount: -920, type: "debit" },
];

// Active subscriptions preview
const subscriptions = [
  { name: "Netflix", amount: 649, cycle: "Monthly", logo: "🎬" },
  { name: "Spotify", amount: 119, cycle: "Monthly", logo: "🎵" },
  { name: "Amazon Prime", amount: 1499, cycle: "Yearly", logo: "📦" },
];

const statCards = [
  {
    title: "This Month",
    value: "₹24,350",
    change: "-8%",
    trend: "down",
    icon: Wallet,
  },
  {
    title: "Last Month",
    value: "₹26,500",
    change: "+12%",
    trend: "up",
    icon: CreditCard,
  },
  {
    title: "Savings",
    value: "₹3,200",
    change: "+15%",
    trend: "up",
    icon: TrendingUp,
  },
  {
    title: "Active Subs",
    value: "7",
    change: "₹3,840/mo",
    trend: "neutral",
    icon: RefreshCw,
  },
];

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-zinc-400 mt-1">
              Welcome back! Here&apos;s your financial overview.
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                    {stat.trend !== "neutral" && (
                      <div
                        className={`flex items-center gap-1 text-sm ${
                          stat.trend === "up"
                            ? "text-emerald-500"
                            : "text-red-500"
                        }`}
                      >
                        {stat.trend === "up" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {stat.change}
                      </div>
                    )}
                    {stat.trend === "neutral" && (
                      <span className="text-xs text-zinc-500">{stat.change}</span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Area Chart */}
            <Card className="lg:col-span-2 bg-zinc-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spendingData}>
                      <defs>
                        <linearGradient
                          id="colorAmount"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#71717a"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        interval={9}
                      />
                      <YAxis
                        stroke="#71717a"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `₹${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #27272a",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#fff" }}
                        formatter={(value) => [`₹${value ?? 0}`, "Spent"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorAmount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #27272a",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => [`₹${value ?? 0}`, ""]}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span className="text-zinc-400 text-xs">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions & Subscriptions */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent Transactions */}
            <Card className="lg:col-span-2 bg-zinc-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Recent Transactions</CardTitle>
                <a
                  href="/transactions"
                  className="text-sm text-emerald-500 hover:underline"
                >
                  View all
                </a>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-xs text-zinc-500 w-16">
                          {tx.date}
                        </div>
                        <div>
                          <p className="text-white font-medium">{tx.merchant}</p>
                          <Badge
                            variant="secondary"
                            className="bg-zinc-800 text-zinc-400 text-xs mt-1"
                          >
                            {tx.category}
                          </Badge>
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${
                          tx.type === "credit"
                            ? "text-emerald-500"
                            : "text-red-400"
                        }`}
                      >
                        {tx.type === "credit" ? "+" : ""}₹
                        {Math.abs(tx.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Active Subscriptions */}
            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Active Subscriptions</CardTitle>
                <a
                  href="/subscriptions"
                  className="text-sm text-emerald-500 hover:underline"
                >
                  Manage
                </a>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{sub.logo}</span>
                        <div>
                          <p className="text-white font-medium">{sub.name}</p>
                          <p className="text-zinc-500 text-xs">{sub.cycle}</p>
                        </div>
                      </div>
                      <span className="text-white font-semibold">
                        ₹{sub.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
