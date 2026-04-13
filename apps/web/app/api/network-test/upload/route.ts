import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Read the body length without buffering the entire thing
  const contentLength = req.headers.get("content-length");
  // Consume the body to ensure transfer completes
  try {
    const body = await req.arrayBuffer();
    return NextResponse.json({ received: body.byteLength }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    // Fallback: use content-length header
    return NextResponse.json({ received: parseInt(contentLength || "0", 10) }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }
}
