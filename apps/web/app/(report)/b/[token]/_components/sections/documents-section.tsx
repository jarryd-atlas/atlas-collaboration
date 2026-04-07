"use client";

import type {
  BaselineFormState,
  BaselineFormAction,
} from "../../../../../../lib/baseline-form/types";
import { Button } from "../../../../../../components/ui/button";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
  attachments?: Array<{
    id: string;
    file_name: string;
    category: string | null;
    created_at: string;
  }>;
}

export function DocumentsSection({ state, dispatch, token, profileId, attachments = [] }: SectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
        <p className="text-sm text-gray-500 mt-1">
          Review documents that have been shared for this site, or upload your own.
        </p>
      </div>

      {/* Existing Attachments */}
      {attachments.length > 0 ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">File Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((attachment) => (
                <tr key={attachment.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-gray-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="text-gray-900">{attachment.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {attachment.category
                      ? attachment.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                      : "Uncategorized"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(attachment.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <svg
            className="w-10 h-10 text-gray-300 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-gray-500">No documents have been uploaded yet</p>
        </div>
      )}

      {/* Upload Button (placeholder) */}
      <div className="space-y-3">
        <Button
          variant="outline"
          size="md"
          type="button"
          disabled
          className="opacity-60 cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload Document
        </Button>
        <p className="text-xs text-gray-400">
          Full document upload coming soon. For now, please email documents to your CrossnoKaye
          representative.
        </p>
      </div>
    </div>
  );
}
