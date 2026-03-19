import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("place_id");
  if (!placeId) return NextResponse.json({ details: null });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ details: null, error: "No API key" });

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "name,formatted_address,address_components,geometry");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();
    const result = data.result;

    if (!result) return NextResponse.json({ details: null });

    // Parse address components
    const components = result.address_components ?? [];
    function getComponent(type: string): string {
      const c = components.find((c: { types: string[] }) => c.types.includes(type));
      return c?.short_name ?? c?.long_name ?? "";
    }

    const details = {
      name: result.name ?? "",
      address: result.formatted_address ?? "",
      city: getComponent("locality") || getComponent("sublocality") || getComponent("administrative_area_level_2"),
      state: getComponent("administrative_area_level_1"),
      zip: getComponent("postal_code"),
      lat: result.geometry?.location?.lat ?? 0,
      lng: result.geometry?.location?.lng ?? 0,
    };

    return NextResponse.json({ details });
  } catch {
    return NextResponse.json({ details: null });
  }
}
