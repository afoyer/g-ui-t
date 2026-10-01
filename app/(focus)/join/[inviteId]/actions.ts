"use server";

import { redirect } from "next/navigation";
import { attempt, logActivity, type ActionResult } from "@/lib/actions";
import { getOctokit } from "@/lib/github/client";
import { acceptInvitation, FriendlyError } from "@/lib/github/repo";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function joinProject(inviteId: string): Promise<ActionResult> {
  let projectId = "";
  const res = await attempt(async () => {
    const me = await requireUser();
    const supabase = await createClient();
    const { data: invite } = await supabase.from("invites").select("*, projects(*)").eq("id", inviteId).maybeSingle();
    if (!invite || invite.github_login !== me.github_login.toLowerCase()) {
      throw new FriendlyError("This invitation isn't for your GitHub account.");
    }
    projectId = invite.project_id;
    if (invite.accepted_at) return;

    const gh = await getOctokit();
    await acceptInvitation(gh, { owner: invite.projects.repo_owner, repo: invite.projects.repo_name });

    const { error } = await supabase
      .from("project_members")
      .upsert({ project_id: invite.project_id, user_id: me.id, role: invite.role }, { onConflict: "project_id,user_id" });
    if (error) throw error;
    await supabase.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", inviteId);
    await logActivity(invite.project_id, me.id, "joined", {});
  });
  if (res.error) return res;
  redirect(`/p/${projectId}`);
}
