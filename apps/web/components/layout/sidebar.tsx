"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  TrendingUp,
  LayoutDashboard,
  CreditCard,
  RefreshCw,
  Lightbulb,
  Settings2,
  LogOut,
  Menu,
  X,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore, useUIStore } from "@/store";
import { api } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { setUploadDialog } = useUIStore();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore errors on logout
    }
    logout();
    router.push('/login');
  };

  const displayName = user?.email?.split('@')[0] ?? 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-[240px] flex flex-col border-r border-white/10 bg-zinc-950/80 backdrop-blur-xl transition-transform duration-300",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <span className="text-lg font-semibold text-white">SpendWise</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Upload button */}
        <div className="px-3 pb-4">
          <Button
            onClick={() => { setUploadDialog(true); setMobileOpen(false); }}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white gap-2 font-medium"
          >
            <Upload className="h-4 w-4" />
            Upload Statement
          </Button>
        </div>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src="" alt={displayName} />
              <AvatarFallback className="bg-emerald-500/20 text-emerald-500 text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 mt-2 text-zinc-400 hover:text-white hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
