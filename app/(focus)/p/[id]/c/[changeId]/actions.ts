"use server";

import { redirect } from "next/navigation";
import { attempt, logActivity, type ActionResult } from "@/lib/actions";
import { loadChangeContext } from "@/lib/change";
import {
  commitFiles,
  compareWithCurrent,
  FriendlyError,
  openPullRequest,
  readFiles,
  restoreTo,
  updateFromCurrent,
} from "@/lib/github/repo";
import { getProfiles } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { FileMap } from "@/lib/types";

export type Checkpoint = Awaited<ReturnType<typeof compareWithCurrent>>["checkpoints"][number];
export type SyncResult = ActionResult & {
  checkpoints?: Checkpoint[];
  changedFiles?: string[];
  behindBy?: number;
  files?: FileMap;
};

async function ownChange(projectId: string, changeId: string) {
  const me = await requireUser();
  const ctx = await loadChangeContext(projectId, changeId);
  if (ctx.change.author_id !== me.id) throw new FriendlyError("Only the person who started this Change can edit it.");
  if (ctx.change.status === "merged" || ctx.change.status === "closed") {
    throw new FriendlyError("This Change is finished. Start a new one to keep working.");
  }
  return { me, ...ctx };
}

/** Re-reads checkpoints and changed files, and caches the file list for overlap checks. */
async function sync(ctx: Awaited<ReturnType<typeof ownChange>>, withFiles = false): Promise<SyncResult> {
  const cmp = await compareWithCurrent(ctx.gh, ctx.repo, ctx.project.default_branch, ctx.change.branch);
  const supabase = await createClient();
  await supabase
    .from("changes")
    .update({ changed_files: cmp.files, updated_at: new Date().toISOString() })
    .eq("id", ctx.change.id);
  return {
    ok: true,
    checkpoints: cmp.checkpoints,
    changedFiles: cmp.files,
    behindBy: cmp.behindBy,
    files: withFiles ? await readFiles(ctx.gh, ctx.repo, ctx.change.branch) : undefined,
  };
}

export async function saveCheckpoint(
  projectId: string,
  changeId: string,
  files: FileMap,
  message: string,
): Promise<SyncResult> {
  let out: SyncResult = {};
  const res = await attempt(async () => {
    const ctx = await ownChange(projectId, changeId);
    if (Object.keys(files).length) {
      await commitFiles(ctx.gh, ctx.repo, ctx.change.branch, files, message.trim() || "Checkpoint");
    }
    out = await sync(ctx);
  });
  return res.error ? res : out;
}

export async function restoreCheckpoint(projectId: string, changeId: string, sha: string, label: string): Promise<SyncResult> {
  let out: SyncResult = {};
  const res = await attempt(async () => {
    const ctx = await ownChange(projectId, changeId);
    await restoreTo(ctx.gh, ctx.repo, ctx.change.branch, sha, `Restore checkpoint "${label}"`);
    out = await sync(ctx, true);
  });
  return res.error ? res : out;
}

export async function bringInCurrent(projectId: string, changeId: string): Promise<SyncResult> {
  let out: SyncResult = {};
  const res = await attempt(async () => {
    const ctx = await ownChange(projectId, changeId);
    await updateFromCurrent(ctx.gh, ctx.repo, ctx.project.default_branch, ctx.change.branch);
    out = await sync(ctx, true);
  });
  return res.error ? res : out;
}

/** Share for Review: open a pull request and ask teammates to look. */
export async function shareForReview(
  projectId: string,
  changeId: string,
  reviewerIds: string[],
  note: string,
): Promise<ActionResult> {
  const res = await attempt(async () => {
    const ctx = await ownChange(projectId, changeId);
    const supabase = await createClient();
    const reviewers = [...(await getProfiles(reviewerIds)).values()].filter((p) => p.id !== ctx.me.id);
    if (!reviewers.length) throw new FriendlyError("Pick at least one person to review your work.");

    const description = note.trim() || ctx.change.description || "";
    let prNumber = ctx.change.pr_number;
    if (!prNumber) {
      prNumber = await openPullRequest(ctx.gh, ctx.repo, {
        base: ctx.project.default_branch,
        branch: ctx.change.branch,
        title: ctx.change.title,
        body: `${description}\n\n_Shared for review from G-ui-t._`,
        reviewers: reviewers.map((r) => r.github_login),
      });
    }

    await supabase
      .from("changes")
      .update({ status: "in_review", pr_number: prNumber, description: description || null, updated_at: new Date().toISOString() })
      .eq("id", changeId);
    await supabase.from("review_requests").upsert(
      reviewers.map((r) => ({ change_id: changeId, reviewer_id: r.id, state: "waiting" as const })),
      { onConflict: "change_id,reviewer_id" },
    );
    await logActivity(projectId, ctx.me.id, "shared", { change_id: changeId, title: ctx.change.title, pr: prNumber });
  });
  if (res.error) return res;
  redirect(`/p/${projectId}/c/${changeId}/review`);
}
