import { redirect } from "next/navigation";

interface EditReportPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function EditReportPage({ params }: EditReportPageProps) {
  const { reportId } = await params;
  redirect(`/reports/${reportId}`);
}
