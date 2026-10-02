import "server-only";
import { getOctokit } from "@/lib/github/client";
import { invitationStatuses } from "@/lib/github/repo";
import { createClient } from "@/lib/supabase/server";
import type { Invite, Profile, Project } from "@/lib/types";

export type InviteStatus =
  | "waiting" // GitHub invitation not accepted yet
  | "needs_sign_in" // accepted on GitHub, but hasn't opened G-ui-t yet
  | "declined" // invitation declined or expired on GitHub
  | "unknown"; // we can't see GitHub invitations (not the owner)

/**
 * Brings pending invites up to date with GitHub. Anyone who accepted on
 * GitHub and already has a G-ui-t account becomes a member right away
 * (only the owner may add members, so for others this is read-only).
 */
export async function syncInvites(project: Project, invites: Invite[], myId: string) {
  const statuses = new Map<string, InviteStatus>();
  if (!invites.length) return { statuses, joined: 0 };

  const gh = await getOctokit();
  const { collaborators, pending } = await invitationStatuses(gh, {
    owner: project.repo_owner,
    repo: project.repo_name,
  });

  const supabase = await createClient();
  const isOwner = project.owner_id === myId;
  let joined = 0;

  for (const invite of invites) {
    const login = invite.github_login;
    if (collaborators.has(login)) {
      const { data: profile } = await supabase.from("profiles").select("id").ilike("github_login", login).maybeSingle();
      if (profile && isOwner) {
        await supabase
          .from("project_members")
          .upsert({ project_id: project.id, user_id: (profile as Pick<Profile, "id">).id, role: invite.role }, { onConflict: "project_id,user_id" });
        await supabase.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
        joined++;
        continue;
      }
      statuses.set(invite.id, "needs_sign_in");
    } else if (pending === null) {
      statuses.set(invite.id, "unknown");
    } else {
      statuses.set(invite.id, pending.has(login) ? "waiting" : "declined");
    }
  }
  return { statuses, joined };
}

/**
 * For the signed-in invitee: any invite they already accepted on GitHub
 * (so they can open the repo) turns into membership without another click.
 * Returns the invites that are still waiting on them.
 */
export async function autoJoinAccepted<T extends Invite & { projects: Pick<Project, "repo_owner" | "repo_name"> }>(
  userId: string,
  invites: T[],
) {
  if (!invites.length) return invites;
  const gh = await getOctokit();
  const supabase = await createClient();
  const remaining: T[] = [];
  for (const invite of invites) {
    const canOpen = await gh.rest.repos
      .get({ owner: invite.projects.repo_owner, repo: invite.projects.repo_name })
      .then(() => true)
      .catch(() => false);
    if (!canOpen) {
      remaining.push(invite);
      continue;
    }
    const { error } = await supabase
      .from("project_members")
      .upsert({ project_id: invite.project_id, user_id: userId, role: invite.role }, { onConflict: "project_id,user_id" });
    if (error) {
      remaining.push(invite);
      continue;
    }
    await supabase.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    await supabase.from("activity").insert({ project_id: invite.project_id, actor_id: userId, kind: "joined", payload: {} });
  }
  return remaining;
}
