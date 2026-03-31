"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createStakeholder, updateStakeholder } from "../../lib/actions/account-plan";
import { saveMeetingBrief, fetchMeetingBriefs, linkMeetingBrief } from "../../lib/actions";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import {
  Sparkles,
  Check,
  Loader2,
  UserPlus,
  Users,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Shield,
  Star,
  CircleDot,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { Stakeholder } from "./org-chart-node";

// ── Types ──────────────────────────────────────────────────────

interface ResearchedAttendee {
  name: string;
  email: string;
  title: string;
  department: string;
  seniority: "executive" | "senior" | "mid" | "junior" | "unknown";
  likely_concerns: string | null;
  reports_to_name: string | null;
  confidence: "high" | "medium" | "low";
  stakeholder_role_suggestion: string | null;
  matched_stakeholder_id: string | null;
  // UI state
  selected: boolean;
  added: boolean;
  updated: boolean;
}

interface SavedBrief {
  id: string;
  title: string;
  meeting_date: string | null;
  researched_attendees: any[];
  created_at: string;
}

interface MeetingPrepDialogProps {
  customerName: string;
  customerDomain: string | null;
  customerId: string;
  tenantId: string;
  accountPlanId: string;
  existingStakeholders: Stakeholder[];
  // External control for meeting-triggered mode
  externalOpen?: boolean;
  onExternalClose?: () => void;
  meetingContext?: {
    meetingId: string;
    title: string;
    meetingDate: string;
    attendees: Array<{ name: string; email: string }>;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────

const CK_DOMAINS = ["crossnokaye.com"];

function parseAttendees(text: string): Array<{ name: string; email: string }> {
  const results: Array<{ name: string; email: string }> = [];
  // Split by newlines or commas (but not commas inside quotes)
  const lines = text.split(/\n/).flatMap((line) => {
    // If a line has multiple email addresses separated by commas, split them
    const parts = line.split(/,(?=\s*"|\s*[A-Za-z]|\s*<)/);
    return parts.map((p) => p.trim()).filter(Boolean);
  });

  for (const line of lines) {
    if (!line.trim()) continue;

    // Pattern: "Last, First" <email> or "Name" <email>
    const quotedMatch = line.match(/"([^"]+)"\s*<([^>]+)>/);
    if (quotedMatch) {
      const rawName = quotedMatch[1]!.trim();
      const email = quotedMatch[2]!.trim().toLowerCase();
      // Handle "Last, First" format
      const name = rawName.includes(",")
        ? rawName.split(",").reverse().map((p) => p.trim()).join(" ")
        : rawName;
      results.push({ name, email });
      continue;
    }

    // Pattern: Name <email>
    const angleMatch = line.match(/^([^<]+)<([^>]+)>/);
    if (angleMatch) {
      const name = angleMatch[1]!.trim();
      const email = angleMatch[2]!.trim().toLowerCase();
      results.push({ name, email });
      continue;
    }

    // Pattern: bare email
    const emailMatch = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      const email = emailMatch[0].toLowerCase();
      // Derive name from email prefix
      const prefix = email.split("@")[0]!;
      const name = prefix
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      results.push({ name, email });
    }
  }

  return results;
}

function isCKEmail(email: string): boolean {
  return CK_DOMAINS.some((d) => email.toLowerCase().endsWith(`@${d}`));
}

const SENIORITY_COLORS: Record<string, string> = {
  executive: "bg-purple-100 text-purple-700",
  senior: "bg-blue-100 text-blue-700",
  mid: "bg-gray-100 text-gray-600",
  junior: "bg-gray-50 text-gray-500",
  unknown: "bg-gray-50 text-gray-400",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-green-500",
  medium: "text-amber-500",
  low: "text-gray-300",
};

const ROLE_LABELS: Record<string, string> = {
  champion: "Champion",
  decision_maker: "Decision Maker",
  influencer: "Influencer",
  user: "User",
  economic_buyer: "Economic Buyer",
};

/** Check if a matched stakeholder needs enrichment (missing title) */
function needsEnrichment(matchedId: string | null, stakeholders: Stakeholder[]): boolean {
  if (!matchedId) return false;
  const s = stakeholders.find((x) => x.id === matchedId);
  return s ? !s.title : false;
}

// ── Component ──────────────────────────────────────────────────

export function MeetingPrepDialog({
  customerName,
  customerDomain,
  customerId,
  tenantId,
  accountPlanId,
  existingStakeholders,
  externalOpen,
  onExternalClose,
  meetingContext,
}: MeetingPrepDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isExternallyControlled = externalOpen !== undefined;
  const isOpen = isExternallyControlled ? externalOpen : internalOpen;

  const [step, setStep] = useState<"input" | "loading" | "results">("input");

  // Input state
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [rawInput, setRawInput] = useState("");

  // Results state
  const [attendees, setAttendees] = useState<ResearchedAttendee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Past briefs
  const [pastBriefs, setPastBriefs] = useState<SavedBrief[]>([]);
  const [showPastBriefs, setShowPastBriefs] = useState(false);
  const [loadingBriefs, setLoadingBriefs] = useState(false);

  // Track meeting context attendee count for loading message
  const [contextAttendeeCount, setContextAttendeeCount] = useState(0);

  // Track whether we've auto-triggered research for this meeting context
  const autoTriggeredRef = useRef<string | null>(null);

  // Parse attendees from raw input on-the-fly
  const parsedAttendees = useMemo(() => {
    if (!rawInput.trim()) return [];
    const all = parseAttendees(rawInput);
    return all.filter((a) => !isCKEmail(a.email));
  }, [rawInput]);

  const ckAttendees = useMemo(() => {
    if (!rawInput.trim()) return [];
    return parseAttendees(rawInput).filter((a) => isCKEmail(a.email));
  }, [rawInput]);

  // Load past briefs when dialog opens
  useEffect(() => {
    if (isOpen && pastBriefs.length === 0) {
      setLoadingBriefs(true);
      fetchMeetingBriefs(customerId).then((result) => {
        if ("briefs" in result) {
          setPastBriefs(result.briefs);
        }
        setLoadingBriefs(false);
      });
    }
  }, [isOpen, customerId, pastBriefs.length]);

  // Auto-research when opened with meeting context
  useEffect(() => {
    if (isOpen && meetingContext && autoTriggeredRef.current !== meetingContext.meetingId) {
      autoTriggeredRef.current = meetingContext.meetingId;
      setTitle(meetingContext.title);
      setMeetingDate(meetingContext.meetingDate.split("T")[0] ?? "");
      const externalAttendees = meetingContext.attendees.filter((a) => !isCKEmail(a.email));
      if (externalAttendees.length > 0) {
        setContextAttendeeCount(externalAttendees.length);
        doResearch(externalAttendees);
      } else {
        // No external attendees — internal-only meeting
        setError("No external attendees found in this meeting. This appears to be an internal meeting.");
        setStep("results");
      }
    }
  }, [isOpen, meetingContext]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    if (isExternallyControlled) {
      onExternalClose?.();
    } else {
      setInternalOpen(false);
    }
    // Reset on close
    setTimeout(() => {
      setStep("input");
      setTitle("");
      setMeetingDate("");
      setRawInput("");
      setAttendees([]);
      setError(null);
      setSaved(false);
      setContextAttendeeCount(0);
      autoTriggeredRef.current = null;
    }, 200);
  }, [isExternallyControlled, onExternalClose]);

  /** Core research function — accepts explicit attendees or falls back to parsed input */
  const doResearch = useCallback(async (overrideAttendees?: Array<{ name: string; email: string }>) => {
    const toResearch = overrideAttendees || parsedAttendees;
    if (toResearch.length === 0) return;

    setStep("loading");
    setError(null);

    try {
      const res = await fetch("/api/ai/meeting-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          domain: customerDomain,
          attendees: toResearch,
          existingStakeholders: existingStakeholders.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to research attendees");
      }

      const { attendees: results } = await res.json();

      setAttendees(
        results.map((r: any) => ({
          ...r,
          selected: !r.matched_stakeholder_id,
          added: false,
          updated: false,
        }))
      );
      setStep("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStep("input");
    }
  }, [parsedAttendees, customerName, customerDomain, existingStakeholders]);

  const handleResearch = useCallback(() => doResearch(), [doResearch]);

  const toggleAttendee = useCallback((index: number) => {
    setAttendees((prev) =>
      prev.map((a, i) => {
        if (i !== index || a.added || a.updated) return a;
        // For matched stakeholders that need enrichment, allow toggle for update
        if (a.matched_stakeholder_id && needsEnrichment(a.matched_stakeholder_id, existingStakeholders)) {
          return { ...a, selected: !a.selected };
        }
        // For new (unmatched) stakeholders
        if (!a.matched_stakeholder_id) {
          return { ...a, selected: !a.selected };
        }
        // Fully enriched matched — no toggle
        return a;
      })
    );
  }, [existingStakeholders]);

  const handleAddToOrgChart = useCallback(async () => {
    const toAdd = attendees.filter((a) => a.selected && !a.added && !a.matched_stakeholder_id);
    if (toAdd.length === 0) return;

    setAdding(true);

    const nameToId: Record<string, string> = {};
    existingStakeholders.forEach((s) => {
      nameToId[s.name.toLowerCase()] = s.id;
    });

    for (const attendee of toAdd) {
      let reportsTo: string | null = null;
      if (attendee.reports_to_name) {
        reportsTo = nameToId[attendee.reports_to_name.toLowerCase()] || null;
      }

      const result = await createStakeholder(accountPlanId, tenantId, {
        name: attendee.name,
        title: attendee.title !== "Unknown" ? attendee.title : undefined,
        email: attendee.email || undefined,
        department: attendee.department !== "Unknown" ? attendee.department : undefined,
        stakeholder_role: attendee.stakeholder_role_suggestion || undefined,
        notes: attendee.likely_concerns || undefined,
        reports_to: reportsTo,
        is_ai_suggested: true,
      });

      if (result.success && result.id) {
        nameToId[attendee.name.toLowerCase()] = result.id;
      }
    }

    setAttendees((prev) =>
      prev.map((a) =>
        a.selected && !a.added && !a.matched_stakeholder_id
          ? { ...a, added: true, selected: false }
          : a
      )
    );
    setAdding(false);
  }, [attendees, existingStakeholders, accountPlanId, tenantId]);

  /** Update matched stakeholders that need enrichment */
  const handleUpdateInOrgChart = useCallback(async () => {
    const toUpdate = attendees.filter(
      (a) => a.selected && !a.updated && a.matched_stakeholder_id && needsEnrichment(a.matched_stakeholder_id, existingStakeholders)
    );
    if (toUpdate.length === 0) return;

    setUpdating(true);

    for (const attendee of toUpdate) {
      const existing = existingStakeholders.find((s) => s.id === attendee.matched_stakeholder_id);
      if (!existing) continue;

      // Only update fields that are currently empty on the existing record
      const updates: Record<string, string | boolean> = {};
      if (!existing.title && attendee.title && attendee.title !== "Unknown") updates.title = attendee.title;
      if (!existing.department && attendee.department && attendee.department !== "Unknown") updates.department = attendee.department;
      if (!existing.stakeholder_role && attendee.stakeholder_role_suggestion) updates.stakeholder_role = attendee.stakeholder_role_suggestion;
      if (!existing.notes && attendee.likely_concerns) updates.notes = attendee.likely_concerns;

      if (Object.keys(updates).length > 0) {
        await updateStakeholder(attendee.matched_stakeholder_id!, updates);
      }
    }

    setAttendees((prev) =>
      prev.map((a) =>
        a.selected && !a.updated && a.matched_stakeholder_id && needsEnrichment(a.matched_stakeholder_id, existingStakeholders)
          ? { ...a, updated: true, selected: false }
          : a
      )
    );
    setUpdating(false);
  }, [attendees, existingStakeholders]);

  const handleSaveBrief = useCallback(async () => {
    setSaving(true);
    const briefTitle = title || `${customerName} Meeting Prep`;
    const result = await saveMeetingBrief(
      customerId,
      tenantId,
      {
        title: briefTitle,
        meeting_date: meetingDate || null,
        raw_attendee_input: rawInput || (meetingContext?.attendees.map((a) => `${a.name} <${a.email}>`).join("\n") ?? ""),
        researched_attendees: attendees,
      }
    );

    if ("error" in result) {
      setError(result.error ?? "Failed to save brief");
    } else {
      setSaved(true);
      // Auto-link brief to meeting if triggered from a specific meeting
      if (meetingContext?.meetingId && result.id) {
        await linkMeetingBrief(meetingContext.meetingId, result.id);
      }
      // Add to past briefs list
      setPastBriefs((prev) => [
        {
          id: result.id!,
          title: briefTitle,
          meeting_date: meetingDate || null,
          researched_attendees: attendees,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setSaving(false);
  }, [title, meetingDate, rawInput, attendees, customerId, tenantId, customerName, meetingContext]);

  const handleLoadBrief = useCallback((brief: SavedBrief) => {
    setAttendees(
      brief.researched_attendees.map((a: any) => ({
        ...a,
        selected: false,
        added: false,
        updated: false,
      }))
    );
    setTitle(brief.title);
    setMeetingDate(brief.meeting_date || "");
    setStep("results");
    setShowPastBriefs(false);
  }, []);

  // Stats
  const selectedNewCount = attendees.filter((a) => a.selected && !a.added && !a.matched_stakeholder_id).length;
  const selectedUpdateCount = attendees.filter(
    (a) => a.selected && !a.updated && a.matched_stakeholder_id && needsEnrichment(a.matched_stakeholder_id, existingStakeholders)
  ).length;
  const matchedEnrichedCount = attendees.filter(
    (a) => a.matched_stakeholder_id && !needsEnrichment(a.matched_stakeholder_id, existingStakeholders)
  ).length;
  const matchedNeedsUpdateCount = attendees.filter(
    (a) => a.matched_stakeholder_id && needsEnrichment(a.matched_stakeholder_id, existingStakeholders) && !a.updated
  ).length;
  const addedCount = attendees.filter((a) => a.added).length;
  const updatedCount = attendees.filter((a) => a.updated).length;
  const newCount = attendees.filter((a) => !a.matched_stakeholder_id && !a.added).length;
  const loadingCount = contextAttendeeCount || parsedAttendees.length;

  // Group by department
  const groupedAttendees = useMemo(() => {
    const groups: Record<string, ResearchedAttendee[]> = {};
    for (const a of attendees) {
      const dept = a.department || "Unknown";
      if (!groups[dept]) groups[dept] = [];
      groups[dept]!.push(a);
    }
    // Sort departments: put executive/leadership first
    const sortOrder = ["Executive", "Operations", "Engineering", "IT", "Facilities", "Finance", "Sales"];
    return Object.entries(groups).sort(([a], [b]) => {
      const aIdx = sortOrder.indexOf(a);
      const bIdx = sortOrder.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [attendees]);

  return (
    <>
      {/* Trigger button — only for standalone (non-externally-controlled) mode */}
      {!isExternallyControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
        >
          <Users className="h-3 w-3" />
          Meeting Prep
        </button>
      )}

      {/* Dialog */}
      <Dialog open={isOpen} onClose={handleClose} className="max-w-3xl">
        <DialogHeader onClose={handleClose}>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Meeting Prep
            <span className="text-sm font-normal text-gray-400">
              {customerName}
            </span>
            {meetingContext && (
              <span className="text-xs font-normal text-purple-500">
                — {meetingContext.title}
              </span>
            )}
          </span>
        </DialogHeader>

        <DialogBody className="p-0">
          {/* Error banner */}
          {error && (
            <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Saved banner */}
          {saved && (
            <div className="mx-6 mt-4 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-700">
              Brief saved{meetingContext ? " and linked to meeting" : ""} successfully
            </div>
          )}

          {/* Step 1: Input */}
          {step === "input" && (
            <div className="px-6 py-5 space-y-4">
              {/* Title & date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`${customerName} Q1 Review`}
                    className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Attendee paste area */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Paste Attendee List
                </label>
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={`Paste email addresses from your calendar invite, e.g.:\n"Smith, John" <john.smith@company.com>,\nJane Doe <jane.doe@company.com>`}
                  rows={8}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono text-[12px]"
                />
              </div>

              {/* Parsed preview */}
              {rawInput.trim() && (
                <div className="text-xs text-gray-500 flex items-center gap-3">
                  <span>
                    <strong className="text-gray-700">{parsedAttendees.length}</strong> external attendee{parsedAttendees.length !== 1 ? "s" : ""} detected
                  </span>
                  {ckAttendees.length > 0 && (
                    <span className="text-gray-400">
                      {ckAttendees.length} CK team member{ckAttendees.length !== 1 ? "s" : ""} filtered out
                    </span>
                  )}
                </div>
              )}

              {/* Past briefs */}
              {pastBriefs.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <button
                    onClick={() => setShowPastBriefs(!showPastBriefs)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <Clock className="h-3 w-3" />
                    Past Briefs ({pastBriefs.length})
                    {showPastBriefs ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {showPastBriefs && (
                    <div className="mt-2 space-y-1">
                      {pastBriefs.map((brief) => (
                        <button
                          key={brief.id}
                          onClick={() => handleLoadBrief(brief)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left text-xs bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          <span className="font-medium text-gray-700">{brief.title}</span>
                          <span className="text-gray-400">
                            {brief.meeting_date || new Date(brief.created_at).toLocaleDateString()}
                            {" · "}
                            {brief.researched_attendees.length} attendees
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Loading */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  Researching {loadingCount} attendees at {customerName}...
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  This may take a moment while we search the web
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === "results" && attendees.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="px-6 py-2.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                <span>
                  <strong className="text-gray-700">{attendees.length}</strong> researched
                </span>
                {matchedEnrichedCount > 0 && (
                  <span className="text-green-600">
                    {matchedEnrichedCount} in org chart
                  </span>
                )}
                {matchedNeedsUpdateCount > 0 && (
                  <span className="text-amber-600">
                    {matchedNeedsUpdateCount} need enrichment
                  </span>
                )}
                {updatedCount > 0 && (
                  <span className="text-green-600">
                    {updatedCount} just updated
                  </span>
                )}
                {addedCount > 0 && (
                  <span className="text-green-600">
                    {addedCount} just added
                  </span>
                )}
                {newCount > 0 && (
                  <span>
                    {newCount} new
                  </span>
                )}
              </div>

              {/* Grouped attendee list */}
              <div className="max-h-[55vh] overflow-y-auto">
                {groupedAttendees.map(([department, members]) => (
                  <div key={department}>
                    {/* Department header */}
                    <div className="sticky top-0 px-6 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-white border-b border-gray-50">
                      {department} ({members.length})
                    </div>

                    {/* Attendee cards */}
                    {members.map((a) => {
                      const globalIdx = attendees.indexOf(a);
                      const isEnriched = a.matched_stakeholder_id && !needsEnrichment(a.matched_stakeholder_id, existingStakeholders);
                      const canUpdate = a.matched_stakeholder_id && needsEnrichment(a.matched_stakeholder_id, existingStakeholders) && !a.updated;
                      return (
                        <div
                          key={globalIdx}
                          className={cn(
                            "flex items-start gap-3 px-6 py-3 border-b border-gray-50 transition-colors",
                            a.added || a.updated
                              ? "bg-green-50/50 opacity-60"
                              : isEnriched
                              ? "bg-gray-50/50"
                              : canUpdate && a.selected
                              ? "bg-amber-50/30"
                              : a.selected
                              ? "bg-purple-50/30"
                              : "hover:bg-gray-50"
                          )}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleAttendee(globalIdx)}
                            disabled={!!isEnriched || a.added || a.updated}
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                              a.added || a.updated
                                ? "bg-green-100 border-green-300"
                                : isEnriched
                                ? "bg-green-100 border-green-300"
                                : canUpdate && a.selected
                                ? "bg-amber-500 border-amber-500"
                                : a.selected
                                ? "bg-purple-600 border-purple-600"
                                : "border-gray-300 hover:border-gray-400"
                            )}
                          >
                            {(a.selected || a.added || a.updated || isEnriched) && (
                              <Check
                                className={cn(
                                  "h-2.5 w-2.5",
                                  a.added || a.updated || isEnriched
                                    ? "text-green-600"
                                    : "text-white"
                                )}
                              />
                            )}
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">
                                {a.name}
                              </span>
                              {/* Seniority badge */}
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 text-[10px] font-medium rounded",
                                  SENIORITY_COLORS[a.seniority] || SENIORITY_COLORS.unknown
                                )}
                              >
                                {a.seniority === "unknown" ? "" : a.seniority.charAt(0).toUpperCase() + a.seniority.slice(1)}
                              </span>
                              {/* Confidence dot */}
                              <span title={`Confidence: ${a.confidence}`}>
                                <CircleDot
                                  className={cn("h-3 w-3", CONFIDENCE_COLORS[a.confidence])}
                                />
                              </span>
                              {/* Match status */}
                              {isEnriched && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-100 rounded">
                                  In org chart
                                </span>
                              )}
                              {canUpdate && !a.updated && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded">
                                  Update available
                                </span>
                              )}
                              {a.updated && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  Updated
                                </span>
                              )}
                              {a.added && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  Added
                                </span>
                              )}
                              {/* Suggested role */}
                              {a.stakeholder_role_suggestion && !isEnriched && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium text-purple-600 bg-purple-50 rounded">
                                  {ROLE_LABELS[a.stakeholder_role_suggestion] || a.stakeholder_role_suggestion}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {a.title !== "Unknown" ? a.title : ""}
                            </div>
                            {a.likely_concerns && (
                              <div className="text-[11px] text-gray-400 mt-1 italic leading-relaxed">
                                {a.likely_concerns}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Results empty state */}
          {step === "results" && attendees.length === 0 && !error && (
            <div className="py-12 text-center">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No attendee information found.
              </p>
              <button
                onClick={() => setStep("input")}
                className="mt-2 text-xs text-purple-600 hover:text-purple-800"
              >
                Try again
              </button>
            </div>
          )}
        </DialogBody>

        {/* Footer */}
        {step === "input" && (
          <DialogFooter>
            <div className="flex-1" />
            <button
              onClick={handleResearch}
              disabled={parsedAttendees.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Research {parsedAttendees.length > 0 ? `${parsedAttendees.length} ` : ""}Attendees
            </button>
          </DialogFooter>
        )}

        {step === "results" && attendees.length > 0 && (
          <DialogFooter className="justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const allSelectable = attendees.filter(
                    (a) => !a.added && !a.updated && (!a.matched_stakeholder_id || needsEnrichment(a.matched_stakeholder_id, existingStakeholders))
                  );
                  const allSelected = allSelectable.every((a) => a.selected);
                  setAttendees((prev) =>
                    prev.map((a) => {
                      if (a.added || a.updated) return a;
                      if (a.matched_stakeholder_id && !needsEnrichment(a.matched_stakeholder_id, existingStakeholders)) return a;
                      return { ...a, selected: !allSelected };
                    })
                  );
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {attendees.filter(
                  (a) => !a.added && !a.updated && (!a.matched_stakeholder_id || needsEnrichment(a.matched_stakeholder_id, existingStakeholders))
                ).every((a) => a.selected)
                  ? "Deselect all"
                  : "Select all"}
              </button>

              <button
                onClick={() => { setStep("input"); setAttendees([]); setSaved(false); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                New search
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!saved && (
                <button
                  onClick={handleSaveBrief}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CalendarDays className="h-3 w-3" />
                  )}
                  Save Brief
                </button>
              )}

              {selectedUpdateCount > 0 && (
                <button
                  onClick={handleUpdateInOrgChart}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {updating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" /> Update {selectedUpdateCount} in Org Chart
                    </>
                  )}
                </button>
              )}

              {selectedNewCount > 0 && (
                <button
                  onClick={handleAddToOrgChart}
                  disabled={selectedNewCount === 0 || adding}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {adding ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" /> Add {selectedNewCount} to Org Chart
                    </>
                  )}
                </button>
              )}
            </div>
          </DialogFooter>
        )}
      </Dialog>
    </>
  );
}
