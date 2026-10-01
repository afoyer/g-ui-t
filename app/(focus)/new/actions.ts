"use server";

import { redirect } from "next/navigation";
import { attempt, logActivity, type ActionResult } from "@/lib/actions";
import { getOctokit } from "@/lib/github/client";
import { createProjectRepo, FriendlyError, inviteCollaborator } from "@/lib/github/repo";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES, templateFiles } from "@/templates";
import type { ProjectType, Role } from "@/lib/types";

export type NewProject = {
  name: string;
  description: string;
  type: ProjectType;
  startFrom: "template" | "empty";
  invites: { login: string; role: Role }[];
};

export async function createProject(input: NewProject): Promise<ActionResult> {
  let projectId = "";
  const result = await attempt(async () => {
    const me = await requireUser();
    const name = input.name.trim();
    if (!name) throw new FriendlyError("Give your project a name.");
    if (!(input.type in TEMPLATES)) throw new FriendlyError("Pick what you're making.");

    const gh = await getOctokit();
    const invites = dedupe(input.invites).filter((i) => i.login.toLowerCase() !== me.github_login.toLowerCase());

    // Check names before creating anything, so a typo doesn't leave a half-made project.
    for (const inv of invites) {
      try {
        await gh.rest.users.getByUsername({ username: inv.login });
      } catch {
        throw new FriendlyError(`There's no GitHub user called "${inv.login}".`);
      }
    }

    const files =
      input.startFrom === "template"
        ? templateFiles(input.type, name)
        : { "/README.md": templateFiles(input.type, name)["/README.md"] };
    const repo = await createProjectRepo(gh, { name, description: input.description, files });

    const supabase = await createClient();
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        owner_id: me.id,
        name,
        description: input.description.trim() || null,
        type: input.type,
        repo_owner: repo.owner,
        repo_name: repo.repo,
        default_branch: repo.defaultBranch,
        current_sha: repo.sha,
      })
      .select("id")
      .single();
    if (error) throw error;
    projectId = project.id;

    await supabase.from("project_members").insert({ project_id: project.id, user_id: me.id, role: "editor" });

    for (const inv of invites) {
      await inviteCollaborator(gh, repo, inv.login, inv.role);
      await supabase
        .from("invites")
        .insert({ project_id: project.id, github_login: inv.login.toLowerCase(), role: inv.role, invited_by: me.id });
    }

    await logActivity(project.id, me.id, "created", { name });
  });
  if (result.error) return result;
  redirect(`/p/${projectId}`);
}

function dedupe(list: NewProject["invites"]) {
  const seen = new Set<string>();
  return list
    .map((i) => ({ ...i, login: i.login.trim().replace(/^@/, "") }))
    .filter((i) => i.login && !seen.has(i.login.toLowerCase()) && seen.add(i.login.toLowerCase()));
}
