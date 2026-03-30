"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Unlink, Search, ExternalLink, Loader2, FileText } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { linkGoogleDoc } from "../../lib/actions/google-docs";

declare global {
  interface Window {
    google: any;
  }
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
  owners?: { displayName: string }[];
  modifiedTime?: string;
}

interface GoogleDocsLinkerProps {
  siteId: string;
  onLinked: () => void;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_KEY = "gdocs_access_token";

function getStoredToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}

function storeToken(token: string) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}

function clearStoredToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export function GoogleDocsLinker({ siteId, onLinked }: GoogleDocsLinkerProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DriveFile[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [gisReady, setGisReady] = useState(false);
  const tokenClientRef = useRef<any>(null);
  const accessTokenRef = useRef<string>(getStoredToken());
  const pendingSearchRef = useRef<string>("");

  // Load Google Identity Services
  useEffect(() => {
    if (window.google?.accounts?.oauth2) {
      setGisReady(true);
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = () => setGisReady(true);
      document.body.appendChild(script);
    }
  }, []);

  const searchDrive = useCallback(async (query: string, token: string) => {
    if (query.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const mimeFilter = [
        "mimeType='application/vnd.google-apps.document'",
        "mimeType='application/vnd.google-apps.spreadsheet'",
        "mimeType='application/vnd.google-apps.presentation'",
      ].join(" or ");
      const q = `name contains '${query.replace(/'/g, "\\'")}' and (${mimeFilter}) and trashed=false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,iconLink,owners(displayName),modifiedTime)&pageSize=10&orderBy=modifiedTime desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        // Token expired — clear and re-auth on next search
        if (res.status === 401) {
          accessTokenRef.current = "";
          clearStoredToken();
          setError("Session expired. Please search again to re-authorize.");
        }
        setSearchResults([]);
      } else {
        const data = await res.json();
        setSearchResults(data.files ?? []);
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  const ensureToken = useCallback((onToken: (token: string) => void) => {
    if (accessTokenRef.current) {
      onToken(accessTokenRef.current);
      return;
    }

    if (!tokenClientRef.current && gisReady) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            setError(`Google authorization failed: ${response.error}`);
            return;
          }
          accessTokenRef.current = response.access_token;
          storeToken(response.access_token);
          onToken(response.access_token);
        },
        error_callback: (err: any) => {
          if (err?.type === "popup_failed_to_open") {
            setError("Popup blocked — please allow popups and try again.");
          } else if (err?.type !== "popup_closed") {
            setError("Google sign-in was cancelled or failed.");
          }
        },
      });
    }

    tokenClientRef.current?.requestAccessToken({ prompt: "" });
  }, [gisReady]);

  // Debounced search
  useEffect(() => {
    if (!showSearch || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      pendingSearchRef.current = searchQuery;
      ensureToken((token) => {
        // Only run if this is still the latest search
        if (pendingSearchRef.current === searchQuery) {
          searchDrive(searchQuery, token);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, ensureToken, searchDrive]);

  async function handleLink(file: DriveFile) {
    setLinking(true);
    setError("");
    const result = await linkGoogleDoc(siteId, {
      google_file_id: file.id,
      title: file.name,
      mime_type: file.mimeType,
      google_url: file.webViewLink,
      icon_url: file.iconLink ?? null,
    });

    if ("error" in result) {
      setError(result.error);
    } else {
      onLinked();
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    }
    setLinking(false);
  }

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div>
      {showSearch ? (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg max-w-sm space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Google Drive..."
              className="pl-8 text-sm h-8"
            />
          </div>
          {searching && <p className="text-xs text-gray-400">Searching...</p>}
          {searchResults.length > 0 && (
            <div className="border rounded max-h-52 overflow-y-auto divide-y text-sm">
              {searchResults.map((file) => {
                const owner = file.owners?.[0]?.displayName;
                const modified = file.modifiedTime
                  ? formatRelativeDate(file.modifiedTime)
                  : null;
                return (
                  <button
                    key={file.id}
                    className="w-full text-left px-2.5 py-2 hover:bg-gray-50 disabled:opacity-50 flex items-start gap-2"
                    onClick={() => handleLink(file)}
                    disabled={linking}
                  >
                    <DocTypeIcon mimeType={file.mimeType} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 break-words line-clamp-2">{file.name}</span>
                      {(owner || modified) && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {owner}{owner && modified ? " · " : ""}{modified}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium flex-shrink-0 rounded-full px-1.5 py-0.5 mt-0.5 ${getDocTypeBadgeColor(file.mimeType)}`}>
                      {getDocTypeLabel(file.mimeType)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); setError(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowSearch(true); setError(""); }}
          disabled={!gisReady}
          className="text-xs"
        >
          <Link2 className="h-3.5 w-3.5 mr-1" />
          Link Doc
        </Button>
      )}
    </div>
  );
}

// Keep old export name for backwards compatibility
export { GoogleDocsLinker as GoogleDocsPicker };

// ─── Helpers ────────────────────────────────────

function getDocTypeLabel(mimeType: string): string {
  if (mimeType.includes("document")) return "Doc";
  if (mimeType.includes("spreadsheet")) return "Sheet";
  if (mimeType.includes("presentation")) return "Slides";
  return "File";
}

function getDocTypeBadgeColor(mimeType: string): string {
  if (mimeType.includes("document")) return "bg-blue-50 text-blue-700";
  if (mimeType.includes("spreadsheet")) return "bg-green-50 text-green-700";
  if (mimeType.includes("presentation")) return "bg-yellow-50 text-yellow-700";
  return "bg-gray-50 text-gray-700";
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function DocTypeIcon({ mimeType }: { mimeType: string }) {
  const cls = "h-4 w-4 flex-shrink-0";
  if (mimeType.includes("document")) {
    return (
      <svg className={cls} viewBox="0 0 24 24">
        <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#4285F4" d="M8 12h8v1.5H8zm0 3h8v1.5H8zm0-6h5v1.5H8z" />
      </svg>
    );
  }
  if (mimeType.includes("spreadsheet")) {
    return (
      <svg className={cls} viewBox="0 0 24 24">
        <path fill="#0F9D58" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#0F9D58" d="M8 12h3v2H8zm0 3h3v2H8zm4-3h4v2h-4zm0 3h4v2h-4z" />
      </svg>
    );
  }
  if (mimeType.includes("presentation")) {
    return (
      <svg className={cls} viewBox="0 0 24 24">
        <path fill="#F4B400" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#F4B400" d="M8 11h8v6H8z" />
      </svg>
    );
  }
  return <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />;
}
