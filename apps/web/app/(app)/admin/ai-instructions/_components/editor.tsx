"use client";

import { useState } from "react";
import { Button } from "../../../../../components/ui/button";
import { Sparkles, RotateCcw, Save, Check } from "lucide-react";
import { saveCategoryInstructions } from "../../../../../lib/actions/ai-instructions";

interface CategoryItem {
  key: string;
  label: string;
  instructions: string;
  isActive: boolean;
  id: string | null;
  isDefault: boolean;
}

export function AIInstructionsEditor({
  categories,
  tenantId,
  defaults,
}: {
  categories: CategoryItem[];
  tenantId: string;
  defaults: Record<string, string>;
}) {
  const [items, setItems] = useState(categories);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  function updateInstructions(key: string, value: string) {
    setItems((prev) => prev.map((c) => (c.key === key ? { ...c, instructions: value, isDefault: false } : c)));
  }

  function resetToDefault(key: string) {
    const def = defaults[key] ?? "";
    setItems((prev) => prev.map((c) => (c.key === key ? { ...c, instructions: def } : c)));
  }

  async function handleSave(key: string) {
    const item = items.find((c) => c.key === key);
    if (!item) return;
    setSavingKey(key);
    await saveCategoryInstructions(tenantId, key, item.instructions);
    setSavingKey(null);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  return (
    <div className="space-y-6">
      {items.map((cat) => (
        <div key={cat.key} className="border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h3 className="font-semibold text-gray-900">{cat.label}</h3>
              {cat.isDefault && (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Default</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => resetToDefault(cat.key)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                title="Reset to default"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
              <Button
                size="sm"
                onClick={() => handleSave(cat.key)}
                disabled={savingKey === cat.key}
              >
                {savedKey === cat.key ? (
                  <><Check className="h-3.5 w-3.5 mr-1" /> Saved</>
                ) : savingKey === cat.key ? (
                  "Saving..."
                ) : (
                  <><Save className="h-3.5 w-3.5 mr-1" /> Save</>
                )}
              </Button>
            </div>
          </div>
          <textarea
            value={cat.instructions}
            onChange={(e) => updateInstructions(cat.key, e.target.value)}
            rows={4}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 resize-y"
            placeholder="Enter instructions for Claude when analyzing documents in this category..."
          />
        </div>
      ))}
    </div>
  );
}
