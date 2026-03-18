"use client";

import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { InviteUserDialog } from "./invite-user-dialog";
import { Plus, UserCheck } from "lucide-react";
import { approveUser, denyUser } from "../../lib/actions";
import type { Customer } from "../../lib/mock-data";

interface InviteUserButtonProps {
  customers: Customer[];
}

export function InviteUserButton({ customers }: InviteUserButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Invite User
      </Button>
      <InviteUserDialog
        open={open}
        onClose={() => setOpen(false)}
        customers={customers}
      />
    </>
  );
}

interface ApproveUserButtonProps {
  userId: string;
  userName: string;
}

export function ApproveUserButton({ userId, userName: _userName }: ApproveUserButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      await approveUser(userId);
    });
  }

  return (
    <Button variant="primary" size="sm" onClick={handleApprove} disabled={isPending}>
      <UserCheck className="h-4 w-4" /> {isPending ? "Approving..." : "Approve"}
    </Button>
  );
}

export function DenyUserButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDeny() {
    startTransition(async () => {
      await denyUser(userId);
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDeny} disabled={isPending}>
      {isPending ? "Denying..." : "Deny"}
    </Button>
  );
}
