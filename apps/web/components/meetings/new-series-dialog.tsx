"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Avatar } from "../ui/avatar";
import { CustomerSearch } from "../ui/customer-search";
import { createMeetingSeries } from "../../lib/actions/meetings";
import { Search, Check, Users, User, Building2, X } from "lucide-react";

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface NewSeriesDialogProps {
  open: boolean;
  onClose: () => void;
  teamMembers: TeamMember[];
  currentUserId: string;
}

type MeetingType = "standup" | "one_on_one" | "account_360";
type Cadence = "weekly" | "biweekly" | "monthly";

const TYPE_OPTIONS: { value: MeetingType; label: string; description: string; icon: any }[] = [
  {
    value: "standup",
    label: "Standup",
    description: "Recurring team sync across customers",
    icon: Users,
  },
  {
    value: "one_on_one",
    label: "1:1",
    description: "Private check-in between two people",
    icon: User,
  },
  {
    value: "account_360",
    label: "Account 360",
    description: "Cross-team sync on a specific customer",
    icon: Building2,
  },
];

export function NewSeriesDialog({ open, onClose, teamMembers, currentUserId }: NewSeriesDialogProps) {
  const router = useRouter();
  const [type, setType] = useState<MeetingType>("standup");
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customer, setCustomer] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  // For standup / 1:1, hide the current user (they're auto-added as participant).
  // For account_360, show everyone — "leads" is an explicit opt-in list.
  const availableMembers =
    type === "account_360"
      ? teamMembers
      : teamMembers.filter((m) => m.id !== currentUserId);

  const filteredMembers = search
    ? availableMembers.filter(
        (m) =>
          m.fullName.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
    : availableMembers;

  const selectedMembers = teamMembers.filter((m) => selectedIds.has(m.id));

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetAndClose = () => {
    onClose();
    setType("standup");
    setTitle("");
    setSelectedIds(new Set());
    setCustomer(null);
    setCadence("weekly");
    setSearch("");
    setError("");
  };

  const handleTypeChange = (next: MeetingType) => {
    setType(next);
    setError("");
    // If user hasn't typed a title yet, suggest one based on the type
    if (!title.trim() && next === "account_360" && customer) {
      setTitle(`${customer.name} — Account 360`);
    }
  };

  const handleCustomerSelect = (c: { id: string; name: string; slug: string }) => {
    setCustomer(c);
    if (!title.trim() || title.endsWith(" — Account 360")) {
      setTitle(`${c.name} — Account 360`);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (type === "account_360") {
      if (!customer) {
        setError("Select a customer");
        return;
      }
    } else {
      if (selectedIds.size === 0) {
        setError("Select at least one team member");
        return;
      }
    }
    setError("");

    startTransition(async () => {
      const result = await createMeetingSeries(
        title.trim(),
        type,
        [...selectedIds],
        type === "account_360"
          ? { customerId: customer?.id ?? null, cadence }
          : undefined,
      );
      if ("error" in result) {
        setError(result.error);
      } else {
        resetAndClose();
        router.push(`/meetings/${result.id}`);
      }
    });
  };

  const headerLabel =
    type === "account_360" ? "New Account 360" : type === "one_on_one" ? "New 1:1" : "New Standup";
  const createLabel =
    type === "account_360" ? "Create Account 360" : type === "one_on_one" ? "Create 1:1" : "Create Standup";

  return (
    <Dialog open={open} onClose={resetAndClose}>
      <DialogHeader onClose={resetAndClose}>{headerLabel}</DialogHeader>
      <DialogBody className="space-y-4">
        {/* Type picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Meeting type</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleTypeChange(opt.value)}
                  className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-brand-green bg-brand-green/5"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-brand-green" : "text-gray-400"}`} />
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  <span className="text-[10px] text-gray-500 leading-tight">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer picker (Account 360 only) */}
        {type === "account_360" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            {customer ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{customer.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomer(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
            ) : (
              <CustomerSearch onSelect={handleCustomerSelect} placeholder="Search customers..." />
            )}
          </div>
        )}

        {/* Cadence (Account 360 only) */}
        {type === "account_360" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cadence</label>
            <div className="flex gap-2">
              {(["weekly", "biweekly", "monthly"] as Cadence[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCadence(c)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    cadence === c
                      ? "border-brand-green bg-brand-green/5 text-gray-900"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="series-title" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="series-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === "account_360"
                ? "e.g., Americold — Account 360"
                : type === "one_on_one"
                  ? "e.g., Alex × Jamie"
                  : "e.g., Sales Team Weekly"
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
          />
        </div>

        {/* Participants / Leads */}
        <div ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {type === "account_360" ? "Leads" : "Participants"}
          </label>
          {type === "account_360" && (
            <p className="text-[11px] text-gray-400 mb-2">
              Anyone at CrossnoKaye can view and edit this meeting. Leads are listed for context.
            </p>
          )}

          {/* Selected chips */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedMembers.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 pl-1 pr-2 py-0.5"
                >
                  <Avatar name={m.fullName} src={m.avatarUrl} size="xs" />
                  <span className="text-xs font-medium text-gray-700">{m.fullName.split(" ")[0]}</span>
                  <button
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search team members..."
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
            />

            {/* Dropdown list — only visible when focused */}
            {dropdownOpen && (
              <div className="absolute z-10 mt-1 left-0 right-0 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg divide-y divide-gray-50">
                {filteredMembers.map((m) => {
                  const selected = selectedIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        toggleMember(m.id);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                        selected ? "bg-brand-green/5" : ""
                      }`}
                    >
                      <Avatar name={m.fullName} src={m.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.fullName}</p>
                        <p className="text-xs text-gray-400 truncate">{m.email}</p>
                      </div>
                      {selected && <Check className="h-4 w-4 text-brand-green shrink-0" />}
                    </button>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">No matches</p>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <button
          type="button"
          onClick={resetAndClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Creating..." : createLabel}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
