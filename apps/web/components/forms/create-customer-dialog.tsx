"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { AddressAutocomplete } from "./address-autocomplete";
import { createCustomer } from "../../lib/actions";

interface CreateCustomerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateCustomerDialog({ open, onClose }: CreateCustomerDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [hqLocation, setHqLocation] = useState<{
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  } | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    // Append HQ location fields
    if (hqLocation) {
      formData.set("hqAddress", hqLocation.address);
      formData.set("hqCity", hqLocation.city);
      formData.set("hqState", hqLocation.state);
      formData.set("hqZip", hqLocation.zip);
      formData.set("hqLatitude", String(hqLocation.lat));
      formData.set("hqLongitude", String(hqLocation.lng));
    }

    startTransition(async () => {
      const result = await createCustomer(formData);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
      } else {
        setHqLocation(null);
        onClose();
        router.push(`/customers/${result.slug}`);
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={onClose}>Add Company</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Input
            id="customer-name"
            name="name"
            label="Company Name"
            placeholder="e.g. Americold Realty Trust"
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="customer"
                  defaultChecked
                  className="text-brand-green"
                />
                Customer
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="prospect"
                  className="text-brand-green"
                />
                Prospect
              </label>
            </div>
          </div>
          <Input
            id="customer-domain"
            name="domain"
            label="Email Domain"
            placeholder="e.g. americold.com"
          />

          {/* Corporate HQ Location */}
          <div className="space-y-2">
            <AddressAutocomplete
              onSelect={(details) =>
                setHqLocation({
                  address: details.address,
                  city: details.city,
                  state: details.state,
                  zip: details.zip,
                  lat: details.lat,
                  lng: details.lng,
                })
              }
              placeholder="Search for corporate HQ..."
            />
            {hqLocation && (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <span className="text-xs text-gray-600 truncate">
                  {[hqLocation.city, hqLocation.state].filter(Boolean).join(", ")}
                </span>
                <button
                  type="button"
                  onClick={() => setHqLocation(null)}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              A new tenant will be created for this company. Users with matching email domains can request access.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Company"}
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
        Add Company
      </Button>
      <CreateCustomerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
