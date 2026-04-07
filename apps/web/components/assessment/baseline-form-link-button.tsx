"use client";

import { useState } from "react";
import { ClipboardList, Copy, Check, Loader2 } from "lucide-react";
import { generateBaselineFormLink } from "../../lib/actions/baseline-form";

interface BaselineFormLinkButtonProps {
  siteId: string;
  tenantId: string;
  assessmentId: string;
}

export function BaselineFormLinkButton({
  siteId,
  tenantId,
  assessmentId,
}: BaselineFormLinkButtonProps) {
  const [state, setState] = useState<"idle" | "generating" | "ready">("idle");
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setState("generating");
    setError(null);

    const result = await generateBaselineFormLink(siteId, tenantId, assessmentId);

    if (result.error) {
      setError(result.error);
      setState("idle");
      return;
    }

    const url = `${window.location.origin}/b/${result.token}`;
    setFormUrl(url);
    setState("ready");
  }

  async function handleCopy() {
    if (!formUrl) return;
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const input = document.createElement("input");
      input.value = formUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (state === "ready" && formUrl) {
    return (
      <div className="inline-flex items-center gap-2">
        <a
          href={formUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ClipboardList className="h-4 w-4" />
          Open Form
        </a>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          title="Copy link to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Link
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleGenerate}
        disabled={state === "generating"}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {state === "generating" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ClipboardList className="h-4 w-4" />
        )}
        {state === "generating" ? "Generating..." : "Baseline Form"}
      </button>
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
