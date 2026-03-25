/**
 * Maps raw CollectedField arrays from interview state into structured
 * section objects for the interview data panel display.
 */
import type { CollectedField } from "./interview-types";

// ─── Contacts ─────────────────────────────────────────
export interface MappedContact {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

// ─── Equipment ────────────────────────────────────────
export interface MappedEquipment {
  category: string;
  name?: string;
  manufacturer?: string;
  hp?: number;
  type?: string;
  loop?: string;
  quantity?: number;
  notes?: string;
}

// ─── Operational Params ───────────────────────────────
export interface MappedOperations {
  [key: string]: string | number | boolean | undefined;
}

// ─── Energy ───────────────────────────────────────────
export interface MappedEnergy {
  [key: string]: string | number | undefined;
}

// ─── Labor ────────────────────────────────────────────
export interface MappedLabor {
  role: string;
  count?: number;
  hoursPerWeek?: number;
  painPoints?: string;
}

// ─── Section Data ─────────────────────────────────────
export interface MappedSectionData {
  contacts: MappedContact[];
  equipment: MappedEquipment[];
  equipmentByCategory: Record<string, MappedEquipment[]>;
  operations: MappedOperations;
  operationsDetail: MappedOperations;
  energy: MappedEnergy;
  labor: MappedLabor[];
}

/**
 * Groups collected fields by their label into "records".
 * When fields come in batches (from a single save_ call), they share a timestamp proximity.
 * We detect records by finding "anchor" fields that start new records.
 */
function groupFieldsIntoRecords(fields: CollectedField[]): Record<string, string | number | boolean>[] {
  // Each save_ call produces multiple fields. Group them by looking for patterns.
  // Simple approach: collect all fields into key-value pairs.
  // For repeated entities (contacts, equipment), we need to detect boundaries.
  const records: Record<string, string | number | boolean>[] = [];
  let current: Record<string, string | number | boolean> = {};

  for (const f of fields) {
    const key = f.label.toLowerCase().replace(/\s+/g, "_");
    // If we see a key we've already set, start a new record
    if (key in current) {
      if (Object.keys(current).length > 0) records.push(current);
      current = {};
    }
    current[key] = f.value;
  }
  if (Object.keys(current).length > 0) records.push(current);

  return records;
}

export function mapCollectedFields(
  collectedFields: Record<string, CollectedField[]>,
): MappedSectionData {
  // ── Contacts ──
  const contactFields = collectedFields["site_contact"] ?? [];
  const contactRecords = groupFieldsIntoRecords(contactFields);
  const contacts: MappedContact[] = contactRecords.map((r) => ({
    name: String(r.name ?? r.contact_name ?? "Unknown"),
    title: r.title ? String(r.title) : undefined,
    email: r.email ? String(r.email) : undefined,
    phone: r.phone ? String(r.phone) : undefined,
    isPrimary: r.is_primary === true,
  }));

  // ── Equipment ──
  const equipFields = collectedFields["equipment"] ?? [];
  const equipRecords = groupFieldsIntoRecords(equipFields);
  const equipment: MappedEquipment[] = equipRecords.map((r) => ({
    category: String(r.category ?? "other"),
    name: r.name ? String(r.name) : undefined,
    manufacturer: r.manufacturer ? String(r.manufacturer) : undefined,
    hp: typeof r.hp === "number" ? r.hp : undefined,
    type: r.type ? String(r.type) : undefined,
    loop: r.loop ? String(r.loop) : undefined,
    quantity: typeof r.quantity === "number" ? r.quantity : undefined,
    notes: r.notes ? String(r.notes) : undefined,
  }));
  const equipmentByCategory: Record<string, MappedEquipment[]> = {};
  for (const e of equipment) {
    const cat = e.category;
    if (!equipmentByCategory[cat]) equipmentByCategory[cat] = [];
    equipmentByCategory[cat].push(e);
  }

  // ── Operations (from save_operational_params) ──
  const opsFields = collectedFields["operational_params"] ?? [];
  const operations: MappedOperations = {};
  for (const f of opsFields) {
    operations[f.label.toLowerCase().replace(/\s+/g, "_")] = f.value;
  }

  // ── Operations Detail (from save_operations_detail) ──
  const opsDetailFields = collectedFields["operations_detail"] ?? [];
  const operationsDetail: MappedOperations = {};
  for (const f of opsDetailFields) {
    operationsDetail[f.label.toLowerCase().replace(/\s+/g, "_")] = f.value;
  }

  // ── Energy ──
  const energyFields = collectedFields["energy_info"] ?? [];
  const energy: MappedEnergy = {};
  for (const f of energyFields) {
    energy[f.label.toLowerCase().replace(/\s+/g, "_")] = f.value as string | number;
  }

  // ── Labor ──
  const laborFields = collectedFields["labor_info"] ?? [];
  const laborRecords = groupFieldsIntoRecords(laborFields);
  const labor: MappedLabor[] = laborRecords.map((r) => ({
    role: String(r.role ?? "unknown"),
    count: typeof r.count === "number" ? r.count : undefined,
    hoursPerWeek: typeof r.hours_per_week === "number" ? r.hours_per_week : undefined,
    painPoints: r.pain_points ? String(r.pain_points) : undefined,
  }));

  return {
    contacts,
    equipment,
    equipmentByCategory,
    operations,
    operationsDetail,
    energy,
    labor,
  };
}
