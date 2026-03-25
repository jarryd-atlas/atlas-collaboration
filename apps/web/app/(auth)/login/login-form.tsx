"use client";

import { useState, use } from "react";
import { getSupabaseBrowser } from "../../../lib/supabase/browser";
import { Mail, ArrowRight, CheckCircle } from "lucide-react";

interface LoginFormProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

export function LoginForm({ searchParams }: LoginFormProps) {
  const params = use(searchParams);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(
    params.error === "auth_callback_failed"
      ? "Authentication failed. Please try again."
      : (params.error ?? "")
  );
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
        queryParams: {
          hd: "crossnokaye.com",
          access_type: "offline",
          prompt: "consent",
        },
        scopes: "https://www.googleapis.com/auth/drive.readonly",
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMagicLinkSent(true);
      setMagicLinkEmail(email.trim());
    }
  }

  // ─── Magic link sent confirmation ─────────────────────

  if (magicLinkSent) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h2>
        <p className="text-gray-500 mb-2">
          We sent a sign-in link to
        </p>
        <p className="text-lg font-medium text-gray-900 mb-6">{magicLinkEmail}</p>
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500">
            Click the link in the email to sign in. It expires in 1 hour.
            Check your spam folder if you don&apos;t see it.
          </p>
        </div>
        <button
          onClick={() => { setMagicLinkSent(false); setEmail(""); }}
          className="text-sm text-brand-green font-medium hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  // ─── Main login form ──────────────────────────────────

  return (
    <div className="w-full max-w-md">
      {/* Mobile logo */}
      <div className="lg:hidden mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          ATLAS<span className="text-brand-green"> Collaborate</span>
        </h1>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
      <p className="text-gray-500 mb-8">
        Sign in to access your project portal
      </p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Magic Link (primary) ─────────────────────── */}
      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3.5 text-sm focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            "Sending link..."
          ) : (
            <>
              Send sign-in link
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-3 text-center text-xs text-gray-400">
        We&apos;ll email you a secure link — no password needed.
      </p>

      {/* ── Divider ──────────────────────────────────── */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-gray-50 px-3 text-gray-400">CrossnoKaye team</span>
        </div>
      </div>

      {/* ── Google OAuth (secondary, CK only) ────────── */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
