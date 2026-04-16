import { getActivityForPortfolio, getCustomers } from "../../../lib/data/queries";
import { getInternalProfiles } from "../../../lib/data/queries";
import { getCurrentUser } from "../../../lib/data/current-user";
import { ActivityPageClient } from "../../../components/activity/activity-page-client";

export default async function ActivityPage() {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.sessionClaims?.tenantId;
  const isInternal = currentUser?.sessionClaims?.tenantType === "internal";

  if (!tenantId || !isInternal) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        Activity feed is only available for internal users.
      </div>
    );
  }

  // Fetch initial activity + filter options in parallel
  const [activities, customers, profiles] = await Promise.all([
    getActivityForPortfolio(tenantId, undefined, 50).catch(() => []),
    getCustomers().catch(() => []),
    getInternalProfiles().catch(() => []),
  ]);

  return (
    <ActivityPageClient
      initialActivities={activities}
      customers={(customers as any[]).map((c: any) => ({ id: c.id, name: c.name }))}
      teamMembers={(profiles as any[]).map((p: any) => ({ id: p.id, name: p.full_name ?? p.email }))}
      tenantId={tenantId}
    />
  );
}
