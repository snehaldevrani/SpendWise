import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, format: 'short' | 'medium' | 'full' = 'medium'): string {
  const d = new Date(date);
  if (format === 'short') return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (format === 'medium') return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date, 'short');
}

export const CATEGORY_COLORS: Record<string, string> = {
  food:          '#f59e0b',
  shopping:      '#8b5cf6',
  travel:        '#38bdf8',
  entertainment: '#ec4899',
  utilities:     '#94a3b8',
  health:        '#10b981',
  subscriptions: '#6366f1',
  income:        '#22c55e',
  other:         '#cbd5e1',
};

export const CATEGORY_LABELS: Record<string, string> = {
  food:          'Food & Dining',
  shopping:      'Shopping',
  travel:        'Travel',
  entertainment: 'Entertainment',
  utilities:     'Utilities',
  health:        'Health',
  subscriptions: 'Subscriptions',
  income:        'Income',
  other:         'Other',
};

export const CATEGORY_EMOJI: Record<string, string> = {
  food:          '🍽️',
  shopping:      '🛍️',
  travel:        '✈️',
  entertainment: '🎬',
  utilities:     '⚡',
  health:        '❤️',
  subscriptions: '🔄',
  income:        '💰',
  other:         '📦',
};
