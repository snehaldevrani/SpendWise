import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  subtext?: string;
  className?: string;
  index?: number;
}

export function StatCard({ label, value, delta, deltaLabel, subtext, className, index = 0 }: StatCardProps) {
  const isPositiveDelta = delta !== undefined && delta > 0;
  const staggerClass = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4'][index] ?? '';

  return (
    <Card className={cn('p-5 page-enter', staggerClass, className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold font-mono text-foreground leading-none">{value}</p>
      {delta !== undefined && (
        <div className={cn(
          'inline-flex items-center gap-1 text-xs font-medium mt-2 px-1.5 py-0.5 rounded-md',
          isPositiveDelta
            ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
            : 'bg-[var(--color-success-muted)] text-[var(--color-success)]',
        )}>
          {isPositiveDelta
            ? <TrendingUp className="h-3 w-3" />
            : <TrendingDown className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}% {deltaLabel ?? ''}
        </div>
      )}
      {subtext && <p className="text-xs text-muted-foreground mt-1.5">{subtext}</p>}
    </Card>
  );
}
