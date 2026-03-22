"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { addEnergyData } from "../../lib/actions/assessment";
import { Loader2 } from "lucide-react";

interface AddEnergyDataDialogProps {
  open: boolean;
  onClose: () => void;
  assessmentId: string;
  siteId: string;
  tenantId: string;
}

export function AddEnergyDataDialog({
  open,
  onClose,
  assessmentId,
  siteId,
  tenantId,
}: AddEnergyDataDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Core fields
  const [periodMonth, setPeriodMonth] = useState("");
  const [totalCharges, setTotalCharges] = useState("");
  const [totalKwh, setTotalKwh] = useState("");
  const [peakDemandKw, setPeakDemandKw] = useState("");

  // Charge breakdown
  const [supplyCharges, setSupplyCharges] = useState("");
  const [distributionCharges, setDistributionCharges] = useState("");
  const [salesTax, setSalesTax] = useState("");

  // TOU consumption breakdown
  const [onPeakKwh, setOnPeakKwh] = useState("");
  const [offPeakKwh, setOffPeakKwh] = useState("");
  const [shoulderKwh, setShoulderKwh] = useState("");
  const [superPeakKwh, setSuperPeakKwh] = useState("");

  // TOU demand breakdown
  const [onPeakDemandKw, setOnPeakDemandKw] = useState("");
  const [offPeakDemandKw, setOffPeakDemandKw] = useState("");

  // PLC values
  const [capacityPlcKw, setCapacityPlcKw] = useState("");
  const [transmissionPlcKw, setTransmissionPlcKw] = useState("");

  function resetForm() {
    setPeriodMonth("");
    setTotalCharges(""); setTotalKwh(""); setPeakDemandKw("");
    setSupplyCharges(""); setDistributionCharges(""); setSalesTax("");
    setOnPeakKwh(""); setOffPeakKwh(""); setShoulderKwh(""); setSuperPeakKwh("");
    setOnPeakDemandKw(""); setOffPeakDemandKw("");
    setCapacityPlcKw(""); setTransmissionPlcKw("");
    setError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!periodMonth) {
      setError("Month is required");
      return;
    }
    setSaving(true);
    setError("");

    const p = (v: string) => v ? parseFloat(v) : undefined;

    const result = await addEnergyData({
      assessmentId,
      siteId,
      tenantId,
      periodMonth: periodMonth + "-01", // YYYY-MM -> YYYY-MM-01
      totalCharges: p(totalCharges),
      totalKwh: p(totalKwh),
      peakDemandKw: p(peakDemandKw),
      supplyCharges: p(supplyCharges),
      distributionCharges: p(distributionCharges),
      salesTax: p(salesTax),
      onPeakKwh: p(onPeakKwh),
      offPeakKwh: p(offPeakKwh),
      shoulderKwh: p(shoulderKwh),
      superPeakKwh: p(superPeakKwh),
      onPeakDemandKw: p(onPeakDemandKw),
      offPeakDemandKw: p(offPeakDemandKw),
      capacityPlcKw: p(capacityPlcKw),
      transmissionPlcKw: p(transmissionPlcKw),
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      handleClose();
    }
  }

  const labelCls = "block text-xs font-medium text-gray-500 mb-1";
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400";

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-2xl">
      <DialogHeader onClose={handleClose}>Add Monthly Utility Data</DialogHeader>
      <DialogBody className="space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Month + totals */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Month</label>
            <input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Total Cost ($)</label>
            <input type="number" step="0.01" value={totalCharges} onChange={(e) => setTotalCharges(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Total kWh</label>
            <input type="number" value={totalKwh} onChange={(e) => setTotalKwh(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Peak Demand (kW)</label>
            <input type="number" step="0.1" value={peakDemandKw} onChange={(e) => setPeakDemandKw(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* TOU Consumption Breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
            TOU Consumption Breakdown
          </h4>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>On-Peak kWh</label>
              <input type="number" value={onPeakKwh} onChange={(e) => setOnPeakKwh(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Off-Peak kWh</label>
              <input type="number" value={offPeakKwh} onChange={(e) => setOffPeakKwh(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Shoulder kWh</label>
              <input type="number" value={shoulderKwh} onChange={(e) => setShoulderKwh(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Super-Peak kWh</label>
              <input type="number" value={superPeakKwh} onChange={(e) => setSuperPeakKwh(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* TOU Demand Breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
            TOU Demand
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>On-Peak Demand (kW)</label>
              <input type="number" step="0.1" value={onPeakDemandKw} onChange={(e) => setOnPeakDemandKw(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Off-Peak Demand (kW)</label>
              <input type="number" step="0.1" value={offPeakDemandKw} onChange={(e) => setOffPeakDemandKw(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Charge breakdown + PLC */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Charge Breakdown
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Supply Charges ($)</label>
              <input type="number" step="0.01" value={supplyCharges} onChange={(e) => setSupplyCharges(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Distribution Charges ($)</label>
              <input type="number" step="0.01" value={distributionCharges} onChange={(e) => setDistributionCharges(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sales Tax ($)</label>
              <input type="number" step="0.01" value={salesTax} onChange={(e) => setSalesTax(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* PLC values */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Capacity PLC (kW)</label>
            <input type="number" step="0.1" value={capacityPlcKw} onChange={(e) => setCapacityPlcKw(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Transmission PLC (kW)</label>
            <input type="number" step="0.1" value={transmissionPlcKw} onChange={(e) => setTransmissionPlcKw(e.target.value)} className={inputCls} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
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
          Add Month
        </button>
      </DialogFooter>
    </Dialog>
  );
}
