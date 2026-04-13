import { redirect } from "next/navigation";
import { requireSession } from "../../../lib/supabase/server";
import { getAllSitesWithCustomers, getCustomerHQLocations } from "../../../lib/data/queries";
import { SiteMapPageClient } from "../../../components/maps/site-map-page";

export default async function MapPage() {
  const { claims } = await requireSession();

  // Only internal (CK) users can see the portfolio map
  if (claims.tenantType && claims.tenantType !== "internal") {
    redirect("/");
  }

  const [sites, hqLocations] = await Promise.all([
    getAllSitesWithCustomers(),
    getCustomerHQLocations(),
  ]);

  // Flatten nested customer join for sites
  const mapped = sites.map((s: any) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    address: s.address,
    city: s.city,
    state: s.state,
    pipeline_stage: s.pipeline_stage,
    latitude: s.latitude,
    longitude: s.longitude,
    customer: s.customers ?? undefined,
  }));

  // Map HQ locations as special markers
  const hqMarkers = hqLocations.map((c: any) => ({
    id: `hq-${c.id}`,
    name: `${c.name} HQ`,
    slug: "",
    address: c.hq_address,
    city: c.hq_city,
    state: c.hq_state,
    pipeline_stage: "hq",
    latitude: c.hq_latitude,
    longitude: c.hq_longitude,
    isHQ: true,
    customer: { id: c.id, name: c.name, slug: c.slug },
  }));

  return <SiteMapPageClient sites={[...mapped, ...hqMarkers]} />;
}
