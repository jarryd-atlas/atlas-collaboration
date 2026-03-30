"use client";

import { useState } from "react";
import { upsertEnterpriseDeal } from "../../lib/actions/account-plan";
import { cn } from "../../lib/utils";
import { DollarSign, Calendar, TrendingUp, Pencil, X, Check } from "lucide-react";

interface EnterpriseDeal {
  id: string;
  deal_name: string;
  target_value: number | null;
  deal_stage: string;
  target_close_date: string | null;
  notes: string | null;
}

interface EnterpriseDealCardProps {
  deal: EnterpriseDeal | null;
  customerId: string;
  tenantId: string;
  customerName: string;
}

const STAGE_COLORS: Record<string, string> = {
  identified: "bg-blue-50 text-blue-700",
  proposal: "bg-amber-50 text-amber-700",
  negotiation: "bg-purple-50 text-purple-700",
  closed_won: "bg-green-50 text-green-700",
  closed_lost: "bg-red-50 text-red-700",
};

const STAGE_LABELS: Record<string, string> = {
  identified: "Identified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export function EnterpriseDealCard({ deal, customerId, tenantId, customerName }: EnterpriseDealCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    deal_name: deal?.deal_name ?? `${customerName} Enterprise Agreement`,
    target_value: deal?.target_value?.toString() ?? "",
    deal_stage: deal?.deal_stage ?? "identified",
    target_close_date: deal?.target_close_date ?? "",
    notes: deal?.notes ?? "",
  });

  async function handleSave() {
    setSaving(true);
    await upsertEnterpriseDeal(customerId, tenantId, {
      deal_name: form.deal_name,
      target_value: form.target_value ? parseFloat(form.target_value) : undefined,
      deal_stage: form.deal_stage,
      target_close_date: form.target_close_date || null,
      notes: form.notes || undefined,
    });
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Enterprise Deal</h3>
          <div className="flex items-center gap-1">
            <button onClick={handleSave} disabled={saving} className="p-1.5 rounded-md hover:bg-green-50 text-green-600"><Check className="h-4 w-4" /></button>
            <button onClick={() => setEditing(false)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-gray-500 uppercase">Deal Name</label>
            <input value={form.deal_name} onChange={(e) => setForm({ ...form, deal_name: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Target Value</label>
            <input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} placeholder="$0" className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Stage</label>
            <select value={form.deal_stage} onChange={(e) => setForm({ ...form, deal_stage: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md">
              {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Target Close</label>
            <input type="date" value={form.target_close_date} onChange={(e) => setForm({ ...form, target_close_date: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Enterprise Deal</h3>
        <button onClick={() => setEditing(true)} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {deal ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{deal.deal_name}</p>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STAGE_COLORS[deal.deal_stage] ?? "bg-gray-100 text-gray-600")}>
              {STAGE_LABELS[deal.deal_stage] ?? deal.deal_stage}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {deal.target_value && (
              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${Number(deal.target_value).toLocaleString()}</span>
            )}
            {deal.target_close_date && (
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{deal.target_close_date}</span>
            )}
          </div>
          {deal.notes && <p className="text-xs text-gray-400">{deal.notes}</p>}
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="w-full py-3 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-600 transition-colors">
          + Set enterprise deal target
        </button>
      )}
    </div>
  );
}
