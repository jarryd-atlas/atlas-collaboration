"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface FormLoginProps {
  token: string;
  siteName: string;
  customerName: string;
}

export function FormLogin({ token, siteName, customerName }: FormLoginProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.href,
        },
      });

      if (otpError) {
        setError(otpError.message);
        setSending(false);
        return;
      }

      setSent(true);
      setSending(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-lg font-bold text-gray-900">
            ATLAS<span className="text-[#91E100]"> Collaborate</span>
          </span>
          <p className="text-xs text-gray-400 mt-1">CrossnoKaye</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 sm:p-8">
          {/* Customer/site info */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-gray-400">
                {customerName.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {customerName}
              </p>
              <p className="text-xs text-gray-500">{siteName}</p>
            </div>
          </div>

          {sent ? (
            /* Confirmation state */
            <div className="text-center py-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                Check your email
              </h2>
              <p className="text-sm text-gray-500 mb-1">
                We sent a login link to{" "}
                <span className="font-medium text-gray-700">{email}</span>
              </p>
              <p className="text-xs text-gray-400">
                The link expires in 1 hour.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* Login form */
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                Sign in to continue
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                You&apos;ve been invited to help us collect baseline data for{" "}
                <span className="font-medium text-gray-700">{siteName}</span>.
                Enter your email to receive a secure login link.
              </p>

              <form onSubmit={handleSubmit}>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none transition-colors"
                />

                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="mt-4 w-full rounded-lg bg-[#91E100] px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-[#91E100]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    "Send Magic Link"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by CrossnoKaye
        </p>
      </div>
    </div>
  );
}
