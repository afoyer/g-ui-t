import { Suspense } from "react";
import { getOctokit } from "@/lib/github/client";
import { readFiles } from "@/lib/github/repo";
import { PreviewTile } from "@/components/ui";
import { TEMPLATES } from "@/templates";
import type { Project } from "@/lib/types";
import { PreviewThumb } from "./preview-thumb";

type Props = { project: Pick<Project, "type" | "repo_owner" | "repo_name" | "default_branch">; className?: string };

/** Current's real preview as a thumbnail. Streams in; the striped tile stands in meanwhile or on failure. */
export function ProjectThumb(props: Props) {
  return (
    <Suspense fallback={<PreviewTile className={props.className} />}>
      <Thumb {...props} />
    </Suspense>
  );
}

async function Thumb({ project, className }: Props) {
  let files;
  try {
    const gh = await getOctokit();
    files = await readFiles(gh, { owner: project.repo_owner, repo: project.repo_name }, project.default_branch);
  } catch {
    return <PreviewTile className={className} />;
  }
  return <PreviewThumb template={TEMPLATES[project.type].sandpack} files={files} className={className} />;
}
