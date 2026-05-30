'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ArrowLeftRight, RefreshCw,
  Sparkles, Settings, LogOut, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const NAV = [
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/transactions',   icon: ArrowLeftRight,  label: 'Transactions' },
  { href: '/subscriptions',  icon: RefreshCw,       label: 'Subscriptions' },
  { href: '/insights',       icon: Sparkles,        label: 'AI Insights', badge: true },
  { href: '/settings',       icon: Settings,        label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-card border-r border-border flex-col hidden lg:flex z-30">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-2 border-b border-border">
        <TrendingUp className="h-5 w-5 text-[var(--color-brand)]" />
        <span className="text-base font-bold text-foreground tracking-tight">SpendWise</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-0.5" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-[var(--color-brand-muted)] text-[var(--color-brand)] font-semibold'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[var(--color-brand)] rounded-r-full" />
              )}
              <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-[var(--color-brand)]' : '')} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-[var(--color-brand-muted)] text-[var(--color-brand)]">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.email?.split('@')[0] ?? 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
