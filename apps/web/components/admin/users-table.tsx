"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge, StatusBadge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { formatLabel } from "../../lib/utils";
import { updateUserProfile } from "../../lib/actions/admin";
import type { UserRole } from "@repo/supabase";
import { Pencil, Check, X } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
  status: string;
  tenant_id: string;
  title: string | null;
  team: string | null;
  tenant?: { id: string; name: string; type: string } | null;
}

interface UsersTableProps {
  profiles: UserProfile[];
  customers: Array<{ name: string; tenant_id: string }>;
  isSuper: boolean;
}

// ─── Predefined options ────────────────────────────────────

const TEAM_OPTIONS = [
  "Leadership",
  "Sales",
  "Engineering",
  "Operations",
  "Project Management",
  "Support",
  "Finance",
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

// ─── Inline edit cell ──────────────────────────────────────

function EditableCell({
  value,
  onSave,
  placeholder,
  options,
}: {
  value: string | null;
  onSave: (val: string | null) => Promise<void>;
  placeholder: string;
  options?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    const newVal = draft.trim() || null;
    if (newVal === value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await onSave(newVal);
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {options ? (
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
            autoFocus
          >
            <option value="">None</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
            placeholder={placeholder}
            autoFocus
          />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className="group flex items-center gap-1.5 text-left w-full"
    >
      <span className={`text-sm ${value ? "text-gray-700" : "text-gray-300 italic"}`}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

// ─── Role selector ─────────────────────────────────────────

function RoleSelect({
  userId,
  currentRole,
  isSuper,
}: {
  userId: string;
  currentRole: string;
  isSuper: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!isSuper) {
    return (
      <Badge
        variant={
          currentRole === "super_admin"
            ? "info"
            : currentRole === "admin"
              ? "warning"
              : "default"
        }
      >
        {formatLabel(currentRole)}
      </Badge>
    );
  }

  return (
    <select
      value={currentRole}
      disabled={isPending}
      onChange={(e) => {
        startTransition(async () => {
          await updateUserProfile(userId, { role: e.target.value as UserRole });
          router.refresh();
        });
      }}
      className={`rounded border px-2 py-1 text-xs font-medium outline-none transition-colors ${
        isPending ? "opacity-50" : ""
      } ${
        currentRole === "super_admin"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : currentRole === "admin"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      {ROLE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ─── Main table ────────────────────────────────────────────

export function UsersTable({ profiles, customers, isSuper }: UsersTableProps) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = profiles.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.title?.toLowerCase().includes(q) ||
      u.team?.toLowerCase().includes(q)
    );
  });

  const handleUpdateProfile = useCallback(
    async (profileId: string, updates: { title?: string | null; team?: string | null }) => {
      const result = await updateUserProfile(profileId, updates);
      if (result.error) {
        console.error("Failed to update profile:", result.error);
      }
      router.refresh();
    },
    [router],
  );

  return (
    <>
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 pl-10 pr-4 py-2 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-400">
              {search ? "No users match your search" : "No users found"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Team
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Organization
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((user) => {
                const org =
                  user.tenant?.name ??
                  customers.find((c) => c.tenant_id === user.tenant_id)?.name ??
                  "Unknown";

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* User */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={user.full_name ?? user.email}
                          src={user.avatar_url}
                          size="md"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.full_name}
                          </p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Title (editable) */}
                    <td className="px-6 py-4">
                      <EditableCell
                        value={user.title}
                        placeholder="Add title"
                        onSave={(val) =>
                          handleUpdateProfile(user.id, { title: val })
                        }
                      />
                    </td>

                    {/* Team (editable with options) */}
                    <td className="px-6 py-4">
                      <EditableCell
                        value={user.team}
                        placeholder="Add team"
                        options={TEAM_OPTIONS}
                        onSave={(val) =>
                          handleUpdateProfile(user.id, { team: val })
                        }
                      />
                    </td>

                    {/* Role (dropdown for super_admin, badge for others) */}
                    <td className="px-6 py-4">
                      <RoleSelect
                        userId={user.id}
                        currentRole={user.role}
                        isSuper={isSuper}
                      />
                    </td>

                    {/* Organization */}
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{org}</p>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={user.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
