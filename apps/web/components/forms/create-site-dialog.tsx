"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { SITE_PIPELINE_STAGES } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import { createSite } from "../../lib/actions";
import { AddressAutocomplete } from "./address-autocomplete";

interface CreateSiteDialogProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  customerId: string;
  customerTenantId: string;
}

export function CreateSiteDialog({
  open,
  onClose,
  customerName,
  customerId,
  customerTenantId,
}: CreateSiteDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const router = useRouter();

  function handlePlaceSelect(details: {
    name: string;
    address: string;
    city: string;
    state: string;
  }) {
    if (!siteName) {
      const parts: string[] = [];
      if (details.city) parts.push(details.city);
      if (details.address) parts.push(details.address);
      setSiteName(parts.join(" - ") || details.name);
    }
    setAddress(details.address);
    setCity(details.city);
    setState(details.state);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!address.trim()) {
      setError("Address is required. Use the search to select a location.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("customerId", customerId);
    formData.set("customerTenantId", customerTenantId);

    startTransition(async () => {
      const result = await createSite(formData);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
      } else {
        onClose();
        router.refresh();
      }
    });
  }

  function handleClose() {
    setSiteName("");
    setAddress("");
    setCity("");
    setState("");
    setError("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={handleClose}>
          Add Site to {customerName}
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <AddressAutocomplete onSelect={handlePlaceSelect} />

          <Input
            id="site-name"
            name="name"
            label="Site Name"
            placeholder="e.g. Denver Distribution Center"
            value={siteName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSiteName(e.target.value)
            }
            required
          />
          <Input
            id="site-address"
            name="address"
            label="Address"
            placeholder="4800 Brighton Blvd"
            value={address}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setAddress(e.target.value)
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="site-city"
              name="city"
              label="City"
              placeholder="Denver"
              value={city}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCity(e.target.value)
              }
            />
            <Input
              id="site-state"
              name="state"
              label="State"
              placeholder="CO"
              value={state}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState(e.target.value)
              }
            />
          </div>
          <Select
            id="site-stage"
            name="pipelineStage"
            label="Pipeline Stage"
            options={SITE_PIPELINE_STAGES.map((s) => ({
              value: s,
              label: formatLabel(s),
            }))}
          />
          <Textarea
            id="site-notes"
            name="notes"
            label="Notes"
            placeholder="Any additional notes about this site..."
            rows={3}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Site"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
