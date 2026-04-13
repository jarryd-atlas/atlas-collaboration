/**
 * One-time script to backfill latitude/longitude on existing sites.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GOOGLE_MAPS_API_KEY=... npx tsx scripts/backfill-site-coordinates.ts
 *
 * The script:
 *  1. Fetches all sites where latitude IS NULL and address IS NOT NULL
 *  2. Geocodes each address via Google Geocoding API
 *  3. Updates the site row with lat/lng
 *  4. Pauses 100ms between requests to stay within rate limits
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_KEY) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function geocode(address: string, city?: string | null, state?: string | null) {
  const query = [address, city, state].filter(Boolean).join(", ");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", GOOGLE_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();
  const loc = data.results?.[0]?.geometry?.location;
  if (!loc) return null;
  return { latitude: loc.lat as number, longitude: loc.lng as number };
}

async function main() {
  console.log("Fetching sites without coordinates...");

  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name, address, city, state")
    .is("latitude", null)
    .not("address", "is", null)
    .order("name");

  if (error) {
    console.error("Error fetching sites:", error.message);
    process.exit(1);
  }

  console.log(`Found ${sites.length} sites to geocode.\n`);

  let success = 0;
  let failed = 0;

  for (const site of sites) {
    const result = await geocode(site.address, site.city, site.state);

    if (result) {
      const { error: updateError } = await supabase
        .from("sites")
        .update({ latitude: result.latitude, longitude: result.longitude })
        .eq("id", site.id);

      if (updateError) {
        console.error(`  FAIL  ${site.name}: ${updateError.message}`);
        failed++;
      } else {
        console.log(`  OK    ${site.name} → (${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)})`);
        success++;
      }
    } else {
      console.warn(`  SKIP  ${site.name}: could not geocode "${site.address}"`);
      failed++;
    }

    // Rate limit: ~10 req/sec
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone! ${success} geocoded, ${failed} failed/skipped.`);
}

main();
