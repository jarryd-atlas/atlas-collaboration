"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "../forms/address-autocomplete";
import { updateCustomer } from "../../lib/actions/customers";
import { MapPin, X } from "lucide-react";

interface EditHQInlineProps {
  customerId: string;
  currentHQ: {
    hq_address?: string | null;
    hq_city?: string | null;
    hq_state?: string | null;
    hq_zip?: string | null;
    hq_latitude?: number | null;
    hq_longitude?: number | null;
  };
  customerName: string;
  onClose: () => void;
}

export function EditHQInline({ customerId, currentHQ, customerName, onClose }: EditHQInlineProps) {
  const [selected, setSelected] = useState<{
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const currentLocation = [currentHQ.hq_city, currentHQ.hq_state].filter(Boolean).join(", ");

  function handleSave() {
    if (!selected) return;
    setError(null);

    const formData = new FormData();
    formData.set("name", customerName);
    formData.set("hqAddress", selected.address);
    formData.set("hqCity", selected.city);
    formData.set("hqState", selected.state);
    formData.set("hqZip", selected.zip);
    formData.set("hqLatitude", String(selected.lat));
    formData.set("hqLongitude", String(selected.lng));

    startTransition(async () => {
      const result = await updateCustomer(customerId, formData);
      if (result && "error" in result) {
        setError(result.error ?? "Failed to update HQ");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function handleClear() {
    setError(null);
    const formData = new FormData();
    formData.set("name", customerName);
    formData.set("hqAddress", "");
    formData.set("hqCity", "");
    formData.set("hqState", "");
    formData.set("hqZip", "");

    startTransition(async () => {
      const result = await updateCustomer(customerId, formData);
      if (result && "error" in result) {
        setError(result.error ?? "Failed to clear HQ");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          {currentLocation ? "Edit Headquarters" : "Set Headquarters"}
        </h4>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-gray-200 text-gray-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {currentLocation && (
        <p className="text-xs text-gray-500">
          Current: <span className="font-medium">{currentHQ.hq_address || currentLocation}</span>
        </p>
      )}

      <AddressAutocomplete
        onSelect={(details) => {
          setSelected({
            address: details.address,
            city: details.city,
            state: details.state,
            zip: details.zip,
            lat: details.lat,
            lng: details.lng,
          });
        }}
        placeholder="Search for headquarters address..."
      />

      {selected && (
        <p className="text-xs text-green-600">
          Selected: {selected.address}, {selected.city}, {selected.state} {selected.zip}
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!selected || isPending}
          className="px-3 py-1.5 text-xs font-medium text-white bg-brand-green rounded-md hover:bg-brand-green/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        {currentLocation && (
          <button
            onClick={handleClear}
            disabled={isPending}
            className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 ml-auto disabled:opacity-50"
          >
            Remove HQ
          </button>
        )}
      </div>
    </div>
  );
}
