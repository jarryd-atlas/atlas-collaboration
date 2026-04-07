// Baseline form page — requires auth via magic link
// Fetches form data by token, shows login if unauthenticated

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getBaselineFormData } from "../../../../lib/actions/baseline-form";
import { FormLogin } from "./_components/form-login";
import { BaselineForm } from "./_components/baseline-form";

interface BaselinePageProps {
  params: Promise<{ token: string }>;
}

export default async function BaselinePage({ params }: BaselinePageProps) {
  const { token } = await params;

  // Load form data (uses admin client — no auth needed for data fetch)
  let data: Awaited<ReturnType<typeof getBaselineFormData>> = null;
  try {
    data = await getBaselineFormData(token);
  } catch {
    // Show not found
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-6">
            <span className="text-sm font-bold text-gray-900">
              ATLAS<span className="text-[#91E100]"> Collaborate</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Form Not Found
          </h1>
          <p className="text-gray-500 max-w-sm">
            This form link may have expired or is incorrect. Please contact your
            CrossnoKaye representative for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Check authentication
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {}, // read-only in server component
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <FormLogin
        token={token}
        siteName={data.context.siteName}
        customerName={data.context.customerName}
      />
    );
  }

  // Look up or create a profile ID for this user
  // For external form users, we use the auth user id as profileId
  const profileId = user.id;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">
            ATLAS<span className="text-[#91E100]"> Collaborate</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{user.email}</span>
            <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-500">
                {(user.email ?? "?").charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-gray-400">
                {data.context.customerName.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.context.customerName}
              </p>
              <p className="text-xs text-gray-500">
                {data.context.siteName}
              </p>
            </div>
          </div>
        </div>

        <BaselineForm
          initialData={data}
          userId={user.id}
          profileId={profileId}
        />
      </main>
    </div>
  );
}
