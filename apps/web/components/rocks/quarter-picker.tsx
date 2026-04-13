"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface QuarterPickerProps {
  year: number;
  quarter: number;
}

export function QuarterPicker({ year, quarter }: QuarterPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (y: number, q: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(y));
      params.set("quarter", String(q));
      router.push(`/rocks?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handlePrevYear = () => navigate(year - 1, quarter);
  const handleNextYear = () => navigate(year + 1, quarter);

  return (
    <div className="flex items-center gap-3">
      {/* Year navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrevYear}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-gray-900 min-w-[3rem] text-center">
          {year}
        </span>
        <button
          onClick={handleNextYear}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Quarter buttons */}
      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
        {[1, 2, 3, 4].map((q) => (
          <button
            key={q}
            onClick={() => navigate(year, q)}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
              quarter === q
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            Q{q}
          </button>
        ))}
      </div>
    </div>
  );
}
