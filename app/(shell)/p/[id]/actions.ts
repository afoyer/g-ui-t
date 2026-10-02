"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { attempt, logActivity, type ActionResult } from "@/lib/actions";
import { getOctokit } from "@/lib/github/client";
import { createBranch, FriendlyError, inviteCollaborator, restoreCurrentBefore, revokeAccess } from "@/lib/github/repo";
import { slugify } from "@/lib/files";
import { getMembers, getProject } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const repoOf = (p: { repo_owner: string; repo_name: string }) => ({ owner: p.repo_owner, repo: p.repo_name });

/** Start Change: a new branch off Current, owned by me. */
export async function startChange(projectId: string, title: string, description: string): Promise<ActionResult> {
  let changeId = "";
  const result = await attempt(async () => {
    const me = await requireUser();
    const project = await getProject(projectId);
    if (!title.trim()) throw new FriendlyError("Give your Change a short name.");

    const gh = await getOctokit();
    const base = `${me.github_login.toLowerCase()}/${slugify(title) || "change"}`;
    let branch = base;
    for (let n = 2; ; n++) {
      try {
        await createBranch(gh, repoOf(project), project.default_branch, branch);
        break;
      } catch (e) {
        // 422: a branch with that name exists already.
        if ((e as { status?: number }).status !== 422 || n > 9) throw e;
        branch = `${base}-${n}`;
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("changes")
      .insert({
        project_id: projectId,
        author_id: me.id,
        title: title.trim(),
        description: description.trim() || null,
        branch,
      })
      .select("id")
      .single();
    if (error) throw error;
    changeId = data.id;
    await logActivity(projectId, me.id, "change_started", { change_id: data.id, title: title.trim() });
  });
  if (result.error) return result;
  redirect(`/p/${projectId}/c/${changeId}`);
}

export async function invitePerson(projectId: string, login: string, role: Role): Promise<ActionResult> {
  return attempt(async () => {
    const me = await requireUser();
    const project = await getProject(projectId);
    const username = login.trim().replace(/^@/, "");
    if (!username) throw new FriendlyError("Enter a GitHub username.");
    const gh = await getOctokit();
    await inviteCollaborator(gh, repoOf(project), username, role);
    const supabase = await createClient();
    const { error } = await supabase
      .from("invites")
      .upsert(
        { project_id: projectId, github_login: username.toLowerCase(), role, invited_by: me.id },
        { onConflict: "project_id,github_login" },
      );
    if (error) throw error;
    revalidatePath(`/p/${projectId}/people`);
  });
}

/** Puts Current back the way it was before a Change was added. History is kept. */
export async function restoreCurrent(projectId: string, changeId: string): Promise<ActionResult> {
  return attempt(async () => {
    const me = await requireUser();
    const project = await getProject(projectId);
    const supabase = await createClient();
    const { data: change } = await supabase.from("changes").select("*").eq("id", changeId).single();
    if (!change?.merge_sha) throw new FriendlyError("That Change was never added to Current.");

    const gh = await getOctokit();
    const sha = await restoreCurrentBefore(gh, repoOf(project), project.default_branch, change.merge_sha, change.title);
    await supabase.from("projects").update({ current_sha: sha }).eq("id", projectId);
    await logActivity(projectId, me.id, "restored", { title: change.title, sha, change_id: changeId });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

async function asOwner(projectId: string) {
  const me = await requireUser();
  const project = await getProject(projectId);
  if (project.owner_id !== me.id) throw new FriendlyError("Only the project's owner can manage the team.");
  return { me, project };
}

export async function changeRole(projectId: string, userId: string, role: Role): Promise<ActionResult> {
  return attempt(async () => {
    const { me, project } = await asOwner(projectId);
    if (userId === me.id) throw new FriendlyError("You own this project, so you're always an Editor.");
    const member = (await getMembers(projectId)).find((m) => m.id === userId);
    if (!member) throw new FriendlyError("That person isn't on this project.");
    const gh = await getOctokit();
    // Re-inviting an existing collaborator just updates their permission.
    await inviteCollaborator(gh, repoOf(project), member.github_login, role);
    const supabase = await createClient();
    const { error } = await supabase.from("project_members").update({ role }).match({ project_id: projectId, user_id: userId });
    if (error) throw error;
    revalidatePath(`/p/${projectId}/people`);
  });
}

export async function removeMember(projectId: string, userId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { me, project } = await asOwner(projectId);
    if (userId === me.id) throw new FriendlyError("You can't remove yourself from your own project.");
    const member = (await getMembers(projectId)).find((m) => m.id === userId);
    if (!member) throw new FriendlyError("That person isn't on this project.");
    const gh = await getOctokit();
    await revokeAccess(gh, repoOf(project), member.github_login);
    const supabase = await createClient();
    const { error } = await supabase.from("project_members").delete().match({ project_id: projectId, user_id: userId });
    if (error) throw error;
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

export async function withdrawInvite(projectId: string, inviteId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { project } = await asOwner(projectId);
    const supabase = await createClient();
    const { data: invite } = await supabase.from("invites").select("github_login").eq("id", inviteId).maybeSingle();
    if (!invite) throw new FriendlyError("That invite is already gone.");
    const gh = await getOctokit();
    await revokeAccess(gh, repoOf(project), invite.github_login);
    const { error } = await supabase.from("invites").delete().eq("id", inviteId);
    if (error) throw error;
    revalidatePath(`/p/${projectId}/people`);
  });
}
