"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Select } from "../ui/input";
import { Button } from "../ui/button";
import { ROLES } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import type { Customer } from "../../lib/mock-data";

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
}

export function InviteUserDialog({ open, onClose, customers }: InviteUserDialogProps) {
  const [tenantType, setTenantType] = useState<"internal" | "customer">("customer");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    // TODO: Replace with Supabase insert (pre-create profile + send invite email)
    setTimeout(() => {
      setSubmitting(false);
      onClose();
    }, 500);
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={onClose}>Invite User</DialogHeader>
        <DialogBody className="space-y-4">
          <Input
            id="invite-email"
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            required
          />
          <Input
            id="invite-name"
            label="Full Name"
            placeholder="Jane Doe"
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">User Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="tenant-type"
                  value="internal"
                  checked={tenantType === "internal"}
                  onChange={() => setTenantType("internal")}
                  className="text-brand-green"
                />
                CK Team Member
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="tenant-type"
                  value="customer"
                  checked={tenantType === "customer"}
                  onChange={() => setTenantType("customer")}
                  className="text-brand-green"
                />
                Customer User
              </label>
            </div>
          </div>

          {tenantType === "customer" && (
            <Select
              id="invite-customer"
              label="Customer"
              options={customers.map((c) => ({
                value: c.tenantId,
                label: c.name,
              }))}
            />
          )}

          <Select
            id="invite-role"
            label="Role"
            options={ROLES.filter((r) => r !== "super_admin").map((r) => ({
              value: r,
              label: formatLabel(r),
            }))}
          />

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              The user will receive an email invitation with a magic link to sign in.
              {tenantType === "customer"
                ? " Customer users can only see their own organization's data."
                : " CK team members can see all customer data."}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
