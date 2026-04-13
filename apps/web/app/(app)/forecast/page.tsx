import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/data/current-user";
import {
  getForecastDeals,
  getTimePeriods,
  getClosedDealsForMetrics,
  getForecastTargets,
  periodKeyFromConfig,
} from "../../../lib/data/forecast-queries";
import { ForecastClient } from "./forecast-client";

export default async function ForecastPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.sessionClaims?.tenantType !== "internal") redirect("/");

  const [deals, closedDeals, targets] = await Promise.all([
    getForecastDeals(),
    getClosedDealsForMetrics(),
    getForecastTargets(),
  ]);

  const periods = getTimePeriods();

  // Build serializable targets map keyed by period_key
  const targetsObj: Record<string, number> = {};
  for (const p of periods) {
    const key = periodKeyFromConfig(p);
    if (key) {
      const val = targets.get(key);
      if (val != null) targetsObj[key] = val;
    }
  }

  return (
    <ForecastClient
      deals={deals}
      closedDeals={closedDeals}
      targets={targetsObj}
      periods={periods.map((p) => ({
        ...p,
        periodKey: periodKeyFromConfig(p),
        start: p.start.toISOString(),
        end: p.end.toISOString(),
      }))}
    />
  );
}
