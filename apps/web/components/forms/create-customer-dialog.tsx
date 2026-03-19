"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { createCustomer } from "../../lib/actions";

interface CreateCustomerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateCustomerDialog({ open, onClose }: CreateCustomerDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createCustomer(formData);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
      } else {
        onClose();
        router.push(`/customers/${result.slug}`);
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={onClose}>Add Customer</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Input
            id="customer-name"
            name="name"
            label="Customer Name"
            placeholder="e.g. Americold Realty Trust"
            required
          />
          <Input
            id="customer-domain"
            name="domain"
            label="Email Domain"
            placeholder="e.g. americold.com"
          />
          <Input
            id="customer-logo"
            name="logoUrl"
            label="Logo URL"
            placeholder="https://..."
          />
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              A new tenant will be created for this customer. Users with matching email domains can request access.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Customer"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export function AddCustomerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="md" onClick={() => setOpen(true)}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Customer
      </Button>
      <CreateCustomerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
