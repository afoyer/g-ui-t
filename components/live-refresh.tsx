"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_VERB } from "@/lib/activity-text";
import type { Activity } from "@/lib/types";
import { useFeedback } from "@/components/motion/feedback-provider";

type Row = Record<string, unknown>;

/**
 * Re-renders the current page when teammates do something in these projects,
 * tells you what happened (a quiet toast), and flashes the rows that changed.
 * Supabase Realtime only delivers rows this user may read (RLS), so we can
 * listen broadly and let the server page re-query.
 */
export function LiveRefresh({ projectIds, changeId, meId }: { projectIds: string[]; changeId?: string; meId: string }) {
  const router = useRouter();
  const { toast, flash } = useFeedback();
  const names = useRef(new Map<string, string>());
  const key = projectIds.join(",");

  useEffect(() => {
    if (!key) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pendingFlash: string[] = [];

    const refresh = (ids: (string | undefined)[] = []) => {
      pendingFlash.push(...ids.filter((x): x is string => Boolean(x)));
      clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
        // Flash after the refreshed rows have had a moment to render.
        const ids = pendingFlash.splice(0);
        setTimeout(() => flash(ids), 350);
      }, 250);
    };

    async function nameOf(id: string) {
      if (!names.current.has(id)) {
        const { data } = await supabase.from("profiles").select("name, github_login").eq("id", id).maybeSingle();
        names.current.set(id, data?.name?.split(/\s+/)[0] || data?.github_login || "Someone");
      }
      return names.current.get(id)!;
    }

    const onActivity = async ({ new: row }: { new: Row }) => {
      const a = row as unknown as Activity;
      refresh([a.payload?.change_id as string | undefined]);
      if (a.actor_id === meId) return;
      const who = await nameOf(a.actor_id);
      const title = a.payload?.title && a.kind !== "created" ? ` ${a.payload.title}` : "";
      toast({ tone: "info", title: `${who} ${ACTIVITY_VERB[a.kind]}${title}` });
    };

    const filter = `project_id=in.(${key})`;
    let channel = supabase
      .channel(`live:${key}:${changeId ?? ""}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity", filter }, onActivity)
      .on("postgres_changes", { event: "*", schema: "public", table: "changes", filter }, ({ new: row }) =>
        refresh([(row as Row).id as string]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "review_requests" }, ({ new: row }) =>
        refresh([(row as Row).change_id as string]),
      );
    if (changeId) {
      channel = channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `change_id=eq.${changeId}` },
        ({ new: row }) => refresh([(row as Row).id as string]),
      );
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, changeId, meId, router, toast, flash]);

  return null;
}
