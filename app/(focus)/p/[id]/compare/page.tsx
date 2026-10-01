import { getProject } from "@/lib/data";
import { getOctokit } from "@/lib/github/client";
import { readFiles } from "@/lib/github/repo";
import { TopBar } from "@/components/top-bar";
import { PreviewStage } from "@/components/workspace/preview-stage";
import { TEMPLATES } from "@/templates";

/** Before and after, side by side. Refs can be branch names or commit shas. */
export default async function ComparePage({ params, searchParams }: PageProps<"/p/[id]/compare">) {
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(id);
  const title = typeof sp.title === "string" ? sp.title : "Compare";
  const gh = await getOctokit();
  const repo = { owner: project.repo_owner, repo: project.repo_name };

  let before = typeof sp.before === "string" ? sp.before : project.default_branch;
  let after = typeof sp.after === "string" ? sp.after : project.default_branch;
  // ?merge=<sha> compares a merge with the version just before it.
  if (typeof sp.merge === "string") {
    const { data } = await gh.rest.git.getCommit({ ...repo, commit_sha: sp.merge });
    before = data.parents[0]?.sha ?? sp.merge;
    after = sp.merge;
  }
  const [beforeFiles, afterFiles] = await Promise.all([readFiles(gh, repo, before), readFiles(gh, repo, after)]);

  return (
    <>
      <TopBar
        back={{ href: `/p/${id}/history`, label: `${project.name} /` }}
        left={
          <>
            <span className="font-semibold">{title}</span>
            <span className="git-hint">
              {short(before)}…{short(after)}
            </span>
          </>
        }
      />
      <PreviewStage
        template={TEMPLATES[project.type].sandpack}
        versions={[
          { label: "Before", files: beforeFiles },
          { label: "After", files: afterFiles },
        ]}
      />
    </>
  );
}

function short(ref: string) {
  return /^[0-9a-f]{40}$/.test(ref) ? ref.slice(0, 7) : ref;
}
