"use client";

import {
  BASELINE_FORM_SECTIONS,
  SECTION_LABELS,
} from "../../../../../lib/baseline-form/types";

interface FormProgressProps {
  currentSection: number;
  completions: Record<string, number>;
  onNavigate: (index: number) => void;
}

export function FormProgress({
  currentSection,
  completions,
  onNavigate,
}: FormProgressProps) {
  return (
    <div className="mb-8">
      {/* Desktop: full bar with labels */}
      <div className="hidden sm:block">
        <div className="relative flex items-start justify-between">
          {/* Connecting line */}
          <div className="absolute top-3 left-3 right-3 h-0.5 bg-gray-100" />
          <div
            className="absolute top-3 left-3 h-0.5 bg-[#91E100] transition-all duration-300"
            style={{
              width: `${(currentSection / (BASELINE_FORM_SECTIONS.length - 1)) * 100}%`,
              maxWidth: "calc(100% - 24px)",
            }}
          />

          {BASELINE_FORM_SECTIONS.map((section, index) => {
            const completion = completions[section] ?? 0;
            const isCurrent = index === currentSection;
            const isComplete = completion === 100;
            const isPast = index < currentSection;

            return (
              <button
                key={section}
                type="button"
                onClick={() => onNavigate(index)}
                className="relative flex flex-col items-center gap-1.5 group z-10"
                style={{ width: `${100 / BASELINE_FORM_SECTIONS.length}%` }}
              >
                {/* Dot with completion ring */}
                <div className="relative h-6 w-6 flex items-center justify-center">
                  {/* Background ring showing completion */}
                  <svg
                    className="absolute inset-0 h-6 w-6 -rotate-90"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="#f3f4f6"
                      strokeWidth="2"
                    />
                    {completion > 0 && completion < 100 && (
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="#91E100"
                        strokeWidth="2"
                        strokeDasharray={`${(completion / 100) * 62.83} 62.83`}
                        strokeLinecap="round"
                      />
                    )}
                  </svg>

                  {/* Inner dot or checkmark */}
                  {isComplete ? (
                    <div className="h-6 w-6 rounded-full bg-[#91E100] flex items-center justify-center">
                      <svg
                        className="h-3.5 w-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={3}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className={`h-3 w-3 rounded-full transition-colors ${
                        isCurrent
                          ? "bg-[#91E100]"
                          : isPast
                            ? "bg-[#91E100]/50"
                            : "bg-gray-200 group-hover:bg-gray-300"
                      }`}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] leading-tight text-center transition-colors ${
                    isCurrent
                      ? "text-gray-900 font-semibold"
                      : "text-gray-400 group-hover:text-gray-600"
                  }`}
                >
                  {SECTION_LABELS[section]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: compact dots only */}
      <div className="sm:hidden">
        <div className="flex items-center justify-center gap-1.5">
          {BASELINE_FORM_SECTIONS.map((section, index) => {
            const completion = completions[section] ?? 0;
            const isCurrent = index === currentSection;
            const isComplete = completion === 100;

            return (
              <button
                key={section}
                type="button"
                onClick={() => onNavigate(index)}
                className="relative h-6 w-6 flex items-center justify-center"
              >
                {isComplete ? (
                  <div className="h-5 w-5 rounded-full bg-[#91E100] flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </div>
                ) : (
                  <div
                    className={`rounded-full transition-all ${
                      isCurrent
                        ? "h-3 w-3 bg-[#91E100]"
                        : "h-2 w-2 bg-gray-200"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Current section label on mobile */}
        <p className="text-center text-xs text-gray-500 mt-2">
          <span className="font-medium text-gray-900">
            {SECTION_LABELS[BASELINE_FORM_SECTIONS[currentSection]!]}
          </span>
          <span className="text-gray-300 mx-1.5">&middot;</span>
          Step {currentSection + 1} of {BASELINE_FORM_SECTIONS.length}
        </p>
      </div>
    </div>
  );
}
