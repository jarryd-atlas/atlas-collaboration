export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-50">
          <svg className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Approval</h1>
        <p className="text-gray-500 mb-6">
          Your account is waiting for approval from the CrossnoKaye team.
          You&apos;ll receive an email once your access has been granted.
        </p>
        <a
          href="/login"
          className="text-sm font-medium text-brand-green hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
