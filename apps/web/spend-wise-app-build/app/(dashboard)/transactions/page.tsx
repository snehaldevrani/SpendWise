"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "food", label: "🍔 Food & Dining" },
  { value: "shopping", label: "🛒 Shopping" },
  { value: "transport", label: "🚗 Transport" },
  { value: "bills", label: "💡 Bills & Utilities" },
  { value: "entertainment", label: "🎬 Entertainment" },
  { value: "income", label: "💰 Income" },
  { value: "health", label: "🏥 Health" },
  { value: "other", label: "📦 Other" },
];

const categoryMap: Record<string, { emoji: string; label: string; color: string }> = {
  food: { emoji: "🍔", label: "Food & Dining", color: "bg-orange-500/20 text-orange-400" },
  shopping: { emoji: "🛒", label: "Shopping", color: "bg-blue-500/20 text-blue-400" },
  transport: { emoji: "🚗", label: "Transport", color: "bg-purple-500/20 text-purple-400" },
  bills: { emoji: "💡", label: "Bills", color: "bg-yellow-500/20 text-yellow-400" },
  entertainment: { emoji: "🎬", label: "Entertainment", color: "bg-pink-500/20 text-pink-400" },
  income: { emoji: "💰", label: "Income", color: "bg-emerald-500/20 text-emerald-400" },
  health: { emoji: "🏥", label: "Health", color: "bg-red-500/20 text-red-400" },
  other: { emoji: "📦", label: "Other", color: "bg-zinc-500/20 text-zinc-400" },
};

// 20 realistic Indian transactions
const transactionsData = [
  { id: 1, date: "2024-01-25", merchant: "Swiggy", category: "food", amount: -450, type: "debit" },
  { id: 2, date: "2024-01-25", merchant: "Amazon Pay", category: "shopping", amount: -2199, type: "debit" },
  { id: 3, date: "2024-01-24", merchant: "Salary Credit - TCS", category: "income", amount: 75000, type: "credit" },
  { id: 4, date: "2024-01-24", merchant: "Netflix Subscription", category: "entertainment", amount: -649, type: "debit" },
  { id: 5, date: "2024-01-23", merchant: "Uber Ride", category: "transport", amount: -320, type: "debit" },
  { id: 6, date: "2024-01-23", merchant: "BESCOM Electricity", category: "bills", amount: -1850, type: "debit" },
  { id: 7, date: "2024-01-22", merchant: "Zomato Gold", category: "food", amount: -580, type: "debit" },
  { id: 8, date: "2024-01-22", merchant: "Reliance Fresh", category: "shopping", amount: -920, type: "debit" },
  { id: 9, date: "2024-01-21", merchant: "Ola Auto", category: "transport", amount: -145, type: "debit" },
  { id: 10, date: "2024-01-21", merchant: "Apollo Pharmacy", category: "health", amount: -385, type: "debit" },
  { id: 11, date: "2024-01-20", merchant: "Spotify Premium", category: "entertainment", amount: -119, type: "debit" },
  { id: 12, date: "2024-01-20", merchant: "McDonald's", category: "food", amount: -350, type: "debit" },
  { id: 13, date: "2024-01-19", merchant: "Airtel Postpaid", category: "bills", amount: -599, type: "debit" },
  { id: 14, date: "2024-01-19", merchant: "Flipkart", category: "shopping", amount: -1499, type: "debit" },
  { id: 15, date: "2024-01-18", merchant: "BigBasket", category: "shopping", amount: -2350, type: "debit" },
  { id: 16, date: "2024-01-18", merchant: "Dominos Pizza", category: "food", amount: -499, type: "debit" },
  { id: 17, date: "2024-01-17", merchant: "HDFC Home Loan EMI", category: "bills", amount: -25000, type: "debit" },
  { id: 18, date: "2024-01-17", merchant: "Rapido Bike", category: "transport", amount: -85, type: "debit" },
  { id: 19, date: "2024-01-16", merchant: "Cult.fit Membership", category: "health", amount: -833, type: "debit" },
  { id: 20, date: "2024-01-16", merchant: "Starbucks", category: "food", amount: -420, type: "debit" },
];

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState(transactionsData);
  const itemsPerPage = 10;

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = tx.merchant
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || tx.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Paginate
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCategoryChange = (id: number, newCategory: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, category: newCategory } : tx))
    );
    setEditingId(null);
  };

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
            <h1 className="text-2xl font-bold text-white">Transactions</h1>
            <p className="text-zinc-400 mt-1">
              View and manage all your transactions.
            </p>
          </div>

          {/* Filters */}
          <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search merchants..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500"
                  />
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-full sm:w-[200px] bg-zinc-800 border-white/10 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    {categories.map((cat) => (
                      <SelectItem
                        key={cat.value}
                        value={cat.value}
                        className="text-white focus:bg-zinc-800 focus:text-white"
                      >
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">
                {filteredTransactions.length} Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-20 bg-zinc-800" />
                      <Skeleton className="h-4 flex-1 bg-zinc-800" />
                      <Skeleton className="h-6 w-24 bg-zinc-800" />
                      <Skeleton className="h-4 w-16 bg-zinc-800" />
                      <Skeleton className="h-4 w-24 bg-zinc-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-zinc-400">Date</TableHead>
                          <TableHead className="text-zinc-400">
                            Merchant
                          </TableHead>
                          <TableHead className="text-zinc-400">
                            Category
                          </TableHead>
                          <TableHead className="text-zinc-400">Type</TableHead>
                          <TableHead className="text-zinc-400 text-right">
                            Amount
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((tx) => (
                          <TableRow
                            key={tx.id}
                            className="border-white/5 hover:bg-white/5"
                          >
                            <TableCell className="text-zinc-400 text-sm">
                              {formatDate(tx.date)}
                            </TableCell>
                            <TableCell className="text-white font-medium">
                              {tx.merchant}
                            </TableCell>
                            <TableCell>
                              {editingId === tx.id ? (
                                <Select
                                  value={tx.category}
                                  onValueChange={(val) =>
                                    handleCategoryChange(tx.id, val)
                                  }
                                >
                                  <SelectTrigger className="w-[160px] h-8 bg-zinc-800 border-white/10 text-white text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-900 border-white/10">
                                    {categories
                                      .filter((c) => c.value !== "all")
                                      .map((cat) => (
                                        <SelectItem
                                          key={cat.value}
                                          value={cat.value}
                                          className="text-white text-xs focus:bg-zinc-800 focus:text-white"
                                        >
                                          {cat.label}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  className={`cursor-pointer ${
                                    categoryMap[tx.category]?.color ||
                                    "bg-zinc-500/20 text-zinc-400"
                                  }`}
                                  onClick={() => setEditingId(tx.id)}
                                >
                                  {categoryMap[tx.category]?.emoji}{" "}
                                  {categoryMap[tx.category]?.label || tx.category}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  tx.type === "credit"
                                    ? "border-emerald-500/50 text-emerald-500"
                                    : "border-red-500/50 text-red-400"
                                }
                              >
                                {tx.type === "credit" ? "Credit" : "Debit"}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={`text-right font-semibold ${
                                tx.type === "credit"
                                  ? "text-emerald-500"
                                  : "text-red-400"
                              }`}
                            >
                              {tx.type === "credit" ? "+" : "-"}₹
                              {Math.abs(tx.amount).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <p className="text-zinc-500 text-sm">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * itemsPerPage + 1,
                        filteredTransactions.length
                      )}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredTransactions.length
                      )}{" "}
                      of {filteredTransactions.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-white/10 text-white hover:bg-white/10"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-white text-sm px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-white/10 text-white hover:bg-white/10"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
