import type { ReactNode } from "react";

// Standalone report layout — no sidebar, no app shell, no auth
export default function ReportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
