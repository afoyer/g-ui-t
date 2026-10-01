import "server-only";
import { notFound } from "next/navigation";
import { getOctokit } from "@/lib/github/client";
import { getChange, getProject } from "@/lib/data";

/** The project, change and an Octokit scoped to them, checking they match. */
export async function loadChangeContext(projectId: string, changeId: string) {
  const [project, change] = await Promise.all([getProject(projectId), getChange(changeId)]);
  if (change.project_id !== project.id) notFound();
  const gh = await getOctokit();
  return { project, change, gh, repo: { owner: project.repo_owner, repo: project.repo_name } };
}
