import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-dark items-center justify-center p-12">
        <div className="max-w-md text-white">
          <h1 className="text-4xl font-bold mb-4">
            ATLAS<span className="text-brand-neon"> Collaborate</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Streamline customer communication across your entire ATLAS Platform portfolio.
          </p>
        </div>
      </div>

      {/* Right: auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <LoginForm searchParams={searchParams} />
      </div>
    </div>
  );
}
