export default function WelcomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <svg className="h-8 w-8 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to ATLAS Collaborate
        </h1>
        <p className="text-gray-500 mb-8">
          You&apos;re all set. Here&apos;s a quick overview of what you can do.
        </p>

        <div className="space-y-4 text-left mb-8">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 mt-1 h-6 w-6 rounded-full bg-brand-green/20 flex items-center justify-center text-xs font-bold text-brand-dark">1</div>
            <div>
              <p className="font-medium text-gray-900">Explore your sites</p>
              <p className="text-sm text-gray-500">View milestones, tasks, and progress for each facility.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 mt-1 h-6 w-6 rounded-full bg-brand-green/20 flex items-center justify-center text-xs font-bold text-brand-dark">2</div>
            <div>
              <p className="font-medium text-gray-900">Read status reports</p>
              <p className="text-sm text-gray-500">Stay updated with auto-generated progress reports.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 mt-1 h-6 w-6 rounded-full bg-brand-green/20 flex items-center justify-center text-xs font-bold text-brand-dark">3</div>
            <div>
              <p className="font-medium text-gray-900">Collaborate with your team</p>
              <p className="text-sm text-gray-500">Comment on milestones and tasks, upload documents.</p>
            </div>
          </div>
        </div>

        <a
          href="/"
          className="inline-flex rounded-lg bg-brand-green px-6 py-3 text-sm font-semibold text-brand-dark hover:bg-brand-green/90 transition-colors"
        >
          Get started
        </a>
      </div>
    </div>
  );
}
