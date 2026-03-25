"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { linkGoogleDoc } from "../../lib/actions/google-docs";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface GoogleDocsPickerProps {
  siteId: string;
  onLinked: () => void;
}

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleDocsPicker({ siteId, onLinked }: GoogleDocsPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pickerLoaded, setPickerLoaded] = useState(false);

  // Load Google Picker API script
  useEffect(() => {
    if (window.gapi) {
      setPickerLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      window.gapi.load("picker", () => {
        setPickerLoaded(true);
      });
    };
    document.body.appendChild(script);
  }, []);

  const openPicker = useCallback(async () => {
    if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID) {
      setError("Google API keys not configured. Contact your administrator.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get OAuth token from our API
      const tokenRes = await fetch("/api/google/token");
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        setError(err.error ?? "Failed to get Google token. Please sign in with Google.");
        setLoading(false);
        return;
      }
      const { token } = await tokenRes.json();

      // Build and show picker
      const docsView = new window.google.picker.DocsView()
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)
        .setMimeTypes(
          "application/vnd.google-apps.document," +
          "application/vnd.google-apps.spreadsheet," +
          "application/vnd.google-apps.presentation"
        );

      const picker = new window.google.picker.PickerBuilder()
        .setDeveloperKey(GOOGLE_API_KEY)
        .setOAuthToken(token)
        .setAppId(GOOGLE_CLIENT_ID.split("-")[0]) // Project number from client ID
        .addView(docsView)
        .addView(new window.google.picker.DocsView().setIncludeFolders(true))
        .setCallback(async (data: any) => {
          if (data.action === "picked") {
            const file = data.docs[0];
            if (file) {
              const result = await linkGoogleDoc(siteId, {
                google_file_id: file.id,
                title: file.name,
                mime_type: file.mimeType,
                google_url: file.url,
                thumbnail_url: file.iconUrl ?? null,
                icon_url: file.iconUrl ?? null,
              });

              if ("error" in result) {
                setError(result.error);
              } else {
                onLinked();
              }
            }
          }
          setLoading(false);
        })
        .setTitle("Link a Google Doc to this site")
        .setSize(900, 600)
        .build();

      picker.setVisible(true);
    } catch (err) {
      setError("Failed to open Google Picker. Please try again.");
      setLoading(false);
    }
  }, [siteId, onLinked]);

  if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID) {
    return null; // Hide picker if not configured
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={openPicker}
        disabled={loading || !pickerLoaded}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-1.5" />
        )}
        Link Google Doc
      </Button>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
