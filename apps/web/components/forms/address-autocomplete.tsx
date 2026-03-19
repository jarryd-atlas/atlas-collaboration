"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  onSelect: (details: PlaceDetails) => void;
  placeholder?: string;
}

export function AddressAutocomplete({
  onSelect,
  placeholder = "Search for a facility... e.g. Americold Ontario",
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  // Debounced search
  const search = useCallback(
    async (input: string) => {
      if (!input || input.length < 3 || !apiKey) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(input)}`,
        );
        const data = await res.json();
        setPredictions(data.predictions ?? []);
        setIsOpen((data.predictions ?? []).length > 0);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    },
    [apiKey],
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setSelectedText("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  async function handleSelect(prediction: PlacePrediction) {
    setIsOpen(false);
    setSelectedText(prediction.description);
    setQuery(prediction.description);

    // Fetch place details
    try {
      const res = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(prediction.place_id)}`,
      );
      const data = await res.json();
      if (data.details) {
        onSelect(data.details);
      }
    } catch {
      // Fallback: parse from description
      onSelect({
        name: prediction.structured_formatting.main_text,
        address: prediction.description,
        city: "",
        state: "",
        zip: "",
        lat: 0,
        lng: 0,
      });
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Search Location
      </label>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={selectedText || query}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-green" />
          </div>
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
        >
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => handleSelect(p)}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {p.structured_formatting.main_text}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {p.structured_formatting.secondary_text}
                </p>
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
