import "server-only";
import { unstable_rethrow } from "next/navigation";
import { FriendlyError } from "@/lib/github/repo";
import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/lib/types";

export type ActionResult = { error?: string; ok?: boolean };

/**
 * Runs a server action and turns failures into a message a designer can act
 * on. Next's redirect()/notFound() still work because they're rethrown.
 */
export async function attempt(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof FriendlyError) return { error: e.message };
    console.error(e);
    const status = typeof e === "object" && e && "status" in e ? (e as { status: number }).status : 0;
    if (status === 401) return { error: "GitHub signed you out. Please sign in again." };
    if (status === 403) return { error: "GitHub says you don't have permission to do that on this project." };
    return { error: "Something went wrong talking to GitHub. Please try again." };
  }
}

export async function logActivity(
  projectId: string,
  actorId: string,
  kind: Activity["kind"],
  payload: Activity["payload"] = {},
) {
  const supabase = await createClient();
  await supabase.from("activity").insert({ project_id: projectId, actor_id: actorId, kind, payload });
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
}
