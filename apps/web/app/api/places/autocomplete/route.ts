import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input");
  if (!input) return NextResponse.json({ predictions: [] });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ predictions: [], error: "No API key" });

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input);
    url.searchParams.set("types", "establishment");
    url.searchParams.set("components", "country:us|country:ca");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    return NextResponse.json({
      predictions: (data.predictions ?? []).map((p: Record<string, unknown>) => ({
        place_id: p.place_id,
        description: p.description,
        structured_formatting: p.structured_formatting,
      })),
    });
  } catch {
    return NextResponse.json({ predictions: [] });
  }
}
