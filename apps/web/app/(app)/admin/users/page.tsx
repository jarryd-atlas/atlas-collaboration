import { getAllProfiles, getCustomers } from "../../../../lib/data/queries";
import { Clock } from "lucide-react";
import { StatusBadge } from "../../../../components/ui/badge";
import { Avatar } from "../../../../components/ui/avatar";
import { InviteUserButton, ApproveUserButton, DenyUserButton } from "../../../../components/forms/admin-actions";
import { UsersTable } from "../../../../components/admin/users-table";
import { getCurrentUser } from "../../../../lib/data/current-user";

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

  const currentUser = await getCurrentUser();
  const isSuper = currentUser?.role === "super_admin";

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

      {/* Users table with inline editing */}
      <UsersTable
        profiles={profiles as any}
        customers={customers}
        isSuper={isSuper}
      />
    </div>
  );
}
