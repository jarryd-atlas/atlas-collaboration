"use server";

import { getMilestonesForSite } from "../data/queries";

export async function getSiteOverviewData(siteId: string) {
  const milestones = await getMilestonesForSite(siteId);
  return { milestones };
}
