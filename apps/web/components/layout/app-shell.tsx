"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { MobileSidebar } from "./mobile-sidebar";
import { QuickActions } from "./quick-actions";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";
import { PageContextProvider } from "./page-context";
import { UpdateBanner } from "./update-banner";

interface SessionClaims {
  tenantId?: string;
  tenantType?: "internal" | "customer";
  appRole?: "super_admin" | "admin" | "member";
  profileId?: string;
  profileStatus?: string;
}

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: ReactNode;
  sessionClaims?: SessionClaims | null;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
  userFullName?: string | null;
  customers?: Array<{ name: string; slug: string }>;
}

export function AppShell({
  children,
  breadcrumbs,
  sessionClaims,
  userEmail,
  userAvatarUrl,
  userFullName,
  customers = [],
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("atlas-nav-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("atlas-nav-collapsed", String(navCollapsed));
    } catch {
      // ignore
    }
  }, [navCollapsed]);

  const searchParams = useSearchParams();
  const isCustomerPreview = searchParams.get("preview") === "customer";

  // In preview mode, CK internal users see the customer portal experience
  const tenantType = isCustomerPreview ? "customer" : (sessionClaims?.tenantType ?? "internal");
  const userRole = sessionClaims?.appRole ?? "member";
  const fullName = userFullName ?? userEmail?.split("@")[0] ?? "User";
  const email = userEmail ?? "";
  const avatar = userAvatarUrl ?? null;

  const sidebarProps = {
    tenantType,
    currentUser: {
      fullName,
      email,
      avatarUrl: avatar,
      role: userRole,
    },
    customers,
  };

  return (
    <PageContextProvider>
      {/* Update / re-auth banners */}
      <UpdateBanner />

      {/* Customer preview banner */}
      {isCustomerPreview && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-amber-900">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Customer Portal Preview — This is what the customer sees
        </div>
      )}
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:block shrink-0 transition-all duration-200">
          <Sidebar
            {...sidebarProps}
            collapsed={navCollapsed}
            onToggleCollapse={() => setNavCollapsed(!navCollapsed)}
          />
        </div>

        {/* Mobile sidebar */}
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)}>
          <Sidebar {...sidebarProps} />
        </MobileSidebar>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <TopBar
            currentUser={{ fullName, avatarUrl: avatar }}
            onMenuToggle={() => setMobileOpen(true)}
            breadcrumbs={breadcrumbs}
          />
          <div className="p-6 pb-24">{children}</div>
        </main>

        {/* Quick Actions FAB — hidden in customer preview */}
        {!isCustomerPreview && (
          <QuickActions isInternal={tenantType === "internal"} />
        )}

        {/* Keyboard shortcuts help (press ?) */}
        <KeyboardShortcutsDialog />
      </div>
    </PageContextProvider>
  );
}
