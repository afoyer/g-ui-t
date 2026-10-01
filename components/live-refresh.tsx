"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the current page when teammates do something in these projects.
 * Supabase Realtime only delivers rows this user may read (RLS), so we can
 * listen broadly and let the server page re-query.
 */
export function LiveRefresh({ projectIds, changeId }: { projectIds: string[]; changeId?: string }) {
  const router = useRouter();
  const key = projectIds.join(",");

  useEffect(() => {
    if (!key) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const filter = `project_id=in.(${key})`;
    let channel = supabase
      .channel(`live:${key}:${changeId ?? ""}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "changes", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "review_requests" }, refresh);
    if (changeId) {
      channel = channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `change_id=eq.${changeId}` },
        refresh,
      );
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, changeId, router]);

  return null;
}
