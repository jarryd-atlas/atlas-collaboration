import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Cloudflare Workers exposes geo data via cf object and headers
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";

  // Cloudflare geo headers (populated automatically on Workers)
  const city = req.headers.get("cf-ipcity") || "";
  const region = req.headers.get("cf-ipregion") || req.headers.get("cf-region") || "";
  const country = req.headers.get("cf-ipcountry") || "";
  const timezone = req.headers.get("cf-timezone") || "";
  const asn = req.headers.get("cf-ipasn") || "";
  const asOrg = req.headers.get("cf-ipas-org") || req.headers.get("cf-isp") || "";

  // Also try the cf object if available (Cloudflare Workers runtime)
  const cf = (req as any).cf as Record<string, unknown> | undefined;

  return NextResponse.json({
    ip,
    city: city || (cf?.city as string) || "",
    region: region || (cf?.region as string) || "",
    country: country || (cf?.country as string) || "",
    timezone: timezone || (cf?.timezone as string) || "",
    asn: asn || (cf?.asn ? String(cf.asn) : ""),
    isp: asOrg || (cf?.asOrganization as string) || "",
    colo: (cf?.colo as string) || "",
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
