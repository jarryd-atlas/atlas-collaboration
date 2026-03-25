import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "../../../../lib/actions/google-tokens";

/**
 * GET /api/google/token
 * Returns a valid Google access token for the current user.
 * Used by the client-side Google Picker component.
 */
export async function GET() {
  const result = await getGoogleAccessToken();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({ token: result.token });
}
