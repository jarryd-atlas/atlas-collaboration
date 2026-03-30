import { requireSession } from "../../../../lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchAllFeedback } from "../../../../lib/actions/feedback";
import { FeedbackList } from "./_components/feedback-list";

export default async function AdminFeedbackPage() {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
    redirect("/");
  }

  const { feedback, error } = await fetchAllFeedback();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review feedback submitted by your team.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <FeedbackList initialFeedback={feedback} />
    </div>
  );
}
