"use client";

import { useState } from "react";
import {
  UserPlus,
  Upload,
  PiggyBank,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useUIStore } from "@/store";

const BANKS = [
  {
    id: "hdfc",
    label: "HDFC Bank",
    color: "text-blue-400",
    steps: [
      "Open HDFC NetBanking or the HDFC mobile app.",
      'Go to "Accounts" → "Bank Account Statement".',
      'Select the date range and choose "Excel" or "PDF" as the format.',
      "Download the file and upload it here.",
      "Password hint: your Customer ID (printed on the top of your statement).",
    ],
  },
  {
    id: "icici",
    label: "ICICI Bank",
    color: "text-orange-400",
    steps: [
      "Open iMobile Pay or ICICI NetBanking.",
      'Navigate to "My Accounts" → "Account Statement".',
      'Set your date range and click "Download" (Excel or PDF).',
      "Upload the downloaded file here.",
      'Password hint: first 4 letters of your name in uppercase + DOB as DDMM — e.g. SNEJ0512.',
    ],
  },
  {
    id: "sbi",
    label: "SBI",
    color: "text-sky-400",
    steps: [
      "Open YONO SBI or SBI OnlineSBI portal.",
      'Go to "My Accounts" → "Account Statement".',
      "Choose date range and download as Excel or PDF.",
      "Upload the file here.",
      "Password hint: account number + DOB as DDMMYYYY.",
    ],
  },
  {
    id: "axis",
    label: "Axis Bank",
    color: "text-purple-400",
    steps: [
      "Open the Axis Mobile app or Axis NetBanking.",
      'Go to "Accounts" → "Account Statement".',
      'Pick your period and tap "Download" in Excel or PDF.',
      "Upload it here.",
      "Password hint: your DOB as DDMMYYYY — e.g. 15061998.",
    ],
  },
  {
    id: "kotak",
    label: "Kotak Bank",
    color: "text-green-400",
    steps: [
      "Open the Kotak app or Kotak NetBanking.",
      'Go to "Accounts" → "Statements".',
      "Set the date range and download as Excel or PDF.",
      "Upload it here.",
      "Password hint: your DOB as DDMMYYYY.",
    ],
  },
  {
    id: "other",
    label: "Other Bank",
    color: "text-zinc-400",
    steps: [
      "Log in to your bank's official app or website.",
      'Look for "Statements", "Account Activity", or "Download Statement".',
      "Download as Excel (.xlsx) or PDF — most banks support this.",
      "Upload it here.",
      "Password hint: try your DOB (DDMMYYYY) or mobile number if the file is protected.",
    ],
  },
];

const STEPS = [
  {
    number: 1,
    icon: UserPlus,
    title: "Create your account",
    description: "You're already here — you're logged in! Nothing else to do for this step.",
    done: true,
    action: null,
  },
  {
    number: 2,
    icon: Upload,
    title: "Upload your bank statement",
    description:
      "Download your statement from your bank's app or website, then upload it here. We support CSV, Excel, and PDF formats from all major Indian banks.",
    done: false,
    action: "upload",
  },
  {
    number: 3,
    icon: PiggyBank,
    title: "Set your budgets",
    description:
      "Head to the Budgets page to set monthly spending limits per category (Food, Travel, Shopping, etc.). You'll get alerts when you're close to the limit.",
    done: false,
    action: "budgets",
  },
  {
    number: 4,
    icon: Sparkles,
    title: "Talk to the AI",
    description:
      "Go to Insights and ask the AI anything about your spending. Try questions like:",
    done: false,
    action: "insights",
    examples: [
      "What's my biggest expense category this month?",
      "How much did I spend on Zomato last week?",
      "Which subscriptions am I paying for?",
      "Where can I cut spending to save ₹5,000?",
    ],
  },
];

export default function TutorialPage() {
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const { setUploadDialog } = useUIStore();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Getting started</h1>
        <p className="text-zinc-400 text-sm">
          Follow these 4 steps to get the most out of SpendWise.
        </p>
      </div>

      {STEPS.map((step) => (
        <div
          key={step.number}
          className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 space-y-4"
        >
          {/* Step header */}
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl shrink-0 text-sm font-bold",
                step.done
                  ? "bg-emerald-500/20 text-emerald-500"
                  : "bg-zinc-800 text-zinc-400"
              )}
            >
              {step.done ? <CheckCircle className="h-5 w-5" /> : step.number}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-white">{step.title}</h2>
                {step.done && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                    Done
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>

              {/* AI example questions */}
              {step.examples && (
                <ul className="mt-3 space-y-1.5">
                  {step.examples.map((ex) => (
                    <li
                      key={ex}
                      className="text-xs text-zinc-300 bg-zinc-800/60 rounded-lg px-3 py-1.5 border border-white/5"
                    >
                      &ldquo;{ex}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Bank selector (Step 2 only) */}
          {step.action === "upload" && (
            <div className="space-y-2 pl-14">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                How to download your statement
              </p>
              <div className="space-y-2">
                {BANKS.map((bank) => (
                  <div
                    key={bank.id}
                    className="rounded-xl border border-white/10 bg-zinc-950/50 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBank((prev) => (prev === bank.id ? null : bank.id))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/5 transition-colors"
                    >
                      <span className={cn("font-semibold", bank.color)}>{bank.label}</span>
                      {expandedBank === bank.id ? (
                        <ChevronUp className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      )}
                    </button>
                    {expandedBank === bank.id && (
                      <ol className="px-4 pb-4 space-y-2 list-decimal list-inside border-t border-white/5 pt-3">
                        {bank.steps.map((s, i) => (
                          <li key={i} className="text-xs text-zinc-300 leading-relaxed">
                            {s}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA button */}
          {step.action && (
            <div className="pl-14">
              {step.action === "upload" && (
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
                  onClick={() => setUploadDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Statement
                </Button>
              )}
              {step.action === "budgets" && (
                <Link href="/budgets">
                  <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <PiggyBank className="h-4 w-4 mr-2" />
                    Go to Budgets
                  </Button>
                </Link>
              )}
              {step.action === "insights" && (
                <Link href="/insights">
                  <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Open Insights & AI Chat
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Support note */}
      <p className="text-xs text-zinc-600 text-center pb-4">
        Need help?{" "}
        <a
          href="https://www.linkedin.com/in/snehaldevrani/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          Reach out to the creator <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
