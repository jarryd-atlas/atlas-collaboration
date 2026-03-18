"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { MobileSidebar } from "./mobile-sidebar";

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

  const tenantType = sessionClaims?.tenantType ?? "internal";
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
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar {...sidebarProps} />
      </div>

      {/* Mobile sidebar */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Sidebar {...sidebarProps} />
      </MobileSidebar>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <TopBar
          currentUser={{ fullName, avatarUrl: avatar }}
          onMenuToggle={() => setMobileOpen(true)}
          breadcrumbs={breadcrumbs}
        />
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
