"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogHeader, DialogBody } from "../ui/dialog";
import {
  InlineTaskInput,
  type AssignableUser,
  type AssignableSite,
  type AssignableCustomer,
} from "../tasks/inline-task-input";
import { usePageContext } from "../layout/page-context";
import { fetchQuickTaskData } from "../../lib/actions";
import { Building2, MapPin, Loader2, X } from "lucide-react";

interface SiteOption {
  id: string;
  name: string;
  customer_id: string;
  tenant_id: string;
}

interface PrefetchedData {
  sites: any[];
  customers: any[];
  users: any[];
}

interface QuickTaskDialogProps {
  open: boolean;
  onClose: () => void;
  prefetchedData?: PrefetchedData | null;
}

/**
 * Smart context-aware Quick Task dialog.
 *
 * - Accepts prefetched data for instant open (no loading spinner)
 * - Auto-detects page context (customer, site) and shows as editable chips
 * - User can clear context chips or use @ mentions to set company/site/person
 * - @ mention support for companies, people, and sites
 * - Sites filtered to selected customer in the @ dropdown
 */
export function QuickTaskDialog({ open, onClose, prefetchedData }: QuickTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [allCustomers, setAllCustomers] = useState<AssignableCustomer[]>([]);
  const [allSites, setAllSites] = useState<SiteOption[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [fallbackTenantId, setFallbackTenantId] = useState("");
  const dataLoaded = useRef(false);

  // Editable context state
  const [selectedCustomer, setSelectedCustomer] = useState<AssignableCustomer | null>(null);
  const [selectedSite, setSelectedSite] = useState<{ id: string; name: string } | null>(null);

  const pageCtx = usePageContext();

  // Apply data (from prefetch or fetch) and set context
  const applyData = useCallback((raw: PrefetchedData) => {
    const customers = (raw.customers ?? []).map((c: any) => ({
      id: c.id as string,
      name: c.name as string,
      tenant_id: c.tenant_id as string,
    }));
    setAllCustomers(customers);

    const sites = (raw.sites ?? []).map((s: any) => ({
      id: s.id as string,
      name: s.name as string,
      customer_id: s.customer_id as string,
      tenant_id: s.tenant_id as string,
    }));
    setAllSites(sites);

    if (sites[0]) setFallbackTenantId(sites[0].tenant_id);

    const users = (raw.users ?? []).map((u: any) => ({
      id: u.id as string,
      full_name: u.full_name as string,
      avatar_url: u.avatar_url as string | null,
      group: "CK Team",
    }));
    setAssignableUsers(users);

    dataLoaded.current = true;
    return customers;
  }, []);

  // Set context from current page
  const applyPageContext = useCallback((customers: AssignableCustomer[]) => {
    if (pageCtx.customerId && pageCtx.customerName) {
      const matched = customers.find((c) => c.id === pageCtx.customerId);
      setSelectedCustomer(matched ?? {
        id: pageCtx.customerId,
        name: pageCtx.customerName,
        tenant_id: pageCtx.tenantId ?? "",
      });
    }
    if (pageCtx.siteId && pageCtx.siteName) {
      setSelectedSite({ id: pageCtx.siteId, name: pageCtx.siteName });
    }
  }, [pageCtx]);

  // When dialog opens, use prefetched data or fetch as fallback
  useEffect(() => {
    if (!open) return;

    // Reset context selections on each open
    setSelectedCustomer(null);
    setSelectedSite(null);

    if (prefetchedData) {
      const customers = applyData(prefetchedData);
      applyPageContext(customers);
      setLoading(false);
    } else if (!dataLoaded.current) {
      setLoading(true);
      fetchQuickTaskData().then((data) => {
        const customers = applyData(data);
        applyPageContext(customers);
        setLoading(false);
      });
    } else {
      // Data already loaded from a previous open
      applyPageContext(allCustomers);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter sites to selected customer for @ mention
  const assignableSites: AssignableSite[] = useMemo(() => {
    const filtered = selectedCustomer
      ? allSites.filter((s) => s.customer_id === selectedCustomer.id)
      : allSites;
    return filtered.map((s) => ({ id: s.id, name: s.name }));
  }, [allSites, selectedCustomer]);

  const handleCustomerChange = useCallback((customer: AssignableCustomer | null) => {
    setSelectedCustomer(customer);
    if (!customer || (selectedCustomer && customer.id !== selectedCustomer.id)) {
      setSelectedSite(null); // Clear site when customer changes
    }
  }, [selectedCustomer]);

  const handleSiteChange = useCallback((siteId: string | null) => {
    if (!siteId) {
      setSelectedSite(null);
      return;
    }
    const site = allSites.find((s) => s.id === siteId);
    if (site) {
      setSelectedSite({ id: site.id, name: site.name });
      // Auto-set customer if not already set
      if (!selectedCustomer) {
        const customer = allCustomers.find((c) => c.id === site.customer_id);
        if (customer) setSelectedCustomer(customer);
      }
    }
  }, [allSites, allCustomers, selectedCustomer]);

  function handleClose() {
    // Don't clear data — keep it cached for instant reopen
    setSelectedCustomer(null);
    setSelectedSite(null);
    onClose();
  }

  const effectiveTenantId = selectedCustomer?.tenant_id || pageCtx.tenantId || fallbackTenantId;
  const hasContext = !!selectedCustomer || !!selectedSite;

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Quick Task</DialogHeader>
      <DialogBody className="space-y-3 pb-5">
        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            {/* Context chips — show current associations from page or @ mentions */}
            {hasContext && (
              <div className="flex items-center gap-2 flex-wrap px-1">
                {selectedCustomer && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 pl-2 pr-1 py-1 text-xs font-medium">
                    <Building2 className="h-3 w-3" />
                    <span className="max-w-[140px] truncate">{selectedCustomer.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setSelectedSite(null);
                      }}
                      className="p-0.5 rounded-full hover:bg-blue-100 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedSite && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 pl-2 pr-1 py-1 text-xs font-medium">
                    <MapPin className="h-3 w-3" />
                    <span className="max-w-[140px] truncate">{selectedSite.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSite(null)}
                      className="p-0.5 rounded-full hover:bg-emerald-100 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Inline task input with @ mention for companies, people, sites */}
            <InlineTaskInput
              tenantId={effectiveTenantId}
              customerId={selectedCustomer?.id}
              siteId={selectedSite?.id}
              milestoneId={pageCtx.milestoneId ?? undefined}
              assignableUsers={assignableUsers}
              assignableSites={assignableSites}
              assignableCustomers={allCustomers}
              placeholder="Type a task... Use @ for company, person, or site"
              autoFocus
              onTaskCreated={handleClose}
              onCustomerChange={handleCustomerChange}
              onSiteChange={handleSiteChange}
            />

            <p className="text-[11px] text-gray-400 pl-10">
              {selectedCustomer
                ? `Task will be created under ${selectedCustomer.name}${selectedSite ? ` \u2192 ${selectedSite.name}` : ""}.`
                : "Use @ to associate with a company, person, or site."}
            </p>
          </>
        )}
      </DialogBody>
    </Dialog>
  );
}
