import { getSession } from "../supabase/server";
import { syncCalendarForUser } from "../../app/api/calendar/sync-user/route";

const lastSyncMap = new Map<string, number>();
const THROTTLE_MS = 60_000; // 1 minute

/**
 * Triggers a background calendar sync for the current user.
 * Throttled to at most once per 60s per user to avoid hammering Google API.
 * Designed to be called from Next.js after() in server components.
 */
export async function triggerCalendarSyncForCurrentUser(): Promise<void> {
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const last = lastSyncMap.get(userId) ?? 0;
    if (Date.now() - last < THROTTLE_MS) return;
    lastSyncMap.set(userId, Date.now());

    const result = await syncCalendarForUser(userId);
    if (result.error) {
      console.error("Background calendar sync error:", result.error);
    }
  } catch (e) {
    console.error("Background calendar sync failed:", e);
  }
}
