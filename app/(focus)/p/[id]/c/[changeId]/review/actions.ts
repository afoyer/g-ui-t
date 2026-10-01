"use server";

import { revalidatePath } from "next/cache";
import { attempt, logActivity, type ActionResult } from "@/lib/actions";
import { loadChangeContext } from "@/lib/change";
import { FriendlyError, mergePullRequest, submitReview } from "@/lib/github/repo";
import { getMembers, getReviews } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

async function asMember(projectId: string, changeId: string) {
  const me = await requireUser();
  const ctx = await loadChangeContext(projectId, changeId);
  const members = await getMembers(projectId);
  const role = members.find((m) => m.id === me.id)?.role;
  if (!role) throw new FriendlyError("You're not part of this project.");
  return { me, role, ...ctx };
}

export async function addComment(
  projectId: string,
  changeId: string,
  body: string,
  pin: { x: number; y: number; viewport: string } | null,
): Promise<ActionResult> {
  return attempt(async () => {
    const { me, change, gh, repo } = await asMember(projectId, changeId);
    if (!body.trim()) throw new FriendlyError("Write something first.");
    const supabase = await createClient();
    const { error } = await supabase.from("comments").insert({
      change_id: changeId,
      author_id: me.id,
      body: body.trim(),
      pin_x: pin?.x ?? null,
      pin_y: pin?.y ?? null,
      viewport: pin?.viewport ?? null,
    });
    if (error) throw error;
    // Mirror onto the pull request for anyone following along on GitHub.
    if (change.pr_number) {
      const where = pin ? `📍 on the ${pin.viewport} preview` : "💬";
      await gh.rest.issues
        .createComment({ ...repo, issue_number: change.pr_number, body: `${where} — ${body.trim()}\n\n_from G-ui-t_` })
        .catch(() => undefined);
    }
    await logActivity(projectId, me.id, "commented", { change_id: changeId, title: change.title });
    revalidatePath(`/p/${projectId}/c/${changeId}/review`);
  });
}

export async function review(
  projectId: string,
  changeId: string,
  decision: "approved" | "changes_requested",
  note: string,
): Promise<ActionResult> {
  return attempt(async () => {
    const { me, role, change, gh, repo } = await asMember(projectId, changeId);
    if (change.author_id === me.id) throw new FriendlyError("You can't review your own Change.");
    if (role !== "editor") throw new FriendlyError("Viewers can comment but not approve.");
    if (change.status !== "in_review" && change.status !== "changes_requested") {
      throw new FriendlyError("This Change isn't waiting for review.");
    }
    if (decision === "changes_requested" && !note.trim()) {
      throw new FriendlyError("Say what you'd like changed, so they know where to start.");
    }

    if (change.pr_number) {
      // GitHub can refuse (e.g. invite not yet accepted). The review still counts here.
      await submitReview(gh, repo, change.pr_number, decision === "approved" ? "APPROVE" : "REQUEST_CHANGES", note).catch(
        (e) => console.warn("GitHub review failed", e?.status),
      );
    }

    const supabase = await createClient();
    await supabase
      .from("review_requests")
      .upsert({ change_id: changeId, reviewer_id: me.id, state: decision, updated_at: new Date().toISOString() });
    if (note.trim()) {
      await supabase.from("comments").insert({ change_id: changeId, author_id: me.id, body: note.trim() });
    }
    // One open "request changes" holds the whole Change back.
    const blocked = (await getReviews(changeId)).some((r) => r.state === "changes_requested");
    await supabase
      .from("changes")
      .update({ status: blocked ? "changes_requested" : "in_review", updated_at: new Date().toISOString() })
      .eq("id", changeId);
    await logActivity(projectId, me.id, decision, { change_id: changeId, title: change.title });
    revalidatePath(`/p/${projectId}/c/${changeId}/review`);
  });
}

/** Add to Current: merge the pull request once someone has approved it. */
export async function addToCurrent(projectId: string, changeId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { me, role, project, change, gh, repo } = await asMember(projectId, changeId);
    if (role !== "editor") throw new FriendlyError("Only editors can add work to Current.");
    if (!change.pr_number || change.status !== "in_review") throw new FriendlyError("This Change isn't ready to add.");
    const reviews = await getReviews(changeId);
    if (!reviews.some((r) => r.state === "approved")) throw new FriendlyError("It needs at least one approval first.");
    if (reviews.some((r) => r.state === "changes_requested")) {
      throw new FriendlyError("Someone asked for changes. Sort those out first.");
    }

    const sha = await mergePullRequest(gh, repo, change.pr_number, change.title);
    const now = new Date().toISOString();
    const supabase = await createClient();
    await supabase
      .from("changes")
      .update({ status: "merged", merge_sha: sha, merged_at: now, merged_by: me.id, updated_at: now })
      .eq("id", changeId);
    await supabase.from("projects").update({ current_sha: sha }).eq("id", project.id);
    await logActivity(projectId, me.id, "merged", { change_id: changeId, title: change.title, sha, pr: change.pr_number });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}
