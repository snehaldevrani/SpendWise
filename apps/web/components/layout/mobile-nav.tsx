'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, RefreshCw, Sparkles, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Home' },
  { href: '/transactions',  icon: ArrowLeftRight,  label: 'Txns' },
  { href: '/subscriptions', icon: RefreshCw,       label: 'Subs' },
  { href: '/insights',      icon: Sparkles,        label: 'AI' },
  { href: '/settings',      icon: Settings,        label: 'Settings' },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-30">
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link key={href} href={href} className="flex flex-col items-center gap-0.5 flex-1 py-2">
            <Icon className={cn('h-5 w-5', active ? 'text-[var(--color-brand)]' : 'text-muted-foreground')} />
            <span className={cn('text-[10px] font-medium', active ? 'text-[var(--color-brand)]' : 'text-muted-foreground')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
