// Formatting utilities for invoice display

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

export function formatDate(dateStr: string, locale: 'vi-VN' | 'en-US' = 'vi-VN'): string {
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: locale === 'en-US' ? 'short' : '2-digit',
      day: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export function formatMonth(dateStr: string): string {
  try {
    return new Date(dateStr + '-01').toLocaleString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
