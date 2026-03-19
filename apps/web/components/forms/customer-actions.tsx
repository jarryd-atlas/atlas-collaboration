"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { CreateSiteDialog } from "./create-site-dialog";
import { CreateMilestoneDialog } from "./create-milestone-dialog";
import { FlagIssueDialog } from "./flag-issue-dialog";
import { Plus, Mic, Flag, Target } from "lucide-react";
interface CustomerActionsProps {
  customerName: string;
  customerId: string;
  customerTenantId: string;
  sites: Array<{ id: string; name: string; slug: string; [key: string]: unknown }>;
}

export function CustomerActions({ customerName, customerId, customerTenantId, sites }: CustomerActionsProps) {
  const [showAddSite, setShowAddSite] = useState(false);
  const [showFlagIssue, setShowFlagIssue] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowAddSite(true)}>
          <Plus className="h-4 w-4" /> Add Site
        </Button>
        <Button variant="outline" size="sm" disabled>
          <Mic className="h-4 w-4" /> Quick Note
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowFlagIssue(true)}>
          <Flag className="h-4 w-4" /> Flag Issue
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowAddMilestone(true)}>
          <Target className="h-4 w-4" /> New Milestone
        </Button>
      </div>

      <CreateSiteDialog
        open={showAddSite}
        onClose={() => setShowAddSite(false)}
        customerName={customerName}
        customerId={customerId}
        customerTenantId={customerTenantId}
      />
      <FlagIssueDialog
        open={showFlagIssue}
        onClose={() => setShowFlagIssue(false)}
        sites={sites}
      />
      <CreateMilestoneDialog
        open={showAddMilestone}
        onClose={() => setShowAddMilestone(false)}
        siteName={sites[0]?.name ?? "Site"}
      />
    </>
  );
}

interface AddSiteButtonProps {
  customerName: string;
  customerId: string;
  customerTenantId: string;
}

export function AddSiteButton({ customerName, customerId, customerTenantId }: AddSiteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Site
      </Button>
      <CreateSiteDialog
        open={open}
        onClose={() => setOpen(false)}
        customerName={customerName}
        customerId={customerId}
        customerTenantId={customerTenantId}
      />
    </>
  );
}
