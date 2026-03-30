"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabaseBrowser } from "../supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook for real-time meeting updates using Supabase Realtime.
 * Subscribes to postgres_changes on meeting_items and tracks presence.
 */
export function useMeetingRealtime(
  meetingId: string,
  currentUserId: string,
  onRemoteChange: () => void
) {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onChangeRef = useRef(onRemoteChange);
  onChangeRef.current = onRemoteChange;

  useEffect(() => {
    if (!meetingId || !currentUserId) return;

    const supabase = getSupabaseBrowser();
    const channelName = `meeting:${meetingId}`;

    // Clean up existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(channelName);

    // Listen for meeting_items changes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meeting_items",
        filter: `meeting_id=eq.${meetingId}`,
      },
      (payload) => {
        // Only react to changes from other users
        const newRecord = payload.new as any;
        if (newRecord?.author_id !== currentUserId) {
          onChangeRef.current();
        }
      }
    );

    // Listen for meeting status changes
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "meetings",
        filter: `id=eq.${meetingId}`,
      },
      () => {
        onChangeRef.current();
      }
    );

    // Presence tracking
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const userIds: string[] = [];
      for (const key of Object.keys(state)) {
        const presences = state[key] as any[];
        for (const p of presences) {
          if (p.user_id && !userIds.includes(p.user_id)) {
            userIds.push(p.user_id);
          }
        }
      }
      setOnlineUserIds(userIds);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [meetingId, currentUserId]);

  return { onlineUserIds };
}
