import { getAllProfiles, getCustomers } from "../../../../lib/data/queries";
import { Badge, StatusBadge } from "../../../../components/ui/badge";
import { Avatar } from "../../../../components/ui/avatar";
import { Clock } from "lucide-react";
import { formatLabel } from "../../../../lib/utils";
import { InviteUserButton, ApproveUserButton, DenyUserButton } from "../../../../components/forms/admin-actions";

export default async function AdminUsersPage() {
  let profiles: Awaited<ReturnType<typeof getAllProfiles>> = [];
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];

  try {
    [profiles, customers] = await Promise.all([
      getAllProfiles(),
      getCustomers(),
    ]);
  } catch {
    // Show empty state
  }

  const activeUsers = profiles.filter((p) => p.status === "active");
  const pendingUsers = profiles.filter(
    (p) => p.status === "pending" || p.status === "pending_approval",
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">
            {activeUsers.length} active, {pendingUsers.length} pending
          </p>
        </div>
        <InviteUserButton customers={customers} />
      </div>

      {/* Pending approvals */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Pending Approval ({pendingUsers.length})
            </h2>
          </div>
          <div className="space-y-3">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between bg-white rounded-lg p-4 border border-amber-100"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={user.full_name} size="md" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={user.status} />
                  <ApproveUserButton userId={user.id} userName={user.full_name} />
                  <DenyUserButton userId={user.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            className="w-full rounded-lg border border-gray-200 pl-10 pr-4 py-2 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
          />
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
        {profiles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-400">No users found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  User
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
              {profiles.map((user) => {
                // Try to find org name from tenant relationship or customer list
                const org = user.tenant?.name
                  ?? customers.find((c) => c.tenant_id === user.tenant_id)?.name
                  ?? "Unknown";

                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.full_name} src={user.avatar_url} size="md" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          user.role === "super_admin"
                            ? "info"
                            : user.role === "admin"
                              ? "warning"
                              : "default"
                        }
                      >
                        {formatLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{org}</p>
                    </td>
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
    </div>
  );
}
