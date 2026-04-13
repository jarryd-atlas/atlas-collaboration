"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type SubTab = "internal" | "customer_form";

interface BaselineTabWrapperProps {
  internalView: ReactNode;
  siteId: string;
  tenantId: string;
  assessmentId: string | undefined;
}

export function BaselineTabWrapper({
  internalView,
  siteId,
  tenantId,
  assessmentId,
}: BaselineTabWrapperProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("internal");
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCustomerForm() {
    if (formUrl) {
      setActiveSubTab("customer_form");
      return;
    }
    if (!assessmentId) return;

    setLoading(true);
    setActiveSubTab("customer_form");

    try {
      const { generateBaselineFormLink } = await import("../../lib/actions/baseline-form");
      const result = await generateBaselineFormLink(siteId, tenantId, assessmentId);
      if (result.token) {
        setFormUrl(`${window.location.origin}/b/${result.token}`);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  return (
    <div>
      {/* Subtab bar */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setActiveSubTab("internal")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeSubTab === "internal"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Internal View
        </button>
        {assessmentId && (
          <button
            onClick={loadCustomerForm}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeSubTab === "customer_form"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Customer Baseline Form
          </button>
        )}
      </div>

      {/* Content */}
      {activeSubTab === "internal" ? (
        internalView
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-2">
                <div className="h-6 w-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500">Loading customer form...</p>
              </div>
            </div>
          ) : formUrl ? (
            <iframe
              src={formUrl}
              className="w-full border-0"
              style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
              title="Customer Baseline Form"
            />
          ) : (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">
                Unable to load the customer baseline form.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
