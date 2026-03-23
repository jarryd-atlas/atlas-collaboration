"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { Avatar } from "../ui/avatar";
import {
  LayoutDashboard,
  Building2,
  ListTodo,
  Mic,
  FileText,
  FolderOpen,
  Users,
  Settings,
  Plug,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

// ─── Types ─────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPrefix?: string;
}

interface SidebarProps {
  /** "internal" = CK team view, "customer" = customer portal */
  tenantType: "internal" | "customer";
  currentUser: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
  /** For CK: list of customers for portal switcher */
  customers?: { name: string; slug: string }[];
  /** For customer: CK team contacts */
  ckContacts?: { name: string; role: string }[];
  /** Currently selected customer slug (CK view) */
  activeCustomerSlug?: string;
}

// ─── Nav configurations ────────────────────────────────────

const CK_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" />, matchPrefix: undefined },
  { label: "Companies", href: "/customers", icon: <Building2 className="h-5 w-5" />, matchPrefix: "/customers" },
  { label: "My Tasks", href: "/tasks", icon: <ListTodo className="h-5 w-5" />, matchPrefix: "/tasks" },
  { label: "Voice Notes", href: "/voice-notes", icon: <Mic className="h-5 w-5" />, matchPrefix: "/voice-notes" },
  { label: "Reports", href: "/reports", icon: <FileText className="h-5 w-5" />, matchPrefix: "/reports" },
];

const CK_ADMIN_NAV: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: <Users className="h-5 w-5" />, matchPrefix: "/admin/users" },
  { label: "Integrations", href: "/admin/integrations", icon: <Plug className="h-5 w-5" />, matchPrefix: "/admin/integrations" },
  { label: "AI Instructions", href: "/admin/ai-instructions", icon: <Sparkles className="h-5 w-5" />, matchPrefix: "/admin/ai-instructions" },
  { label: "Settings", href: "/admin/settings", icon: <Settings className="h-5 w-5" />, matchPrefix: "/admin/settings" },
];

function getCustomerNav(customerSlug: string): NavItem[] {
  const base = `/customers/${customerSlug}`;
  return [
    { label: "Overview", href: base, icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Documents", href: `${base}/documents`, icon: <FolderOpen className="h-5 w-5" />, matchPrefix: `${base}/documents` },
    { label: "Reports", href: `${base}/reports`, icon: <FileText className="h-5 w-5" />, matchPrefix: `${base}/reports` },
  ];
}

/**
 * Extract customer slug from pathname if we're inside /customers/[slug]/...
 */
function getCustomerSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/customers\/([^/]+)/);
  if (!match) return null;
  // Don't treat the customers list page as a customer context
  const slug = match[1];
  // Check if there's more to the path or it's a known customer slug (not "new" etc.)
  return slug ?? null;
}

// ─── Component ─────────────────────────────────────────────

export function Sidebar({
  tenantType,
  currentUser,
  customers = [],
  ckContacts = [],
  activeCustomerSlug: propActiveSlug,
}: SidebarProps) {
  const pathname = usePathname();
  const [portalOpen, setPortalOpen] = useState(false);
  const isInternal = tenantType === "internal";

  // Auto-detect customer context from URL for CK internal users
  const urlCustomerSlug = getCustomerSlugFromPath(pathname);
  const activeCustomerSlug = propActiveSlug ?? urlCustomerSlug;
  const isInCustomerContext = isInternal && !!activeCustomerSlug && pathname !== "/customers";

  // Find customer name for the context bar
  const activeCustomerName = activeCustomerSlug
    ? customers.find((c) => c.slug === activeCustomerSlug)?.name ?? activeCustomerSlug
    : null;

  const isActive = (item: NavItem): boolean => {
    if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
    return pathname === item.href;
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-100 bg-white">
      {/* ─── Logo ─── */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-gray-100 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">ATLAS</span>
          <span className="text-lg font-bold text-brand-green">Collaborate</span>
        </Link>
      </div>

      {/* ─── Internal view indicator (CK users) ─── */}
      {isInternal && !isInCustomerContext && (
        <div className="px-6 py-2 border-b border-gray-100 bg-gray-900">
          <p className="text-xs font-medium text-gray-300 uppercase tracking-wider">Internal View</p>
        </div>
      )}

      {/* ─── Customer context bar (when CK user is inside a customer) ─── */}
      {isInCustomerContext && activeCustomerName && (
        <div className="border-b border-gray-100 bg-gray-50">
          <Link
            href="/customers"
            className="flex items-center gap-1.5 px-6 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            All Companies
          </Link>
          <div className="px-6 pb-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{activeCustomerName}</p>
              <a
                href={pathname}
                title="View what the customer sees at this page"
                className="inline-flex items-center gap-1 rounded-md border border-brand-green/30 bg-brand-green/5 px-2 py-0.5 text-xs font-medium text-brand-dark hover:bg-brand-green/10 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Portal
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Internal View</p>
          </div>
        </div>
      )}

      {/* ─── Customer brand bar (customer portal only) ─── */}
      {!isInternal && activeCustomerSlug && (
        <div className="px-6 py-3 border-b border-gray-100 bg-brand-green/5">
          <p className="text-xs font-medium text-brand-dark uppercase tracking-wider">Company Portal</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">
            {activeCustomerName}
          </p>
        </div>
      )}

      {/* ─── Navigation ─── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {isInternal ? (
          <>
            {isInCustomerContext ? (
              <>
                {/* Customer-specific nav when inside a customer */}
                <p className="px-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Company
                </p>
                {getCustomerNav(activeCustomerSlug!).map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} />
                ))}

                {/* Separator + portfolio links */}
                <div className="pt-4 pb-1">
                  <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Portfolio
                  </p>
                </div>
                {CK_NAV.filter((item) => item.label !== "Companies").map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} />
                ))}
              </>
            ) : (
              <>
                {/* Portfolio section */}
                <p className="px-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Portfolio
                </p>
                {CK_NAV.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} />
                ))}
              </>
            )}

            {/* Admin section */}
            {(currentUser.role === "super_admin" || currentUser.role === "admin") && (
              <>
                <div className="pt-4 pb-1">
                  <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Admin
                  </p>
                </div>
                {CK_ADMIN_NAV.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {activeCustomerSlug &&
              getCustomerNav(activeCustomerSlug).map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item)} />
              ))}
          </>
        )}
      </nav>

      {/* ─── Bottom section ─── */}
      <div className="border-t border-gray-100 shrink-0">
        {/* Portal switcher (CK internal) or CK contacts (customer) */}
        {isInternal ? (
          <div className="p-3">
            <button
              onClick={() => setPortalOpen(!portalOpen)}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium">Companies</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", portalOpen && "rotate-180")} />
            </button>
            {portalOpen && (
              <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {customers.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/customers/${c.slug}`}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm transition-colors",
                      activeCustomerSlug === c.slug
                        ? "bg-brand-green/10 text-brand-dark font-medium"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
                    )}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              CK Team
            </p>
            {ckContacts.map((contact) => (
              <div key={contact.name} className="flex items-center gap-2 py-1">
                <Avatar name={contact.name} size="sm" />
                <div>
                  <p className="text-xs font-medium text-gray-700">{contact.name}</p>
                  <p className="text-xs text-gray-400">{contact.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User menu */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar name={currentUser.fullName} src={currentUser.avatarUrl} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{currentUser.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
            </div>
            <button className="p-1 rounded-md hover:bg-gray-100 text-gray-400">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Nav link ──────────────────────────────────────────────

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-gray-50 text-gray-900"
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
      )}
    >
      <span className={cn(active ? "text-brand-green" : "text-gray-400")}>{item.icon}</span>
      {item.label}
    </Link>
  );
}
