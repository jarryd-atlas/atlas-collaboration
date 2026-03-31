#!/usr/bin/env node
/**
 * One-off script: Recalculate pipeline_stage for ALL sites from their linked HubSpot deals.
 * Uses raw fetch (no dependencies) against Supabase REST API + HubSpot API.
 */

const SUPABASE_URL = "https://vxedpmplluqcfxzucxbz.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function sbGet(table, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders });
  return res.json();
}

async function sbPatch(table, match, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: "PATCH", headers: sbHeaders, body: JSON.stringify(body),
  });
  return res.ok;
}

// Stage ranking
const STAGE_RANK = {
  whitespace: 0, prospect: 1, evaluation: 2, qualified: 3,
  contracted: 4, deployment: 5, active: 6,
};

const PIPELINE_STAGE_MAP = {
  "1188492915": "prospect", "250564613": "prospect", "1188492916": "prospect",
  "250564614": "evaluation", "1240422453": "qualified",
  "1188492917": "evaluation", "1188492918": "evaluation", "1188492919": "evaluation",
  "6b3b22f8-8bf4-40af-91e0-61bd1b0bfc63": "evaluation",
  "250564615": "contracted",
  "4c6e00f8-890b-4a2d-8f22-7eb9b7227e00": "contracted",
  "10d2d0d7-556b-4fb9-aa24-12b0fd0159a6": "paused",
  "5b2cab04-4ab5-4249-8487-0b3834d444c5": "disqualified",
  "e4be6fb9-65ed-4f32-9493-d755e7410ab1": "evaluation",
  "268042404": "evaluation",
  "264057885": "contracted",
  "80a99505-8d78-4864-bee8-c416cb2e7f4f": "active",
  "dddab890-d5f2-4399-9886-f2ad9fb46864": "disqualified",
};

const RENEWAL_PIPELINE_ID = "7c3189ce-7431-4b27-a546-6e095c0f366a";
const RENEWAL_STAGE_IDS = new Set([
  "e4be6fb9-65ed-4f32-9493-d755e7410ab1", "268042404",
  "264057885", "80a99505-8d78-4864-bee8-c416cb2e7f4f",
  "dddab890-d5f2-4399-9886-f2ad9fb46864",
]);

function getDealType(stageId, pipelineId) {
  if (pipelineId) return pipelineId === RENEWAL_PIPELINE_ID ? "renewal" : "new_business";
  return RENEWAL_STAGE_IDS.has(stageId) ? "renewal" : "new_business";
}

function resolveStage(deals) {
  if (deals.length === 0) return "whitespace";
  const mapped = deals.map(d => ({
    ...d,
    appStage: PIPELINE_STAGE_MAP[d.dealStageId] ?? "prospect",
    dealType: getDealType(d.dealStageId, d.pipelineId),
  }));
  if (mapped.some(d => d.appStage === "active")) return "active";
  const progression = mapped.filter(d => d.appStage !== "disqualified" && d.appStage !== "paused");
  const terminal = mapped.filter(d => d.appStage === "disqualified" || d.appStage === "paused");
  if (progression.length === 0) {
    return terminal.every(d => d.appStage === "disqualified") ? "disqualified" : "paused";
  }
  const newBiz = progression.filter(d => d.dealType === "new_business");
  const renewals = progression.filter(d => d.dealType === "renewal");
  let best1 = null, best2 = null;
  if (newBiz.length > 0) {
    best1 = newBiz.reduce((b, d) => (STAGE_RANK[d.appStage] ?? 0) > (STAGE_RANK[b.appStage] ?? 0) ? d : b).appStage;
  }
  if (renewals.length > 0) {
    const sorted = [...renewals].sort((a, b) => {
      if (!a.closeDate && !b.closeDate) return 0;
      if (!a.closeDate) return 1;
      if (!b.closeDate) return -1;
      return new Date(b.closeDate) - new Date(a.closeDate);
    });
    best2 = sorted[0].appStage;
  }
  if (best1 && best2) return (STAGE_RANK[best1] ?? 0) >= (STAGE_RANK[best2] ?? 0) ? best1 : best2;
  return best1 ?? best2 ?? "whitespace";
}

async function main() {
  // Get HubSpot config
  const configs = await sbGet("hubspot_config", "is_active=eq.true&select=access_token,tenant_id");
  if (!configs.length) { console.error("No active HubSpot config"); return; }
  const config = configs[0];
  const token = config.access_token;
  console.log(`Tenant: ${config.tenant_id}\n`);

  // Get all sites (across all tenants)
  const sites = await sbGet("sites", `select=id,name,pipeline_stage`);
  console.log(`Found ${sites.length} sites`);

  // Get all site links
  const links = await sbGet("hubspot_site_links", `select=site_id,hubspot_deal_id`);
  console.log(`Found ${links.length} deal links\n`);

  // Group links by site
  const linksBySite = {};
  for (const l of links) {
    if (!linksBySite[l.site_id]) linksBySite[l.site_id] = [];
    linksBySite[l.site_id].push(l.hubspot_deal_id);
  }

  let updated = 0, unchanged = 0;

  for (const site of sites) {
    const dealIds = linksBySite[site.id] ?? [];

    if (dealIds.length === 0) {
      if (site.pipeline_stage !== "whitespace") {
        await sbPatch("sites", `id=eq.${site.id}`, { pipeline_stage: "whitespace" });
        console.log(`  ${site.name}: ${site.pipeline_stage} → whitespace (no deals)`);
        updated++;
      } else {
        unchanged++;
      }
      continue;
    }

    // Fetch deal data from HubSpot
    const deals = [];
    for (const dealId of dealIds) {
      try {
        const res = await fetch(
          `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealstage,pipeline,closedate`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          deals.push({
            dealStageId: data.properties?.dealstage ?? "",
            pipelineId: data.properties?.pipeline ?? undefined,
            closeDate: data.properties?.closedate ?? null,
          });
        } else {
          console.warn(`  ⚠ Could not fetch deal ${dealId} (${res.status})`);
        }
      } catch (e) {
        console.warn(`  ⚠ Error fetching deal ${dealId}: ${e.message}`);
      }
    }

    const resolved = resolveStage(deals);
    if (site.pipeline_stage !== resolved) {
      await sbPatch("sites", `id=eq.${site.id}`, { pipeline_stage: resolved });
      console.log(`  ${site.name}: ${site.pipeline_stage} → ${resolved}`);
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Unchanged: ${unchanged}`);
}

main().catch(console.error);
