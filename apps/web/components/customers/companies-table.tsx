"use client";

import Link from "next/link";
import { CompanyTypeBadge, AccountStageBadge, DealStageBadge } from "../ui/badge";
import { AlertCircle, Users, Target, Calendar } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/format";
import type { CustomerListItem } from "../../lib/data/queries";

interface CompaniesTableProps {
  customers: CustomerListItem[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function isOverdue(dateStr: string | null, dealStage: string | null): boolean {
  if (!dateStr || !dealStage) return false;
  if (dealStage === "closed_won" || dealStage === "closed_lost") return false;
  return new Date(dateStr + "T00:00:00") < new Date();
}

export function CompaniesTable({ customers }: CompaniesTableProps) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No companies match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Company</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Stage</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Deal Value</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Deal Stage</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Close Date</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sites</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tasks / Issues</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">People</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Success Plan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {customers.map((c) => {
            const overdue = isOverdue(c.target_close_date, c.deal_stage);
            const hasIssues = c.open_issues > 0;

            return (
              <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                {/* Company */}
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    <div className="flex items-center gap-2">
                      {hasIssues && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Has open issues" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 group-hover:text-brand-dark truncate">
                            {c.name}
                          </span>
                          <CompanyTypeBadge type={c.company_type ?? "customer"} />
                        </div>
                        {c.domain && (
                          <p className="text-[10px] text-gray-400 truncate">{c.domain}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </td>

                {/* Account Stage */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    {c.account_stage ? (
                      <AccountStageBadge stage={c.account_stage} />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </Link>
                </td>

                {/* Deal Value */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    <span className={cn("text-sm font-medium", c.target_value ? "text-gray-900" : "text-gray-300")}>
                      {formatCurrency(c.target_value)}
                    </span>
                  </Link>
                </td>

                {/* Deal Stage */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    {c.deal_stage ? (
                      <DealStageBadge stage={c.deal_stage} />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </Link>
                </td>

                {/* Close Date */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    <span className={cn("text-xs", overdue ? "text-red-600 font-medium" : "text-gray-500")}>
                      {formatDate(c.target_close_date)}
                      {overdue && <span className="ml-1 text-[10px]">⚠</span>}
                    </span>
                  </Link>
                </td>

                {/* Sites */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">
                        {c.active_sites} <span className="text-gray-400">/ {c.total_sites}</span>
                      </span>
                      {c.total_sites > 0 && (
                        <div className="flex h-1.5 w-12 rounded-full overflow-hidden bg-gray-100">
                          {c.active_sites > 0 && (
                            <div
                              className="bg-green-400 rounded-full"
                              style={{ width: `${(c.active_sites / c.total_sites) * 100}%` }}
                            />
                          )}
                          {c.deploying_sites > 0 && (
                            <div
                              className="bg-amber-400"
                              style={{ width: `${(c.deploying_sites / c.total_sites) * 100}%` }}
                            />
                          )}
                          {c.eval_sites > 0 && (
                            <div
                              className="bg-blue-400"
                              style={{ width: `${(c.eval_sites / c.total_sites) * 100}%` }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                </td>

                {/* Tasks / Issues */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">{c.open_tasks} tasks</span>
                      {c.open_issues > 0 && (
                        <span className="flex items-center gap-0.5 text-red-600 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          {c.open_issues}
                        </span>
                      )}
                    </div>
                  </Link>
                </td>

                {/* People */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="h-3 w-3 text-gray-400" />
                      {c.stakeholder_count}
                    </div>
                  </Link>
                </td>

                {/* Success Plan */}
                <td className="px-3 py-3">
                  <Link href={`/customers/${c.slug}`} className="block">
                    <div className="text-[11px] text-gray-500 space-y-0.5">
                      {c.goals_total > 0 ? (
                        <div className="flex items-center gap-1">
                          <Target className="h-2.5 w-2.5 text-gray-400" />
                          <span>{c.goals_achieved}/{c.goals_total} goals</span>
                        </div>
                      ) : null}
                      {c.milestones_total > 0 ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5 text-gray-400" />
                          <span>{c.milestones_completed}/{c.milestones_total} milestones</span>
                        </div>
                      ) : null}
                      {c.goals_total === 0 && c.milestones_total === 0 && (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
