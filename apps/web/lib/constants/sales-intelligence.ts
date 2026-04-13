// ─── Persona Types ───────────────────────────────────────────

export const PERSONA_TYPES = [
  { key: "engineering_leader", label: "Engineering Leader" },
  { key: "sustainability_leader", label: "Sustainability & Energy Leader" },
  { key: "fmm", label: "Facility Maintenance Manager" },
] as const;

export const PERSONA_COLORS: Record<string, string> = {
  engineering_leader: "bg-indigo-100 text-indigo-700",
  sustainability_leader: "bg-teal-100 text-teal-700",
  fmm: "bg-orange-100 text-orange-700",
};

export const PERSONA_LABELS: Record<string, string> = {
  engineering_leader: "Engineering Leader",
  sustainability_leader: "Sustainability Leader",
  fmm: "FMM",
};

// ─── Buying Trigger Catalog ──────────────────────────────────

export const BUYING_TRIGGERS = [
  // Engineering Leader
  { key: "visibility_gaps", label: "Lack of visibility across portfolio", persona: "engineering_leader" },
  { key: "energy_demand_spikes", label: "Energy spend or demand charge spikes", persona: "engineering_leader" },
  { key: "compliance_miss", label: "Compliance miss, repeat outage, or failed audit", persona: "engineering_leader" },
  { key: "modernization_funding", label: "Modernization funding available (M&A, exec push)", persona: "engineering_leader" },
  { key: "peer_results", label: "Peer / competitor results create urgency", persona: "engineering_leader" },
  { key: "unsupported_systems", label: "End-of-life / unsupported control systems", persona: "engineering_leader" },
  // Sustainability & Energy Leader
  { key: "energy_cost_spike", label: "Energy cost spike (regional rate increase)", persona: "sustainability_leader" },
  { key: "peer_validation", label: "Peer validation (similar operations rolling out)", persona: "sustainability_leader" },
  { key: "capex_cycle", label: "CapEx planning cycle opening", persona: "sustainability_leader" },
  { key: "digitization_push", label: "Corporate push for digitization & data-driven decisions", persona: "sustainability_leader" },
  { key: "esg_mandates", label: "ESG goals or compliance pressure", persona: "sustainability_leader" },
  { key: "utility_incentives", label: "Utility incentives or rebate windows", persona: "sustainability_leader" },
  // Facility Maintenance Manager
  { key: "equipment_failure", label: "Major equipment failure or ammonia incident", persona: "fmm" },
  { key: "audit_failure", label: "Audit failure or regulatory near-miss (PSM)", persona: "fmm" },
  { key: "fmm_energy_spikes", label: "Energy cost spikes or sustainability mandates", persona: "fmm" },
  { key: "peak_season", label: "Peak season approaching (holiday / harvest)", persona: "fmm" },
  { key: "budget_window", label: "Budget cycle / CapEx window (Q1 planning, Q4 use-it-or-lose-it)", persona: "fmm" },
] as const;

// ─── Objection Catalog ───────────────────────────────────────

export const OBJECTIONS = [
  { key: "unclear_roi", label: "Unclear ROI or savings don't materialize" },
  { key: "saas_fee_pushback", label: "SaaS fee and ongoing cost pushback" },
  { key: "operator_resistance", label: "Operator resistance to change" },
  { key: "downtime_risk", label: "Uptime risk during deployment" },
  { key: "it_ot_security", label: "IT/OT security concerns (AWS / cloud hosting)" },
  { key: "ai_job_fears", label: "Operators fear AI taking their jobs" },
  { key: "supplier_credibility", label: "Supplier credibility doubts (new vendor)" },
  { key: "manager_support", label: "Lack of manager support at site" },
] as const;

// ─── Initiative Categories ───────────────────────────────────

export const INITIATIVE_CATEGORIES = [
  { key: "sales_pursuit", label: "Sales Pursuit" },
  { key: "implementation", label: "Implementation" },
  { key: "summit_prep", label: "Summit / Event Prep" },
  { key: "optimization", label: "Optimization" },
  { key: "support", label: "Support / Issue Resolution" },
  { key: "expansion", label: "Expansion" },
  { key: "other", label: "Other" },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  sales_pursuit: "bg-blue-100 text-blue-700",
  implementation: "bg-purple-100 text-purple-700",
  summit_prep: "bg-amber-100 text-amber-700",
  optimization: "bg-green-100 text-green-700",
  support: "bg-red-100 text-red-700",
  expansion: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  INITIATIVE_CATEGORIES.map((c) => [c.key, c.label])
);
