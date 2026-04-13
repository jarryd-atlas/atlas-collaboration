"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Check, X, Loader2 } from "lucide-react";
import { updateSiteAddress } from "../../lib/actions";

interface EditableSiteAddressProps {
  siteId: string;
  address: string | null;
  city: string | null;
  state: string | null;
}

export function EditableSiteAddress({
  siteId,
  address,
  city,
  state,
}: EditableSiteAddressProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAddress, setEditAddress] = useState(address ?? "");
  const [editCity, setEditCity] = useState(city ?? "");
  const [editState, setEditState] = useState(state ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const displayAddress = [address, city, state].filter(Boolean).join(", ");

  function handleEdit() {
    setEditAddress(address ?? "");
    setEditCity(city ?? "");
    setEditState(state ?? "");
    setError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setError(null);
  }

  function handleSave() {
    if (!editCity.trim()) {
      setError("City is required");
      return;
    }

    startTransition(async () => {
      const result = await updateSiteAddress(
        siteId,
        editAddress.trim(),
        editCity.trim(),
        editState.trim()
      );
      if (result && "error" in result) {
        setError(result.error ?? "An error occurred");
      } else {
        setIsEditing(false);
        setError(null);
        router.refresh();
      }
    });
  }

  if (isEditing) {
    return (
      <div className="mt-1">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-gray-400 mt-2 shrink-0" />
          <div className="space-y-2 flex-1 max-w-md">
            <input
              type="text"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="Street address"
              className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-green"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="City"
                className="flex-1 text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
              <input
                type="text"
                value={editState}
                onChange={(e) => setEditState(e.target.value)}
                placeholder="State"
                className="w-20 text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md bg-gray-900 text-white px-2.5 py-1 text-xs font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group mt-1">
      <button
        type="button"
        onClick={handleEdit}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
        title="Edit address"
      >
        <MapPin className="h-4 w-4" />
        <span>{displayAddress || "Add address"}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
      </button>
    </div>
  );
}
