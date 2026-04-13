/**
 * Server-side geocoding via Google Geocoding API.
 * Works in Cloudflare Workers (plain fetch, no Node.js APIs).
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(
  address: string,
  city?: string | null,
  state?: string | null,
): Promise<GeocodingResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const query = [address, city, state].filter(Boolean).join(", ");
  if (!query.trim()) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    const location = data.results?.[0]?.geometry?.location;
    if (!location) return null;

    return { latitude: location.lat, longitude: location.lng };
  } catch {
    console.error("Geocoding failed for:", query);
    return null;
  }
}
