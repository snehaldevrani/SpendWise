"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Upload,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
  Target,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Accuracy", value: "98%", icon: Target },
  { label: "Avg Savings", value: "₹12k", icon: Sparkles },
];

const features = [
  {
    title: "Smart CSV Import",
    description:
      "Upload your bank statement and we automatically parse transactions from all major Indian banks.",
    icon: Upload,
  },
  {
    title: "AI-Powered Insights",
    description:
      "Our AI analyzes your spending patterns, detects hidden subscriptions, and identifies money leaks.",
    icon: Zap,
  },
  {
    title: "Bank-Grade Security",
    description:
      "Your data is encrypted and never leaves your device. We don't store your bank credentials.",
    icon: Shield,
  },
];

const banks = ["HDFC", "ICICI", "SBI", "Axis", "Kotak"];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-lg font-semibold text-white">SpendWise</span>
            </Link>
            <Link href="/login">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 text-balance">
            Know where your{" "}
            <span className="text-emerald-500">money goes</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-8 text-pretty">
            Upload your bank CSV statement. Our AI detects subscriptions, flags
            spending leaks, and answers questions about your finances.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium px-8"
              >
                Sign Up Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Login
              </Button>
            </Link>
          </div>

          {/* Animated stat chips */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-zinc-900/50 backdrop-blur-sm",
                  mounted && "animate-in fade-in slide-in-from-bottom-2",
                  mounted && `duration-500`
                )}
                style={{ animationDelay: mounted ? `${i * 100}ms` : "0ms" }}
              >
                <stat.icon className="h-4 w-4 text-emerald-500" />
                <span className="text-white font-semibold">{stat.value}</span>
                <span className="text-zinc-500 text-sm">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">
            Everything you need to take control
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20 mb-4">
                  <feature.icon className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bank support */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-zinc-500 text-sm mb-6">
            Works with all major Indian banks
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {banks.map((bank) => (
              <div
                key={bank}
                className="px-5 py-2.5 rounded-full border border-white/10 bg-zinc-900/50 text-zinc-300 text-sm font-medium"
              >
                {bank}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span>SpendWise</span>
            <span>© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-zinc-500 hover:text-white transition-colors text-sm"
            >
              Privacy Policy
            </Link>
            <a
              href="https://www.linkedin.com/in/snehaldevrani/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Take me to creator</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
