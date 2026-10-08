import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Change, Comment, Invite, Profile, Project, ReviewRequest, Role } from "@/lib/types";

const OPEN: Change["status"][] = ["draft", "in_review", "changes_requested"];

export const listMyProjects = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("role, projects(*)")
    .eq("user_id", userId);
  return (data ?? [])
    .map((r) => r.projects as unknown as Project)
    .filter(Boolean)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
});

export const getProject = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as Project;
});

export const getMembers = cache(async (projectId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_members")
    .select("role, profiles(*)")
    .eq("project_id", projectId)
    .order("created_at");
  return (data ?? []).map((r) => ({ role: r.role as Role, ...(r.profiles as unknown as Profile) }));
});

export async function getProfiles(ids: string[]) {
  if (!ids.length) return new Map<string, Profile>();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((p) => [p.id, p as Profile]));
}

export const listChanges = cache(async (projectId: string, which: "open" | "merged" | "all" = "open") => {
  const supabase = await createClient();
  let q = supabase.from("changes").select("*").eq("project_id", projectId);
  if (which === "open") q = q.in("status", OPEN);
  if (which === "merged") q = q.eq("status", "merged");
  const { data } = await q.order("updated_at", { ascending: false });
  return (data ?? []) as Change[];
});

export async function listMyOpenChanges(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("changes")
    .select("*, projects(name)")
    .eq("author_id", userId)
    .in("status", OPEN)
    .order("updated_at", { ascending: false })
    .limit(5);
  return (data ?? []) as (Change & { projects: { name: string } })[];
}

export const getChange = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("changes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as Change;
});

export async function getReviews(changeId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("review_requests").select("*").eq("change_id", changeId);
  return (data ?? []) as ReviewRequest[];
}

export async function getComments(changeId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("comments").select("*").eq("change_id", changeId).order("created_at");
  return (data ?? []) as Comment[];
}

/** Changes waiting on my review, with project names. */
export async function listReviewsForMe(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_requests")
    .select("state, changes!inner(*, projects(name))")
    .eq("reviewer_id", userId)
    .eq("state", "waiting")
    .eq("changes.status", "in_review");
  return (data ?? []).map((r) => r.changes as unknown as Change & { projects: { name: string } });
}

export async function listMyInReview(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("changes")
    .select("*, projects(name)")
    .eq("author_id", userId)
    .in("status", ["in_review", "changes_requested"])
    .order("updated_at", { ascending: false });
  return (data ?? []) as (Change & { projects: { name: string } })[];
}

export async function listPendingInvites(login: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invites")
    .select("*, projects(name, description, owner_id, repo_owner, repo_name)")
    .eq("github_login", login.toLowerCase())
    .is("accepted_at", null);
  return (data ?? []) as (Invite & { projects: { name: string; description: string | null; owner_id: string; repo_owner: string; repo_name: string } })[];
}

export async function listProjectInvites(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invites").select("*").eq("project_id", projectId).is("accepted_at", null);
  return (data ?? []) as Invite[];
}

export async function listActivity(projectIds: string[], limit = 30) {
  if (!projectIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Activity[];
}

/**
 * Reviews that have wrapped up and involve me: my Changes that were added or
 * closed, and Changes I've already given an answer on.
 */
export async function listMyFinishedReviews(userId: string, limit = 10) {
  const supabase = await createClient();
  const [{ data: mine }, { data: answered }] = await Promise.all([
    supabase
      .from("changes")
      .select("*, projects(name)")
      .eq("author_id", userId)
      .in("status", ["merged", "closed"])
      .not("pr_number", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("review_requests")
      .select("state, changes!inner(*, projects(name))")
      .eq("reviewer_id", userId)
      .in("state", ["approved", "changes_requested"])
      .limit(limit),
  ]);
  type Row = Change & { projects: { name: string } };
  const rows: { change: Row; myAnswer: ReviewRequest["state"] | null }[] = [
    ...((mine ?? []) as Row[]).map((change) => ({ change, myAnswer: null })),
    ...(answered ?? []).map((r) => ({ change: r.changes as unknown as Row, myAnswer: r.state as ReviewRequest["state"] })),
  ];
  const seen = new Set<string>();
  return rows
    .filter((r) => !seen.has(r.change.id) && seen.add(r.change.id))
    .sort((a, b) => b.change.updated_at.localeCompare(a.change.updated_at))
    .slice(0, limit);
}

/** Who each Change is still waiting on, by change id. */
export async function listWaitingReviewers(changeIds: string[]) {
  const out = new Map<string, Profile[]>();
  if (!changeIds.length) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_requests")
    .select("change_id, reviewer_id")
    .in("change_id", changeIds)
    .eq("state", "waiting");
  const people = await getProfiles((data ?? []).map((r) => r.reviewer_id));
  for (const r of data ?? []) {
    const p = people.get(r.reviewer_id);
    if (p) out.set(r.change_id, [...(out.get(r.change_id) ?? []), p]);
  }
  return out;
}
