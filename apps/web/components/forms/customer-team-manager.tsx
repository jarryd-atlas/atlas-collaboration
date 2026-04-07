"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Users } from "lucide-react";
import { Combobox, type ComboboxOption } from "../ui/combobox";
import { Button } from "../ui/button";
import { addCKTeamMember, removeCKTeamMember, updateCKTeamMemberLabel, updateCKTeamMemberDepartment, getDepartments } from "../../lib/actions";

interface Department {
  id: string;
  name: string;
  label: string;
  sort_order: number;
}

interface TeamMember {
  id: string;
  role_label: string | null;
  department_id: string | null;
  department: Department | null;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface InternalProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface CustomerTeamManagerProps {
  customerId: string;
  teamMembers: TeamMember[];
  internalProfiles: InternalProfile[];
}

const ROLE_LABELS = [
  "Account Manager",
  "Project Lead",
  "Engineer",
  "Support",
];

export function CustomerTeamManager({
  customerId,
  teamMembers: initialTeam,
  internalProfiles,
}: CustomerTeamManagerProps) {
  const [teamMembers, setTeamMembers] = useState(initialTeam);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedRoleLabel, setSelectedRoleLabel] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  // Fetch departments on mount
  useEffect(() => {
    getDepartments().then((result) => {
      if (result.departments) setDepartments(result.departments);
    });
  }, []);

  // Filter out already-added profiles
  const existingIds = new Set(teamMembers.map((m) => m.profile.id));
  const availableProfiles: ComboboxOption[] = internalProfiles
    .filter((p) => !existingIds.has(p.id))
    .map((p) => ({
      value: p.id,
      label: p.full_name,
      sublabel: p.email,
    }));

  function handleAdd() {
    if (!selectedProfileId) return;
    setError("");

    startTransition(async () => {
      const result = await addCKTeamMember(customerId, selectedProfileId, selectedRoleLabel || undefined, selectedDepartmentId || undefined);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        // Add to local state
        const profile = internalProfiles.find((p) => p.id === selectedProfileId);
        const dept = departments.find((d) => d.id === selectedDepartmentId) || null;
        if (profile) {
          setTeamMembers((prev) => [
            ...prev,
            {
              id: `temp-${Date.now()}`,
              role_label: selectedRoleLabel || null,
              department_id: selectedDepartmentId || null,
              department: dept,
              profile,
            },
          ]);
        }
        setSelectedProfileId("");
        setSelectedRoleLabel("");
        setSelectedDepartmentId("");
        setShowAdd(false);
        router.refresh();
      }
    });
  }

  function handleRemove(profileId: string) {
    setError("");
    startTransition(async () => {
      const result = await removeCKTeamMember(customerId, profileId);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setTeamMembers((prev) => prev.filter((m) => m.profile.id !== profileId));
        router.refresh();
      }
    });
  }

  function handleRoleLabelChange(profileId: string, newLabel: string) {
    startTransition(async () => {
      await updateCKTeamMemberLabel(customerId, profileId, newLabel);
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.profile.id === profileId ? { ...m, role_label: newLabel || null } : m
        ),
      );
    });
  }

  function handleDepartmentChange(profileId: string, departmentId: string) {
    const dept = departments.find((d) => d.id === departmentId) || null;
    startTransition(async () => {
      await updateCKTeamMemberDepartment(customerId, profileId, departmentId || null);
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.profile.id === profileId
            ? { ...m, department_id: departmentId || null, department: dept }
            : m
        ),
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">CK Team</h3>
          <span className="text-xs text-gray-400">{teamMembers.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark hover:text-brand-dark/80 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Add member form */}
      {showAdd && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <Combobox
            placeholder="Search CK team members..."
            options={availableProfiles}
            value={selectedProfileId}
            onChange={setSelectedProfileId}
          />
          {selectedProfileId && (
            <>
              {departments.length > 0 && (
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              )}
              <select
                value={selectedRoleLabel}
                onChange={(e) => setSelectedRoleLabel(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <option value="">Select role...</option>
                {ROLE_LABELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAdd(false);
                    setSelectedProfileId("");
                    setSelectedRoleLabel("");
                    setSelectedDepartmentId("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAdd}
                  disabled={isPending}
                >
                  {isPending ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Team member list */}
      {teamMembers.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">
          No CK team members assigned. Add members so customers can assign them tasks.
        </p>
      ) : (
        <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 bg-white">
          {teamMembers.map((member) => (
            <div
              key={member.profile.id}
              className="flex items-center gap-3 px-3 py-2.5 group"
            >
              {/* Avatar */}
              <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                {member.profile.avatar_url ? (
                  <img
                    src={member.profile.avatar_url}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  member.profile.full_name?.charAt(0)?.toUpperCase() ?? "?"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {member.profile.full_name}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Department selector */}
                  <select
                    value={member.department_id || ""}
                    onChange={(e) => handleDepartmentChange(member.profile.id, e.target.value)}
                    className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5 cursor-pointer hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-green/30 max-w-[120px]"
                  >
                    <option value="">No dept</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-300">·</span>
                  {/* Role selector */}
                  <select
                    value={member.role_label || ""}
                    onChange={(e) => handleRoleLabelChange(member.profile.id, e.target.value)}
                    className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5 cursor-pointer hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-green/30 max-w-[130px]"
                  >
                    <option value="">No role</option>
                    {ROLE_LABELS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(member.profile.id)}
                disabled={isPending}
                className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                title="Remove from team"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
