"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const next = searchParams.get("redirect") || "/";
        router.push(next);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const next = searchParams.get("redirect") || "/";
        router.push(next);
      } else {
        setTimeout(() => {
          setStatus("Authentication failed. Redirecting to login...");
          setTimeout(() => router.push("/login?error=auth_callback_failed"), 2000);
        }, 3000);
      }
    });
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
