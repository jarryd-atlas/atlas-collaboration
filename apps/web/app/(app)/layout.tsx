import type { ReactNode } from "react";
import { AppShell } from "../../components/layout/app-shell";
import { getSession } from "../../lib/supabase/server";
import { getCustomers, getProfileById } from "../../lib/data/queries";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Get real session if available
  const sessionResult = await getSession().catch(() => null);

  let userFullName: string | null = null;
  let customers: Array<{ name: string; slug: string }> = [];

  try {
    // Fetch profile and customers in parallel
    const [profile, customerData] = await Promise.all([
      sessionResult?.claims?.profileId
        ? getProfileById(sessionResult.claims.profileId).catch(() => null)
        : null,
      getCustomers().catch(() => []),
    ]);

    userFullName = profile?.full_name ?? null;
    customers = (customerData ?? []).map((c) => ({ name: c.name, slug: c.slug }));
  } catch {
    // Fall back to empty state
  }

  return (
    <AppShell
      sessionClaims={sessionResult?.claims ?? null}
      userEmail={sessionResult?.user?.email ?? null}
      userAvatarUrl={sessionResult?.user?.user_metadata?.avatar_url ?? null}
      userFullName={userFullName}
      customers={customers}
    >
      {children}
    </AppShell>
  );
}
