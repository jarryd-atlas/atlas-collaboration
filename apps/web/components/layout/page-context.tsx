"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface PageContextValue {
  siteId: string | null;
  siteName: string | null;
  customerId: string | null;
  customerName: string | null;
  milestoneId: string | null;
  tenantId: string | null;
}

const PageContext = createContext<PageContextValue>({
  siteId: null,
  siteName: null,
  customerId: null,
  customerName: null,
  milestoneId: null,
  tenantId: null,
});

/**
 * Hook to read the current page context (site, customer, etc.)
 * Used by QuickActions to auto-associate voice notes, tasks, etc.
 */
export function usePageContext() {
  return useContext(PageContext);
}

// Singleton for imperative updates from server components
let _setter: ((ctx: Partial<PageContextValue>) => void) | null = null;

/**
 * Provider that wraps the app shell.
 */
export function PageContextProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<PageContextValue>({
    siteId: null,
    siteName: null,
    customerId: null,
    customerName: null,
    milestoneId: null,
    tenantId: null,
  });

  _setter = (partial) => setCtx((prev) => ({ ...prev, ...partial }));

  return <PageContext.Provider value={ctx}>{children}</PageContext.Provider>;
}

/**
 * Client component to set page context from within a page.
 * Renders nothing — just sets context values on mount.
 *
 * Usage in a page:
 *   <SetPageContext siteId={site.id} siteName={site.name} tenantId={site.tenant_id} />
 */
export function SetPageContext(props: Partial<PageContextValue>) {
  const [, setCtx] = useState(0);

  useEffect(() => {
    if (_setter) {
      _setter(props);
    }
    // Clear context on unmount
    return () => {
      if (_setter) {
        _setter({
          siteId: null,
          siteName: null,
          customerId: null,
          customerName: null,
          milestoneId: null,
          tenantId: null,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.siteId, props.customerId, props.milestoneId]);

  return null;
}
