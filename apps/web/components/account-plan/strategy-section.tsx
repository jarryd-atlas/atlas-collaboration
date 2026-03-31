"use client";

import { useState, useCallback } from "react";
import { upsertAccountPlan } from "../../lib/actions/account-plan";
import { Crosshair, Swords } from "lucide-react";

interface StrategySectionProps {
  customerId: string;
  tenantId: string;
  accountPlan: {
    strategy_notes: string | null;
    competitive_landscape: string | null;
  } | null;
}

const FIELDS = [
  { key: "strategy_notes", label: "Account Strategy", icon: Crosshair, placeholder: "What's the strategic approach for this account?" },
  { key: "competitive_landscape", label: "Competitive Landscape", icon: Swords, placeholder: "Who else is competing for this account?" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function StrategySection({ customerId, tenantId, accountPlan }: StrategySectionProps) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    strategy_notes: accountPlan?.strategy_notes ?? "",
    competitive_landscape: accountPlan?.competitive_landscape ?? "",
  });
  const [editingField, setEditingField] = useState<FieldKey | null>(null);

  const handleBlur = useCallback(async (field: FieldKey) => {
    setEditingField(null);
    await upsertAccountPlan(customerId, tenantId, { [field]: values[field] || null });
  }, [customerId, tenantId, values]);

  return (
    <div className="space-y-3">
      {FIELDS.map((f) => {
        const Icon = f.icon;
        const isEditing = editingField === f.key;
        return (
          <div key={f.key} className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-3.5 w-3.5 text-gray-400" />
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">{f.label}</h4>
            </div>
            {isEditing ? (
              <textarea
                autoFocus
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                onBlur={() => handleBlur(f.key)}
                className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-200 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-brand-green"
                placeholder={f.placeholder}
              />
            ) : (
              <div
                onClick={() => setEditingField(f.key)}
                className="min-h-[40px] px-3 py-2 text-sm text-gray-600 rounded-md hover:bg-gray-50 cursor-text whitespace-pre-wrap"
              >
                {values[f.key] || <span className="text-gray-300 italic">{f.placeholder}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
