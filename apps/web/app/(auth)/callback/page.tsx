"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "../../../lib/supabase/browser";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    async function handleAuth() {
      const supabase = getSupabaseBrowser();

      // PKCE flow: exchange the code from the URL query params
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Code exchange failed:", error.message);
          setStatus(`Sign in failed: ${error.message}`);
          setTimeout(() => router.push("/login?error=auth_callback_failed"), 3000);
          return;
        }
        // Success — redirect to app
        router.push(searchParams.get("redirect") || "/");
        return;
      }

      // Hash fragment flow (implicit grant / magic link with token)
      // The Supabase client auto-detects tokens in the hash
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session) {
        router.push(searchParams.get("redirect") || "/");
        return;
      }

      if (error) {
        console.error("Session error:", error.message);
      }

      // No code and no session — check URL hash for tokens
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        // Wait for Supabase to process the hash
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session: s2 } } = await supabase.auth.getSession();
        if (s2) {
          router.push(searchParams.get("redirect") || "/");
          return;
        }
      }

      setStatus("Authentication failed. Redirecting to login...");
      setTimeout(() => router.push("/login?error=auth_callback_failed"), 2000);
    }

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="text-center">
      <div className="animate-spin h-8 w-8 border-4 border-brand-green border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-sm text-gray-500">{status}</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
