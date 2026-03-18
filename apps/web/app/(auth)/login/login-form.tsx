"use client";

import { useState, use } from "react";
import { signInWithGoogle, signInWithMagicLink } from "../../../lib/actions";

interface LoginFormProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

export function LoginForm({ searchParams }: LoginFormProps) {
  const params = use(searchParams);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [error, setError] = useState(params.error ?? "");

  async function handleGoogleSignIn() {
    setError("");
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      window.location.href = result.url;
    }
  }

  async function handleMagicLink(formData: FormData) {
    try {
      const result = await signInWithMagicLink(formData);
      if (result.success) {
        setMagicLinkSent(true);
        setMagicLinkEmail(result.email);
      }
    } catch {
      setError("Failed to send magic link. Please try again.");
    }
  }

  if (magicLinkSent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 text-4xl">📧</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-500 mb-6">
          We sent a magic link to <strong>{magicLinkEmail}</strong>
        </p>
        <p className="text-sm text-gray-400">
          Click the link in the email to sign in. The link expires in 1 hour.
        </p>
        <button
          onClick={() => setMagicLinkSent(false)}
          className="mt-6 text-sm text-brand-green font-medium hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h2>
      <p className="text-gray-500 mb-8">
        Choose your sign-in method below
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error === "auth_callback_failed"
            ? "Authentication failed. Please try again."
            : error}
        </div>
      )}

      {/* Google OAuth for CK team */}
      <form action={handleGoogleSignIn}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">or</span>
        </div>
      </div>

      {/* Magic link for customers */}
      <form action={handleMagicLink}>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="you@company.com"
          required
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none transition-colors"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-lg bg-brand-green px-4 py-3 text-sm font-semibold text-brand-dark hover:bg-brand-green/90 transition-colors"
        >
          Send magic link
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-400">
        CrossnoKaye team members sign in with Google.
        <br />
        Customers use the magic link option.
      </p>
    </div>
  );
}
