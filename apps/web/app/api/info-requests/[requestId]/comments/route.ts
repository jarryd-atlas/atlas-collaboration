import { NextRequest, NextResponse } from "next/server";
import { getCommentsForInfoRequest } from "../../../../../lib/data/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  if (!requestId) {
    return NextResponse.json({ comments: [] }, { status: 400 });
  }

  const comments = await getCommentsForInfoRequest(requestId);
  return NextResponse.json({ comments });
}
