import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility helper that combines clsx conditional class toggling
 * with tailwind-merge to resolve Tailwind CSS class conflicts reliably.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
