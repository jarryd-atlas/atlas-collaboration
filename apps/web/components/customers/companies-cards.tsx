"use client";

import Link from "next/link";
import { CompanyTypeBadge, AccountStageBadge, DealStageBadge } from "../ui/badge";
import { Building2, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { CustomerListItem } from "../../lib/data/queries";

interface CompaniesCardsProps {
  customers: CustomerListItem[];
}

function formatCurrency(value: number | null): string {
  if (!value) return "";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toLocaleString()}`;
}

export function CompaniesCards({ customers }: CompaniesCardsProps) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No companies match your filters.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {customers.map((c) => (
        <Link
          key={c.slug}
          href={`/customers/${c.slug}`}
          className="group rounded-xl border border-gray-100 bg-white p-5 shadow-card hover:shadow-card-hover transition-shadow"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-gray-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-dark truncate">
                    {c.name}
                  </h3>
                </div>
                {c.domain && (
                  <p className="text-[10px] text-gray-400 truncate">{c.domain}</p>
                )}
              </div>
            </div>
            {c.open_issues > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
            )}
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <CompanyTypeBadge type={c.company_type ?? "customer"} />
            {c.account_stage && <AccountStageBadge stage={c.account_stage} />}
            {c.deal_stage && <DealStageBadge stage={c.deal_stage} />}
          </div>

          {/* Deal value */}
          {c.target_value && c.target_value > 0 && (
            <div className="mb-3">
              <span className="text-lg font-bold text-gray-900">{formatCurrency(c.target_value)}</span>
              <span className="text-xs text-gray-400 ml-1">target</span>
            </div>
          )}

          {/* Sites bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{c.active_sites} active / {c.total_sites} sites</span>
              {c.eval_sites > 0 && <span className="text-blue-500">{c.eval_sites} eval</span>}
            </div>
            {c.total_sites > 0 && (
              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-gray-100">
                {c.active_sites > 0 && (
                  <div className="bg-green-400" style={{ width: `${(c.active_sites / c.total_sites) * 100}%` }} />
                )}
                {c.deploying_sites > 0 && (
                  <div className="bg-amber-400" style={{ width: `${(c.deploying_sites / c.total_sites) * 100}%` }} />
                )}
                {c.eval_sites > 0 && (
                  <div className="bg-blue-400" style={{ width: `${(c.eval_sites / c.total_sites) * 100}%` }} />
                )}
              </div>
            )}
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <span>{c.open_tasks} tasks</span>
              {c.open_issues > 0 && (
                <span className="flex items-center gap-0.5 text-red-600 font-medium">
                  <AlertCircle className="h-3 w-3" /> {c.open_issues} issues
                </span>
              )}
              <span>{c.stakeholder_count} people</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-brand-green transition-colors" />
          </div>
        </Link>
      ))}
    </div>
  );
}
