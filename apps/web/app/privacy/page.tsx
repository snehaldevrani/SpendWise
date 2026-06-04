"use client";

import Link from "next/link";
import { TrendingUp, Shield, Lock, Eye, Trash2, Mail, Database, Server, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white hover:text-emerald-400 transition-colors">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <span className="font-semibold">SpendWise</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium mb-6">
            <Shield className="h-3 w-3" />
            Last updated June 2026
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            SpendWise is a personal finance tool. Your financial data is personal — this page explains exactly what we collect, how it&apos;s protected, what leaves our servers, and your rights as a user.
          </p>
        </div>

        <div className="space-y-10">

          {/* Section 1 */}
          <Section icon={Database} title="What Data We Store">
            <p>When you create an account and use SpendWise, we store the following:</p>
            <ul className="mt-3 space-y-2">
              <Li><strong>Account data:</strong> Your email address. Your password is never stored — only a one-way bcrypt hash (cost factor 12) is saved. We cannot recover your password.</Li>
              <Li><strong>Transaction data:</strong> Date, merchant name, amount, currency, category, and transaction type from the bank statements you upload. Raw bank reference codes (UPI IDs like <code className="text-emerald-400 text-xs">UPIAR/01391452/DR/</code>) are stripped immediately on import and never stored.</Li>
              <Li><strong>Transaction embeddings:</strong> 768-dimensional vector representations of your transactions, used to power the AI chat feature. These are stored alongside your transactions in the database.</Li>
              <Li><strong>Detected subscriptions:</strong> Recurring charges our algorithm identifies — merchant name, estimated cycle, confidence score.</Li>
              <Li><strong>Weekly insights:</strong> Aggregated summaries computed from your transactions — totals, category breakdowns, top merchants per week.</Li>
              <Li><strong>Budget settings:</strong> Per-category spending limits and recurring budget preferences you configure.</Li>
              <Li><strong>Notification preferences:</strong> Whether you&apos;ve opted into weekly digest, new subscription alerts, and spending spike alerts.</Li>
            </ul>
            <p className="mt-4 text-zinc-500 text-sm">We do not store: bank account numbers, card numbers, full UPI reference IDs, PAN, Aadhaar, or any government-issued identifiers.</p>
          </Section>

          {/* Section 2 */}
          <Section icon={Lock} title="How Your Data Is Protected">
            <div className="space-y-4">
              <SubSection title="Passwords">
                Passwords are hashed using bcrypt with cost factor 12 before being stored. The plaintext password is never written to disk. Even SpendWise&apos;s own team cannot read your password.
              </SubSection>
              <SubSection title="Session tokens">
                Authentication tokens are stored exclusively in <strong>httpOnly cookies</strong> — they are invisible to JavaScript running on the page. This means an XSS vulnerability (injected script, malicious ad) cannot steal your session token. Cookies use <code className="text-emerald-400 text-xs">SameSite=Lax</code> to block cross-site request forgery.
              </SubSection>
              <SubSection title="Refresh token security">
                Long-lived refresh tokens are hashed with bcrypt before being stored in the database. If an attacker obtained a full database backup, they still could not forge your session — the raw token lives only in your browser cookie.
              </SubSection>
              <SubSection title="Data in transit">
                All communication between your browser, the SpendWise API, and the database is encrypted:
                <ul className="mt-2 space-y-1">
                  <Li>Browser ↔ API: HTTPS (TLS terminated by Render)</Li>
                  <Li>Browser ↔ Frontend: HTTPS (Vercel)</Li>
                  <Li>API ↔ Database: SSL (<code className="text-emerald-400 text-xs">sslmode=require</code>)</Li>
                  <Li>API ↔ Redis: TLS (<code className="text-emerald-400 text-xs">rediss://</code>)</Li>
                </ul>
              </SubSection>
              <SubSection title="Data isolation">
                Every database query is scoped to your user ID, which is extracted from your validated JWT. It is architecturally impossible for one user&apos;s data to appear in another user&apos;s queries — not just by policy, but by code structure.
              </SubSection>
            </div>
          </Section>

          {/* Section 3 */}
          <Section icon={Server} title="What Leaves Our Servers (Third-party AI)">
            <p>
              SpendWise uses <strong>Google Gemini</strong> to power AI chat and recommendations. When you use these features, sanitised transaction data is sent to Google&apos;s API:
            </p>
            <ul className="mt-3 space-y-2">
              <Li><strong>What Gemini receives:</strong> Merchant brand names (e.g. &quot;Zomato&quot;), amounts, categories, and dates.</Li>
              <Li><strong>What Gemini never receives:</strong> Your email address, name, raw UPI reference IDs, bank account details, or any government-issued identifiers.</Li>
              <Li><strong>Sanitisation step:</strong> Before any data reaches Gemini, raw UPI strings like <code className="text-emerald-400 text-xs">UPIAR/013914520250/DR/Zomato/UTIB</code> are reduced to just <code className="text-emerald-400 text-xs">Zomato</code>.</Li>
            </ul>
            <p className="mt-4 text-zinc-500 text-sm">
              This data transfer is governed by Google&apos;s standard API Terms of Service and privacy policy. A stronger production approach would use a locally-hosted embedding model so no financial text leaves our infrastructure — that is on our roadmap.
            </p>
          </Section>

          {/* Section 4 */}
          <Section icon={Eye} title="Who Can Access Your Data">
            <ul className="space-y-2">
              <Li><strong>You:</strong> Full access to read, edit, export (CSV), and delete your own data.</Li>
              <Li><strong>SpendWise team:</strong> Database access for maintenance only. We do not inspect individual transaction data.</Li>
              <Li><strong>Google (Gemini API):</strong> Sanitised financial records for AI responses only. See section above.</Li>
              <Li><strong>No one else.</strong> We do not sell, share, or licence your data to advertisers, data brokers, or any third party.</Li>
            </ul>
          </Section>

          {/* Section 5 */}
          <Section icon={Trash2} title="Your Rights — Data Deletion">
            <p>You can delete your data at any time, no questions asked:</p>
            <ul className="mt-3 space-y-2">
              <Li><strong>Delete all transactions:</strong> Settings → Danger Zone → &quot;Clear all data&quot;. Removes all transactions, detected subscriptions, insights, and embeddings.</Li>
              <Li><strong>Delete your account:</strong> Settings → Danger Zone → &quot;Delete account&quot;. Permanently deletes your account and all associated data via cascading database delete. This action is irreversible.</Li>
            </ul>
            <p className="mt-4 text-zinc-500 text-sm">
              Deletion takes effect immediately. No backups of your personal data are retained after deletion.
            </p>
          </Section>

          {/* Section 6 */}
          <Section icon={Mail} title="Cookies">
            <p>SpendWise uses two cookies for authentication:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-white/10">
                    <th className="pb-2 pr-6 font-medium">Cookie</th>
                    <th className="pb-2 pr-6 font-medium">Purpose</th>
                    <th className="pb-2 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-6"><code className="text-emerald-400 text-xs">access_token</code></td>
                    <td className="py-2 pr-6">Authenticates API requests</td>
                    <td className="py-2">15 minutes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-6"><code className="text-emerald-400 text-xs">refresh_token</code></td>
                    <td className="py-2 pr-6">Silently renews the access token</td>
                    <td className="py-2">7 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-zinc-500 text-sm">Both cookies are httpOnly (not readable by JavaScript) and Secure in production. No third-party tracking, analytics, or advertising cookies are used.</p>
          </Section>

          {/* Section 7 */}
          <Section icon={Mail} title="Contact">
            <p>
              Questions about your data? Reach out via{" "}
              <a
                href="https://www.linkedin.com/in/snehaldevrani/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                LinkedIn
              </a>
              .
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10 text-center">
        <p className="text-zinc-600 text-sm">SpendWise © 2026 · Your data, your control.</p>
      </footer>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20">
          <Icon className="h-4 w-4 text-emerald-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="text-zinc-400 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-white font-medium mb-1">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{children}</p>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-emerald-500 mt-1 shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}
