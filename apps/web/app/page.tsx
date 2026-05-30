import Link from 'next/link';
import { TrendingUp, Upload, PieChart, Bell, Shield, ArrowRight, Sparkles } from 'lucide-react';

const BANKS = [
  { name: 'HDFC Bank', format: 'XLS', steps: ['NetBanking → Accounts → Savings → View Statement', 'Select date range → Download as XLS'], password: 'Customer ID (shown on first page of statement)' },
  { name: 'ICICI Bank', format: 'XLS/PDF', steps: ['NetBanking → Accounts → View Statement → Download', 'Choose XLS format and date range'], password: 'First 4 letters of name (CAPS) + DOB (DDMM)' },
  { name: 'SBI', format: 'XLS', steps: ['OnlineSBI → My Accounts → Account Statement', 'Click "Download" → Select Excel format'], password: 'Account number + DOB (DDMMYYYY)' },
  { name: 'Axis Bank', format: 'XLS', steps: ['NetBanking → My Accounts → Detailed Statement', 'Select dates → Download as Excel'], password: 'Transaction password or DOB (DDMMYYYY)' },
  { name: 'Kotak', format: 'XLS/CSV', steps: ['NetBanking → My Accounts → View Statement', 'Download → Select CSV or XLS'], password: 'DOB (DDMMYYYY) or Customer ID' },
  { name: 'All Banks', format: 'CSV/XLS', steps: ['Most banks: NetBanking → Statement → Download', 'Choose XLS/CSV (avoid PDF if possible)'], password: 'Usually DOB-based — we show hints during upload' },
];

const FEATURES = [
  { icon: Upload, title: 'Upload CSV', desc: 'Drop your bank statement — we parse HDFC, ICICI, SBI, Axis, and more automatically.' },
  { icon: PieChart, title: 'Category Breakdown', desc: 'See exactly where your money goes — food, travel, shopping, subscriptions, bills.' },
  { icon: Bell, title: 'Subscription Detection', desc: 'Auto-detect recurring charges — Netflix, Spotify, gym, broadband — and spot unused ones.' },
  { icon: Sparkles, title: 'AI Recommendations', desc: 'Get personalized tips on where to cut back, with estimated monthly savings.' },
  { icon: Shield, title: 'Private & Secure', desc: 'Your data stays on your machine. No third-party analytics. No selling your data.' },
];

export default function RootPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[var(--color-brand)]" />
            <span className="text-xl font-bold text-foreground">SpendWise</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-lg hover:bg-foreground/85 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            Know where every<br />rupee goes.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Upload your bank statement CSV. Get instant category breakdowns, subscription detection,
            and AI-powered savings tips — all in 30 seconds.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-lg text-base font-semibold hover:bg-foreground/85 transition-colors">
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">What you get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="border border-border rounded-xl p-6 hover:border-[var(--color-brand)] transition-colors">
                <f.icon className="h-8 w-8 text-[var(--color-brand)] mb-4" />
                <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-secondary/40 border-y border-border">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-foreground text-center mb-3">How to get your bank statement</h2>
            <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              Most Indian banks provide Excel (XLS) downloads — some are password-protected.
              We handle both. Upload the file and enter the password if prompted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BANKS.map((bank) => (
                <div key={bank.name} className="bg-card border border-border rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">{bank.name}</h3>
                    <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{bank.format}</span>
                  </div>
                  <ol className="space-y-2 mb-3">
                    {bank.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground"><span className="font-semibold">Password:</span> {bank.password}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to take control?</h2>
          <p className="text-muted-foreground mb-8">Upload one CSV and see where your money actually goes.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-lg text-base font-semibold hover:bg-foreground/85 transition-colors">
            Create free account <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">SpendWise — Built by Snehal Devrani</p>
      </footer>
    </div>
  );
}
