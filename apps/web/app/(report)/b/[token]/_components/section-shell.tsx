"use client";

import type { ReactNode } from "react";
import { Button } from "../../../../../components/ui/button";

interface SectionShellProps {
  title: string;
  description: string;
  onNext: () => void;
  onBack: () => void;
  isFirst: boolean;
  isLast: boolean;
  children: ReactNode;
}

export function SectionShell({
  title,
  description,
  onNext,
  onBack,
  isFirst,
  isLast,
  children,
}: SectionShellProps) {
  return (
    <div className="animate-fadeSlideIn">
      {/* Section header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>

      {/* Section content */}
      <div className="space-y-6">{children}</div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
        {!isFirst ? (
          <Button type="button" variant="outline" onClick={onBack}>
            <svg
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            Back
          </Button>
        ) : (
          <div />
        )}

        <Button type="button" variant="primary" onClick={onNext}>
          {isLast ? "Review & Submit" : "Continue"}
          {!isLast && (
            <svg
              className="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          )}
        </Button>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeSlideIn {
          animation: fadeSlideIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
