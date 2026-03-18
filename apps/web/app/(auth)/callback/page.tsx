"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../../../lib/supabase/browser";

function CallbackHandler() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    async function handleAuth() {
      const supabase = getSupabaseBrowser();

      // With implicit flow, Supabase auto-detects tokens in the URL hash.
      // The onAuthStateChange listener fires when a session is established.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === "SIGNED_IN" && session) {
            subscription.unsubscribe();
            router.push("/");
          }
        },
      );

      // Also check if session already exists (e.g. magic link click)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        subscription.unsubscribe();
        router.push("/");
        return;
      }

      // Give Supabase time to process the hash fragment
      setTimeout(async () => {
        const { data: { session: s2 } } = await supabase.auth.getSession();
        if (s2) {
          subscription.unsubscribe();
          router.push("/");
          return;
        }
        // Check for error in URL
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        const errorMsg = params.get("error_description") ||
                         (hash.includes("error") ? "Authentication error" : null);
        if (errorMsg) {
          console.error("Auth callback error:", errorMsg);
          setStatus(`Sign in failed. Redirecting...`);
        } else {
          setStatus("No session found. Redirecting...");
        }
        setTimeout(() => router.push("/login?error=auth_callback_failed"), 2000);
      }, 3000);
    }

    handleAuth();
  }, [router]);

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
