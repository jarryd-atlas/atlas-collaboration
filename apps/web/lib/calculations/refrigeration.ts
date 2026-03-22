/**
 * Refrigeration load calculations matching the CK assessment spreadsheet.
 * All formulas derived from the Americold Perryville assessment model.
 */

import { HP_TO_KW } from "@repo/shared";

// ═══════════════════════════════════════════════════════════════
// Equipment kW/kWh Calculations
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate average kW for a piece of equipment based on HP and seasonal loading.
 * Formula: HP × 0.7457 × (summer×4/12 + shoulder×4/12 + winter×4/12)
 * For evaporators, multiply result by quantity (num_units).
 */
export function calcAvgKw(
  hp: number,
  loadingSummer: number,
  loadingShoulder: number,
  loadingWinter: number,
  quantity: number = 1,
): number {
  const avgKw =
    hp * HP_TO_KW * (
      (loadingSummer * 4) / 12 +
      (loadingShoulder * 4) / 12 +
      (loadingWinter * 4) / 12
    );
  return avgKw * quantity;
}

/**
 * Calculate annual kWh from average kW and operational parameters.
 * Formula: (annual_ops_hours × avg_kw × load_factor) + ((8760 - annual_ops_hours) × off_ops_use × avg_kw)
 */
export function calcAvgKwh(
  avgKw: number,
  annualOpsHours: number,
  loadFactor: number = 1.0,
  offOpsEnergyUse: number = 0.5,
): number {
  return (annualOpsHours * avgKw * loadFactor) +
    ((8760 - annualOpsHours) * offOpsEnergyUse * avgKw);
}

/**
 * Calculate annual operational hours.
 * Formula: days_per_week × hours_per_day × 52
 */
export function calcAnnualOpsHours(
  daysPerWeek: number,
  hoursPerDay: number,
): number {
  return daysPerWeek * hoursPerDay * 52;
}

// ═══════════════════════════════════════════════════════════════
// Load Breakdown Calculations
// ═══════════════════════════════════════════════════════════════

export interface EquipmentWithCalcs {
  category: string;
  specs: Record<string, unknown>;
  quantity: number;
  avgKw: number;
  avgKwh: number;
}

export interface LoadBreakdown {
  totalRefrigKw: number;
  totalRefrigKwh: number;
  lowCompressorKw: number;
  lowCompressorKwh: number;
  highCompressorKw: number;
  highCompressorKwh: number;
  sheddableEvaporatorKw: number;
  sheddableEvaporatorKwh: number;
  condenserKw: number;
  condenserKwh: number;
  blastKw: number;
  blastKwh: number;
  pctKwDemand: number;
  pctKwhUsage: number;
  pctOfBuilding: number;
}

/**
 * Calculate the full load breakdown from equipment data.
 * Matches the "Refrigeration System Load Breakdown" section of the spreadsheet.
 */
export function calcLoadBreakdown(
  equipment: EquipmentWithCalcs[],
  avgPeakDemandKw: number,
  totalAnnualKwh: number,
): LoadBreakdown {
  let totalRefrigKw = 0;
  let totalRefrigKwh = 0;
  let lowCompressorKw = 0;
  let lowCompressorKwh = 0;
  let highCompressorKw = 0;
  let highCompressorKwh = 0;
  let sheddableEvaporatorKw = 0;
  let sheddableEvaporatorKwh = 0;
  let condenserKw = 0;
  let condenserKwh = 0;
  let blastKw = 0;
  let blastKwh = 0;

  for (const eq of equipment) {
    totalRefrigKw += eq.avgKw;
    totalRefrigKwh += eq.avgKwh;

    if (eq.category === "compressor") {
      const loop = (eq.specs as { loop?: string }).loop;
      if (loop === "low") {
        lowCompressorKw += eq.avgKw;
        lowCompressorKwh += eq.avgKwh;
      } else if (loop === "high") {
        highCompressorKw += eq.avgKw;
        highCompressorKwh += eq.avgKwh;
      } else if (loop === "blast") {
        blastKw += eq.avgKw;
        blastKwh += eq.avgKwh;
      }
    } else if (eq.category === "condenser") {
      condenserKw += eq.avgKw;
      condenserKwh += eq.avgKwh;
    } else if (eq.category === "evaporator") {
      // Sheddable = 50% of high loop evaps + 100% of low loop evaps
      const loop = (eq.specs as { loop?: string }).loop;
      if (loop === "high") {
        sheddableEvaporatorKw += eq.avgKw * 0.5;
        sheddableEvaporatorKwh += eq.avgKwh * 0.5;
      } else if (loop === "low") {
        sheddableEvaporatorKw += eq.avgKw;
        sheddableEvaporatorKwh += eq.avgKwh;
      }
    }
  }

  const pctKwDemand = avgPeakDemandKw > 0 ? totalRefrigKw / avgPeakDemandKw : 0;
  const pctKwhUsage = totalAnnualKwh > 0 ? totalRefrigKwh / totalAnnualKwh : 0;
  const pctOfBuilding = (pctKwDemand + pctKwhUsage) / 2;

  return {
    totalRefrigKw,
    totalRefrigKwh,
    lowCompressorKw,
    lowCompressorKwh,
    highCompressorKw,
    highCompressorKwh,
    sheddableEvaporatorKw,
    sheddableEvaporatorKwh,
    condenserKw,
    condenserKwh,
    blastKw,
    blastKwh,
    pctKwDemand,
    pctKwhUsage,
    pctOfBuilding,
  };
}

// ═══════════════════════════════════════════════════════════════
// ARCO / COP Calculations
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate isentropic efficiency from suction/discharge pressures.
 * Formula: min(0.78, 1 / (1 + factor × ((discharge + 14.7) / (suction + 14.7) - 1)))
 * Factor is 0.045 for low side, 0.1 for high side.
 */
export function calcIsentropicEfficiency(
  suctionPsig: number,
  dischargePsig: number,
  side: "low" | "high" | "blast" = "low",
): number {
  if (suctionPsig === 0 && dischargePsig === 0) return 0.78;
  const factor = side === "high" ? 0.1 : 0.045;
  const ratio = (dischargePsig + 14.7) / (suctionPsig + 14.7);
  const eff = 1 / (1 + factor * (ratio - 1));
  return Math.min(0.78, eff);
}

/**
 * Calculate COP from isentropic efficiency using ammonia lookup approximation.
 * This is a simplified version — the full spreadsheet uses a detailed COP lookup table.
 */
export function calcCop(
  suctionPsig: number,
  dischargePsig: number,
  isentropicEff: number,
): number {
  if (suctionPsig === 0 && dischargePsig === 0) return 1;
  // Carnot COP approximation for ammonia
  const suctionTempR = suctionPsig * 0.8 + 460 + 28; // rough psig→R for ammonia
  const dischargeTempR = dischargePsig * 0.5 + 460 + 86;
  if (dischargeTempR <= suctionTempR) return 1;
  const carnotCop = suctionTempR / (dischargeTempR - suctionTempR);
  return carnotCop * isentropicEff;
}

/**
 * Calculate compressor kW per ton of refrigeration.
 * Formula: (1 / weighted_COP) / 0.284345
 * 0.284345 converts kW/ton to the correct units.
 */
export function calcKwPerTr(
  weightedCop: number,
): number {
  if (weightedCop <= 0) return 0;
  return (1 / weightedCop) / 0.284345;
}

/**
 * Calculate ARCO compressor savings percentage.
 * Formula: (pre_kw_per_tr - post_kw_per_tr) / pre_kw_per_tr
 */
export function calcArcoSavingsPct(
  preKwPerTr: number,
  postKwPerTr: number,
): number {
  if (preKwPerTr <= 0) return 0;
  return (preKwPerTr - postKwPerTr) / preKwPerTr;
}

// ═══════════════════════════════════════════════════════════════
// Formatting Helpers
// ═══════════════════════════════════════════════════════════════

export function formatKw(kw: number): string {
  return kw.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatKwh(kwh: number): string {
  return kwh.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatPct(pct: number): string {
  return (pct * 100).toFixed(1) + "%";
}
