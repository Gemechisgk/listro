import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, lang: 'en' | 'am' = 'en') {
  const formatted = new Intl.NumberFormat("en-US").format(amount);
  const currency = lang === 'am' ? 'ብር' : 'Birr';
  return `${formatted} ${currency}`;
}
