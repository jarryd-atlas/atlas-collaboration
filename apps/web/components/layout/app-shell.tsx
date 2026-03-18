"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { MobileSidebar } from "./mobile-sidebar";
import { getMockCurrentUser, getCustomers as getMockCustomers } from "../../lib/mock-data";

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
}

export function AppShell({
  children,
  breadcrumbs,
  sessionClaims,
  userEmail,
  userAvatarUrl,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Use real session if available, fall back to mock data
  const mockUser = getMockCurrentUser();
  const customers = getMockCustomers();

  const tenantType = sessionClaims?.tenantType ?? "internal";
  const userRole = sessionClaims?.appRole ?? mockUser.role;
  const fullName = userEmail ? userEmail.split("@")[0]! : mockUser.fullName;
  const email = userEmail ?? mockUser.email;
  const avatar = userAvatarUrl ?? mockUser.avatarUrl;

  const sidebarProps = {
    tenantType,
    currentUser: {
      fullName,
      email,
      avatarUrl: avatar,
      role: userRole,
    },
    customers: customers.map((c) => ({ name: c.name, slug: c.slug })),
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
