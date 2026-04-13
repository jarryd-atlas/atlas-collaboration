/**
 * Format a numeric value as a compact currency string.
 * e.g. 1500000 → "$1.5M", 250000 → "$250k", 800 → "$800"
 */
export function formatCurrency(value: number | null): string {
  if (!value) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toLocaleString()}`;
}
