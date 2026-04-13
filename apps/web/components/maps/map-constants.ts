/**
 * Constants for site map views — stage colors, customer color palette, helpers.
 */

/** Pipeline stage hex colors (matches globals.css design tokens) */
export const STAGE_COLORS: Record<string, string> = {
  whitespace: "#D1D5DB",
  prospect: "#94A3B8",
  evaluation: "#8B5CF6",
  qualified: "#3B82F6",
  disqualified: "#EF4444",
  contracted: "#F59E0B",
  deployment: "#F97316",
  active: "#22C55E",
  paused: "#6B7280",
  hq: "#222222",
};

/** Human-readable labels for pipeline stages */
export const STAGE_LABELS: Record<string, string> = {
  whitespace: "Whitespace",
  prospect: "Prospect",
  evaluation: "Evaluation",
  qualified: "Qualified",
  disqualified: "Disqualified",
  contracted: "Contracted",
  deployment: "Deploying",
  active: "Active",
  paused: "Paused",
  hq: "Headquarters",
};

/** 12-color palette for customer differentiation */
const CUSTOMER_PALETTE = [
  "#2563EB", // blue
  "#DC2626", // red
  "#059669", // emerald
  "#7C3AED", // violet
  "#D97706", // amber
  "#0891B2", // cyan
  "#BE185D", // pink
  "#4F46E5", // indigo
  "#65A30D", // lime
  "#0D9488", // teal
  "#C2410C", // orange
  "#7C2D12", // brown
];

/** Deterministic color from customer ID (hash-based) */
export function getCustomerColor(customerId: string): string {
  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    hash = ((hash << 5) - hash + customerId.charCodeAt(i)) | 0;
  }
  return CUSTOMER_PALETTE[Math.abs(hash) % CUSTOMER_PALETTE.length]!;
}

/** Default map center: continental US */
export const DEFAULT_CENTER = { lat: 39.8, lng: -98.5 };
export const DEFAULT_ZOOM = 4;

/** Cluster circle sizes by marker count */
export const CLUSTER_SIZES = {
  small: { threshold: 10, size: 36 },
  medium: { threshold: 50, size: 44 },
  large: { threshold: Infinity, size: 52 },
} as const;
