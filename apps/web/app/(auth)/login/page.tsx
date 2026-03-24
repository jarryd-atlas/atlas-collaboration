import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel — customer-focused messaging */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-dark items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-brand-neon blur-3xl" />
          <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-brand-neon blur-3xl" />
        </div>

        <div className="max-w-md text-white relative z-10">
          <h1 className="text-4xl font-bold mb-4">
            ATLAS<span className="text-brand-neon"> Collaborate</span>
          </h1>
          <p className="text-gray-300 text-lg mb-8">
            Your real-time window into energy optimization progress, savings tracking, and project milestones.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-brand-neon/20 flex items-center justify-center flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-brand-neon" />
              </div>
              <div>
                <p className="text-white font-medium">Track project milestones</p>
                <p className="text-gray-400 text-sm">See exactly where your ATLAS deployment stands</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-brand-neon/20 flex items-center justify-center flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-brand-neon" />
              </div>
              <div>
                <p className="text-white font-medium">Review energy savings</p>
                <p className="text-gray-400 text-sm">Access reports showing your kWh and demand reductions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-brand-neon/20 flex items-center justify-center flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-brand-neon" />
              </div>
              <div>
                <p className="text-white font-medium">Collaborate with your CK team</p>
                <p className="text-gray-400 text-sm">Share documents, flag issues, and stay aligned</p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-500">Powered by CrossnoKaye</p>
          </div>
        </div>
      </div>

      {/* Right: auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <LoginForm searchParams={searchParams} />
      </div>
    </div>
  );
}
