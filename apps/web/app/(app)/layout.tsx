import type { ReactNode } from "react";
import { AppShell } from "../../components/layout/app-shell";
import { getSession } from "../../lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Get real session if available, otherwise AppShell falls back to mock
  const sessionResult = await getSession().catch(() => null);

  return (
    <AppShell
      sessionClaims={sessionResult?.claims ?? null}
      userEmail={sessionResult?.user?.email ?? null}
      userAvatarUrl={sessionResult?.user?.user_metadata?.avatar_url ?? null}
    >
      {children}
    </AppShell>
  );
}
