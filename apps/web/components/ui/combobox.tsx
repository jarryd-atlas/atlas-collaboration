"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  /** Optional group name for grouped rendering */
  group?: string;
}

interface ComboboxProps {
  id?: string;
  label?: string;
  placeholder?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Allow clearing the selection */
  clearable?: boolean;
  className?: string;
}

export function Combobox({
  id,
  label,
  placeholder = "Search...",
  options,
  value,
  onChange,
  clearable = true,
  className,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase())),
      )
    : options;

  // Group filtered options if any have a group field
  const hasGroups = filtered.some((o) => o.group);
  const groups: { name: string | null; options: ComboboxOption[] }[] = [];
  if (hasGroups) {
    const groupMap = new Map<string | null, ComboboxOption[]>();
    for (const opt of filtered) {
      const g = opt.group ?? null;
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push(opt);
    }
    for (const [name, opts] of groupMap) {
      groups.push({ name, options: opts });
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  function handleOpen() {
    setIsOpen(true);
    setQuery("");
    // Focus the input after opening
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger button */}
      {!isOpen ? (
        <button
          type="button"
          id={id}
          onClick={handleOpen}
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-left",
            "hover:border-gray-300 transition-colors bg-white",
            !selectedOption && "text-gray-400",
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && selectedOption && (
              <span
                role="button"
                onClick={handleClear}
                className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
        </button>
      ) : (
        <div className="w-full flex items-center gap-2 rounded-lg border border-brand-green ring-1 ring-brand-green px-3 py-2 bg-white">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
            autoComplete="off"
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-sm text-gray-400 text-center">
              No results found
            </div>
          ) : hasGroups ? (
            groups.map((group, idx) => (
              <div key={group.name ?? "ungrouped"}>
                {group.name && (
                  <div className={cn(
                    "px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50",
                    idx > 0 && "border-t border-gray-100",
                  )}>
                    {group.name}
                  </div>
                )}
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                      option.value === value && "bg-brand-green/5 text-gray-900 font-medium",
                    )}
                  >
                    <span className="block truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="block text-xs text-gray-400 truncate">{option.sublabel}</span>
                    )}
                  </button>
                ))}
              </div>
            ))
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors",
                  option.value === value && "bg-brand-green/5 text-gray-900 font-medium",
                )}
              >
                <span className="block truncate">{option.label}</span>
                {option.sublabel && (
                  <span className="block text-xs text-gray-400 truncate">{option.sublabel}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
