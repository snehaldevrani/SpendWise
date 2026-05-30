'use client';
import { usePathname } from 'next/navigation';
import { Upload, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/transactions':  'Transactions',
  '/subscriptions': 'Subscriptions',
  '/insights':      'AI Insights',
  '/settings':      'Settings',
};

export function Topbar() {
  const pathname = usePathname();
  const { setUploadDialog } = useUIStore();
  const { resolvedTheme, setTheme } = useTheme();
  const title = PAGE_TITLES[pathname] ?? 'SpendWise';

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <h1 className="text-base font-semibold text-foreground lg:text-lg">{title}</h1>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => setUploadDialog(true)}
          className="bg-foreground text-background hover:bg-foreground/85 text-xs font-medium gap-1.5 h-8"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Upload CSV</span>
        </Button>
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
