"use client";

import { useState } from "react";
import { Send, Sparkles, TrendingDown, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Placeholder chat messages
const initialMessages = [
  {
    id: 1,
    role: "assistant" as const,
    content:
      "Hi! I'm your SpendWise AI assistant. I can help you understand your spending patterns, find savings opportunities, and answer questions about your finances. What would you like to know?",
  },
  {
    id: 2,
    role: "user" as const,
    content: "What's my biggest spending category this month?",
  },
  {
    id: 3,
    role: "assistant" as const,
    content:
      "Based on your transactions this month, **Food & Dining** is your biggest spending category at ₹8,200 (33.7% of total spending). This includes orders from Swiggy, Zomato, and restaurant visits. Would you like tips on how to reduce food delivery expenses?",
  },
  {
    id: 4,
    role: "user" as const,
    content: "Yes, give me some tips",
  },
  {
    id: 5,
    role: "assistant" as const,
    content:
      "Here are some personalized tips based on your spending:\n\n1. **Cook at home 2x more per week** - Could save ~₹800/month\n2. **Use Swiggy One membership** - You order ~8 times/month, membership pays off at 4+ orders\n3. **Set a weekly food budget** - Try ₹1,500/week and track via our app\n\nWant me to set up a food spending alert for you?",
  },
  {
    id: 6,
    role: "user" as const,
    content: "How much am I spending on subscriptions?",
  },
  {
    id: 7,
    role: "assistant" as const,
    content:
      "You currently have **7 active subscriptions** totaling **₹3,840/month** (₹46,080/year):\n\n• Netflix: ₹649\n• Spotify: ₹119\n• Cult.fit: ₹833 ⚠️ Unused for 45 days\n• Adobe CC: ₹1,675 ⚠️ Low usage detected\n• iCloud: ₹75\n• Swiggy One: ₹489\n\nI've flagged 2 subscriptions that appear unused. Canceling them could save you **₹2,508/month**!",
  },
];

const suggestedQuestions = [
  "How much did I spend last week?",
  "Find my unused subscriptions",
  "Compare this month to last month",
  "Where can I save money?",
];

// Weekly insight cards
const weeklyInsights = [
  {
    week: "This Week",
    totalSpend: 6850,
    categories: [
      { name: "Food", percentage: 35, color: "bg-orange-500" },
      { name: "Shopping", percentage: 28, color: "bg-blue-500" },
      { name: "Transport", percentage: 20, color: "bg-purple-500" },
      { name: "Other", percentage: 17, color: "bg-zinc-500" },
    ],
    tip: "Your food spending is 12% higher than your weekly average. Consider meal prepping on weekends.",
  },
  {
    week: "Last Week",
    totalSpend: 8420,
    categories: [
      { name: "Shopping", percentage: 42, color: "bg-blue-500" },
      { name: "Food", percentage: 30, color: "bg-orange-500" },
      { name: "Bills", percentage: 18, color: "bg-yellow-500" },
      { name: "Other", percentage: 10, color: "bg-zinc-500" },
    ],
    tip: "Large Amazon purchase detected. Set up price alerts for big purchases to catch deals.",
  },
  {
    week: "2 Weeks Ago",
    totalSpend: 5200,
    categories: [
      { name: "Bills", percentage: 48, color: "bg-yellow-500" },
      { name: "Food", percentage: 25, color: "bg-orange-500" },
      { name: "Transport", percentage: 15, color: "bg-purple-500" },
      { name: "Other", percentage: 12, color: "bg-zinc-500" },
    ],
    tip: "Great week! Your spending was 22% below average. Keep up the mindful spending!",
  },
  {
    week: "3 Weeks Ago",
    totalSpend: 7100,
    categories: [
      { name: "Food", percentage: 38, color: "bg-orange-500" },
      { name: "Entertainment", percentage: 25, color: "bg-pink-500" },
      { name: "Transport", percentage: 22, color: "bg-purple-500" },
      { name: "Other", percentage: 15, color: "bg-zinc-500" },
    ],
    tip: "Multiple streaming charges detected. Consider bundling services to save ₹200/month.",
  },
];

export default function InsightsPage() {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      role: "user" as const,
      content: inputValue,
    };

    setMessages([...messages, newMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: "assistant" as const,
          content:
            "I'm analyzing your data to answer that question. In a full implementation, I would provide personalized insights based on your actual transaction history!",
        },
      ]);
    }, 1500);
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
  };

  return (
    <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">AI Insights</h1>
            <p className="text-zinc-400 mt-1">
              Chat with AI about your finances and view weekly spending insights.
            </p>
          </div>

          {/* Split Layout */}
          <div className="grid lg:grid-cols-[58%_42%] gap-6">
            {/* Chat Interface */}
            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-sm flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20">
                    <Sparkles className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-white">SpendWise AI</CardTitle>
                    <p className="text-zinc-500 text-sm">
                      Ask anything about your finances
                    </p>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" && "flex-row-reverse"
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-emerald-500/20 text-emerald-500 text-xs">
                          SW
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                        message.role === "assistant"
                          ? "bg-zinc-800 text-white"
                          : "bg-slate-700 text-white ml-auto"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-emerald-500/20 text-emerald-500 text-xs">
                        SW
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                        <span
                          className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <span
                          className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              {/* Suggested Questions */}
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="px-3 py-1.5 text-xs rounded-full border border-white/10 text-zinc-400 hover:text-white hover:border-emerald-500/50 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Ask about your spending..."
                    className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-500"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-black"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Weekly Insights */}
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-emerald-500" />
                Weekly Insights
              </h2>

              {weeklyInsights.map((insight, i) => (
                <Card
                  key={i}
                  className="bg-zinc-900/50 border-white/10 backdrop-blur-sm"
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm font-medium">
                        {insight.week}
                      </span>
                      <span className="text-white font-bold">
                        ₹{insight.totalSpend.toLocaleString()}
                      </span>
                    </div>

                    {/* Category bar */}
                    <div className="h-2 rounded-full overflow-hidden flex">
                      {insight.categories.map((cat, j) => (
                        <div
                          key={j}
                          className={cn(cat.color)}
                          style={{ width: `${cat.percentage}%` }}
                        />
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3">
                      {insight.categories.map((cat, j) => (
                        <div key={j} className="flex items-center gap-1.5">
                          <div
                            className={cn("w-2 h-2 rounded-full", cat.color)}
                          />
                          <span className="text-zinc-500 text-xs">
                            {cat.name} {cat.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Tip */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <TrendingDown className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-emerald-400 text-xs leading-relaxed">
                        {insight.tip}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
    </div>
  );
}
