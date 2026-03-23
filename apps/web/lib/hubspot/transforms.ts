/**
 * Value transforms for HubSpot ↔ App field mapping.
 * Each transform converts between HubSpot's string values and app's typed values.
 */

import { PIPELINE_STAGE_MAP, REVERSE_PIPELINE_STAGE_MAP } from "./constants";

// ─── Transform Registry ────────────────────────────────────

type TransformFn = {
  toApp: (hubspotValue: string | null) => string | number | null;
  toHubSpot: (appValue: unknown) => string;
};

const transforms: Record<string, TransformFn> = {
  text: {
    toApp: (v) => v ?? null,
    toHubSpot: (v) => String(v ?? ""),
  },

  number: {
    toApp: (v) => {
      if (v === null || v === "" || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    },
    toHubSpot: (v) => {
      if (v === null || v === undefined) return "";
      return String(v);
    },
  },

  /** HubSpot stores percentages as "60.92" meaning 60.92%, app stores as decimal 0.6092 */
  percentage: {
    toApp: (v) => {
      if (v === null || v === "" || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) ? null : n / 100;
    },
    toHubSpot: (v) => {
      if (v === null || v === undefined) return "";
      const n = Number(v);
      return isNaN(n) ? "" : String(n * 100);
    },
  },

  pipeline_stage_map: {
    toApp: (v) => {
      if (!v) return null;
      return PIPELINE_STAGE_MAP[v] ?? null;
    },
    toHubSpot: (v) => {
      if (!v) return "";
      return REVERSE_PIPELINE_STAGE_MAP[String(v)] ?? "";
    },
  },
};

// ─── Public API ────────────────────────────────────────────

/** Convert a HubSpot value to an app value using the named transform */
export function transformToApp(
  transformName: string | null,
  hubspotValue: string | null
): string | number | null {
  const fn = transforms[transformName ?? "text"];
  if (!fn) return hubspotValue;
  return fn.toApp(hubspotValue);
}

/** Convert an app value to a HubSpot string using the named transform */
export function transformToHubSpot(
  transformName: string | null,
  appValue: unknown
): string {
  const fn = transforms[transformName ?? "text"];
  if (!fn) return String(appValue ?? "");
  return fn.toHubSpot(appValue);
}
