import { LucideIcon, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryText?: string;
  className?: string;
}

export function EmptyState({ icon: Icon = UploadCloud, title, description, action, secondaryText, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-8 text-center', className)}>
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="bg-foreground text-background hover:bg-foreground/85 gap-2">
          <UploadCloud className="h-4 w-4" />
          {action.label}
        </Button>
      )}
      {secondaryText && <p className="text-xs text-muted-foreground mt-3 max-w-sm">{secondaryText}</p>}
    </div>
  );
}
