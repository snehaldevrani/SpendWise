import { cn } from '@/lib/utils';

interface AmountProps {
  value: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  positive?: boolean;
  showSign?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl font-bold',
};

export function Amount({ value, currency = '₹', size = 'md', positive, showSign, className }: AmountProps) {
  const isPositive = positive ?? value > 0;
  const formatted = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));

  return (
    <span className={cn(
      'font-mono font-semibold',
      SIZE_CLASSES[size],
      isPositive ? 'text-[var(--color-success)]' : 'text-foreground',
      className,
    )}>
      {showSign && isPositive && '+'}
      <span className="text-muted-foreground text-[0.8em] mr-px">{currency}</span>
      {formatted}
    </span>
  );
}
