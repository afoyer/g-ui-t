import { notFound } from "next/navigation";
import { getChange, getProject } from "@/lib/data";
import { getOctokit } from "@/lib/github/client";
import { readFiles } from "@/lib/github/repo";
import { componentNames, diffFiles } from "@/lib/files";
import { Chip } from "@/components/ui";
import { TopBar } from "@/components/top-bar";
import { PreviewStage } from "@/components/workspace/preview-stage";
import { TEMPLATES } from "@/templates";
import type { FileMap } from "@/lib/types";

/**
 * Two versions side by side. `?change=<id>` compares a Change with Current, or,
 * once it's been added, Current just before and just after. Raw `before`/`after`
 * refs and `?merge=<sha>` still work for old links.
 */
export default async function ComparePage({ params, searchParams }: PageProps<"/p/[id]/compare">) {
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(id);
  const gh = await getOctokit();
  const repo = { owner: project.repo_owner, repo: project.repo_name };

  let title = typeof sp.title === "string" ? sp.title : "Compare";
  let before = typeof sp.before === "string" ? sp.before : project.default_branch;
  let after = typeof sp.after === "string" ? sp.after : project.default_branch;
  let labels = ["Before", "After"];
  let merge = typeof sp.merge === "string" ? sp.merge : null;

  if (typeof sp.change === "string") {
    const change = await getChange(sp.change);
    if (change.project_id !== id) notFound();
    title = change.title;
    if (change.status === "merged" && change.merge_sha) {
      merge = change.merge_sha;
    } else {
      before = project.default_branch;
      after = change.branch;
      labels = ["Current", change.title];
    }
  }
  // A merge compares with the version just before it.
  if (merge) {
    const { data } = await gh.rest.git.getCommit({ ...repo, commit_sha: merge });
    before = data.parents[0]?.sha ?? merge;
    after = merge;
    labels = ["Before it was added", `With “${title}”`];
  }
  const [beforeFiles, afterFiles] = await Promise.all([readFiles(gh, repo, before), readFiles(gh, repo, after)]);
  const changed = componentNames(Object.keys(fileDiff(beforeFiles, afterFiles)));

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
        header={
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
            {changed.length ? (
              <>
                <span className="text-muted">What&apos;s different:</span>
                {changed.map((c) => (
                  <Chip key={c} tone="new">
                    {c}
                  </Chip>
                ))}
              </>
            ) : (
              <span className="rounded-[6px] bg-note px-2.5 py-1 text-note-ink">
                No differences. These two versions look the same.
              </span>
            )}
          </div>
        }
        versions={[
          { label: labels[0], files: beforeFiles },
          { label: labels[1], files: afterFiles },
        ]}
      />
    </>
  );
}

function fileDiff(a: FileMap, b: FileMap): FileMap {
  const out = diffFiles(a, b);
  for (const p of Object.keys(a)) if (!(p in b)) out[p] = "";
  return out;
}

function short(ref: string) {
  return /^[0-9a-f]{40}$/.test(ref) ? ref.slice(0, 7) : ref;
}
