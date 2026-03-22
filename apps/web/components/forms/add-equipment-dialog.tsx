"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  COMPRESSOR_TYPES,
  CONDENSER_TYPES,
  EVAPORATOR_TYPES,
  VESSEL_TYPES,
  DEFROST_TYPES,
  REFRIGERATION_LOOPS,
  type EquipmentCategory,
} from "@repo/shared";
import { addEquipment } from "../../lib/actions/assessment";
import { Loader2 } from "lucide-react";

interface AddEquipmentDialogProps {
  open: boolean;
  onClose: () => void;
  assessmentId: string;
  siteId: string;
  tenantId: string;
  defaultCategory?: EquipmentCategory;
}

export function AddEquipmentDialog({
  open,
  onClose,
  assessmentId,
  siteId,
  tenantId,
  defaultCategory = "compressor",
}: AddEquipmentDialogProps) {
  const [category, setCategory] = useState<EquipmentCategory>(defaultCategory);
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Compressor fields
  const [compType, setCompType] = useState("screw");
  const [hp, setHp] = useState("");
  const [loop, setLoop] = useState("low");
  const [loadingSummer, setLoadingSummer] = useState("1.0");
  const [loadingShoulder, setLoadingShoulder] = useState("0.75");
  const [loadingWinter, setLoadingWinter] = useState("0.5");
  const [suctionPsig, setSuctionPsig] = useState("");
  const [dischargePsig, setDischargePsig] = useState("");
  const [vfdEquipped, setVfdEquipped] = useState(false);

  // Condenser fields
  const [condType, setCondType] = useState("evaporative");
  const [totalFans, setTotalFans] = useState("");
  const [totalHpFanPump, setTotalHpFanPump] = useState("");

  // Evaporator fields
  const [numUnits, setNumUnits] = useState("1");
  const [avgFanHp, setAvgFanHp] = useState("");
  const [defrostType, setDefrostType] = useState("electric");

  // Vessel fields
  const [vesselType, setVesselType] = useState("receiver");
  const [capacityGallons, setCapacityGallons] = useState("");
  const [pressureRating, setPressureRating] = useState("");

  // Other fields
  const [description, setDescription] = useState("");

  function resetForm() {
    setName("");
    setManufacturer("");
    setModel("");
    setHp("");
    setLoop("low");
    setLoadingSummer("1.0");
    setLoadingShoulder("0.75");
    setLoadingWinter("0.5");
    setSuctionPsig("");
    setDischargePsig("");
    setVfdEquipped(false);
    setCompType("screw");
    setCondType("evaporative");
    setTotalFans("");
    setTotalHpFanPump("");
    setNumUnits("1");
    setAvgFanHp("");
    setDefrostType("electric");
    setVesselType("receiver");
    setCapacityGallons("");
    setPressureRating("");
    setDescription("");
    setError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");

    let specs: Record<string, unknown> = {};

    if (category === "compressor") {
      specs = {
        type: compType,
        hp: parseFloat(hp) || 0,
        loop,
        loading_summer: parseFloat(loadingSummer) || 0,
        loading_shoulder: parseFloat(loadingShoulder) || 0,
        loading_winter: parseFloat(loadingWinter) || 0,
        suction_setpoint_psig: parseFloat(suctionPsig) || null,
        discharge_setpoint_psig: parseFloat(dischargePsig) || null,
        vfd_equipped: vfdEquipped,
      };
    } else if (category === "condenser") {
      specs = {
        type: condType,
        total_fans: parseInt(totalFans) || null,
        total_hp_fan_and_pump: parseFloat(totalHpFanPump) || 0,
        loading_summer: parseFloat(loadingSummer) || 0,
        loading_shoulder: parseFloat(loadingShoulder) || 0,
        loading_winter: parseFloat(loadingWinter) || 0,
      };
    } else if (category === "evaporator") {
      specs = {
        loop,
        num_units: parseInt(numUnits) || 1,
        avg_fan_hp: parseFloat(avgFanHp) || 0,
        loading_summer: parseFloat(loadingSummer) || 0,
        loading_shoulder: parseFloat(loadingShoulder) || 0,
        loading_winter: parseFloat(loadingWinter) || 0,
        defrost_type: defrostType,
      };
    } else if (category === "vessel") {
      specs = {
        type: vesselType,
        capacity_gallons: parseFloat(capacityGallons) || null,
        pressure_rating: parseFloat(pressureRating) || null,
      };
    } else {
      specs = {
        description: description || null,
        hp: parseFloat(hp) || null,
        loading_summer: parseFloat(loadingSummer) || 0,
        loading_shoulder: parseFloat(loadingShoulder) || 0,
        loading_winter: parseFloat(loadingWinter) || 0,
      };
    }

    const result = await addEquipment({
      assessmentId,
      siteId,
      tenantId,
      category,
      name: name || undefined,
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      quantity: category === "evaporator" ? parseInt(numUnits) || 1 : 1,
      specs,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      handleClose();
    }
  }

  // Update default category when dialog opens with new default
  if (open && category !== defaultCategory && !name) {
    setCategory(defaultCategory);
  }

  const labelCls = "block text-xs font-medium text-gray-500 mb-1";
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400";
  const selectCls = inputCls;

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-2xl">
      <DialogHeader onClose={handleClose}>Add {EQUIPMENT_CATEGORY_LABELS[category]?.slice(0, -1) ?? "Equipment"}</DialogHeader>
      <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Category selector */}
        <div>
          <label className={labelCls}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as EquipmentCategory)} className={selectCls}>
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{EQUIPMENT_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        {/* Common fields */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Name / ID</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. C-1" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Manufacturer</label>
            <input type="text" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. Frick" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Model</label>
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Category-specific fields */}
        {category === "compressor" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select value={compType} onChange={(e) => setCompType(e.target.value)} className={selectCls}>
                  {COMPRESSOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>HP</label>
                <input type="number" value={hp} onChange={(e) => setHp(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loop</label>
                <select value={loop} onChange={(e) => setLoop(e.target.value)} className={selectCls}>
                  {REFRIGERATION_LOOPS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Loading Summer (%)</label>
                <input type="number" step="0.01" value={loadingSummer} onChange={(e) => setLoadingSummer(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Shoulder (%)</label>
                <input type="number" step="0.01" value={loadingShoulder} onChange={(e) => setLoadingShoulder(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Winter (%)</label>
                <input type="number" step="0.01" value={loadingWinter} onChange={(e) => setLoadingWinter(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Suction (psig)</label>
                <input type="number" step="0.1" value={suctionPsig} onChange={(e) => setSuctionPsig(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Discharge (psig)</label>
                <input type="number" step="0.1" value={dischargePsig} onChange={(e) => setDischargePsig(e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={vfdEquipped} onChange={(e) => setVfdEquipped(e.target.checked)} className="rounded border-gray-300" />
                  VFD Equipped
                </label>
              </div>
            </div>
          </>
        )}

        {category === "condenser" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select value={condType} onChange={(e) => setCondType(e.target.value)} className={selectCls}>
                  {CONDENSER_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Total Fans</label>
                <input type="number" value={totalFans} onChange={(e) => setTotalFans(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Total HP (fan + pump)</label>
                <input type="number" step="0.1" value={totalHpFanPump} onChange={(e) => setTotalHpFanPump(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Loading Summer (%)</label>
                <input type="number" step="0.01" value={loadingSummer} onChange={(e) => setLoadingSummer(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Shoulder (%)</label>
                <input type="number" step="0.01" value={loadingShoulder} onChange={(e) => setLoadingShoulder(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Winter (%)</label>
                <input type="number" step="0.01" value={loadingWinter} onChange={(e) => setLoadingWinter(e.target.value)} className={inputCls} />
              </div>
            </div>
          </>
        )}

        {category === "evaporator" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Loop</label>
                <select value={loop} onChange={(e) => setLoop(e.target.value)} className={selectCls}>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Number of Units</label>
                <input type="number" value={numUnits} onChange={(e) => setNumUnits(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Avg Fan HP/unit</label>
                <input type="number" step="0.1" value={avgFanHp} onChange={(e) => setAvgFanHp(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Loading Summer (%)</label>
                <input type="number" step="0.01" value={loadingSummer} onChange={(e) => setLoadingSummer(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Shoulder (%)</label>
                <input type="number" step="0.01" value={loadingShoulder} onChange={(e) => setLoadingShoulder(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Winter (%)</label>
                <input type="number" step="0.01" value={loadingWinter} onChange={(e) => setLoadingWinter(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Defrost Type</label>
              <select value={defrostType} onChange={(e) => setDefrostType(e.target.value)} className={selectCls}>
                {DEFROST_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
          </>
        )}

        {category === "vessel" && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Vessel Type</label>
              <select value={vesselType} onChange={(e) => setVesselType(e.target.value)} className={selectCls}>
                {VESSEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Capacity (gal)</label>
              <input type="number" value={capacityGallons} onChange={(e) => setCapacityGallons(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Pressure Rating</label>
              <input type="number" value={pressureRating} onChange={(e) => setPressureRating(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        {(category === "vfd" || category === "pump" || category === "controls" || category === "other") && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>HP</label>
                <input type="number" step="0.1" value={hp} onChange={(e) => setHp(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Loading Summer (%)</label>
                <input type="number" step="0.01" value={loadingSummer} onChange={(e) => setLoadingSummer(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Shoulder (%)</label>
                <input type="number" step="0.01" value={loadingShoulder} onChange={(e) => setLoadingShoulder(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loading Winter (%)</label>
                <input type="number" step="0.01" value={loadingWinter} onChange={(e) => setLoadingWinter(e.target.value)} className={inputCls} />
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </DialogBody>
      <DialogFooter>
        <button type="button" onClick={handleClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Add Equipment
        </button>
      </DialogFooter>
    </Dialog>
  );
}
