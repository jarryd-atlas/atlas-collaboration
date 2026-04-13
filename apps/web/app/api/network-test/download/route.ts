import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sizeParam = req.nextUrl.searchParams.get("size");
  // Default 256KB, max 4MB
  const size = Math.min(
    Math.max(parseInt(sizeParam || "262144", 10) || 262144, 1024),
    4 * 1024 * 1024,
  );

  // Create a single 64KB random chunk and repeat it
  const chunkSize = Math.min(size, 65536);
  const chunk = new Uint8Array(chunkSize);
  crypto.getRandomValues(chunk);

  if (size <= chunkSize) {
    return new NextResponse(chunk, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(size),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // Stream repeated chunks for larger sizes
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (sent >= size) {
        controller.close();
        return;
      }
      const remaining = size - sent;
      if (remaining >= chunkSize) {
        controller.enqueue(chunk);
        sent += chunkSize;
      } else {
        controller.enqueue(chunk.slice(0, remaining));
        sent += remaining;
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
