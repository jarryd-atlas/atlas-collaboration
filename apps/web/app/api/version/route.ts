import { NextResponse } from "next/server";

/**
 * GET /api/version
 * Returns the current build ID so clients can detect when a new deploy happened.
 */
export async function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown" },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  );
}
