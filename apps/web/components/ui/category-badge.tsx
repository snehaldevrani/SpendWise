import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_EMOJI } from '@/lib/utils';

interface CategoryBadgeProps {
  category: string;
  showEmoji?: boolean;
  className?: string;
  onClick?: () => void;
}

export function CategoryBadge({ category, showEmoji = false, className, onClick }: CategoryBadgeProps) {
  const color = CATEGORY_COLORS[category] ?? '#cbd5e1';
  const label = CATEGORY_LABELS[category] ?? category;
  const emoji = CATEGORY_EMOJI[category] ?? '📦';

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-default',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className,
      )}
      style={{ backgroundColor: `${color}20`, color }}
    >
      {showEmoji && <span>{emoji}</span>}
      {label}
    </span>
  );
}
