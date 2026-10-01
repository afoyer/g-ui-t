import { getProject } from "@/lib/data";
import { getOctokit } from "@/lib/github/client";
import { readFiles } from "@/lib/github/repo";
import { TopBar } from "@/components/top-bar";
import { PreviewStage } from "@/components/workspace/preview-stage";
import { TEMPLATES } from "@/templates";

export default async function CurrentPreviewPage({ params }: PageProps<"/p/[id]/preview">) {
  const { id } = await params;
  const project = await getProject(id);
  const gh = await getOctokit();
  const files = await readFiles(gh, { owner: project.repo_owner, repo: project.repo_name }, project.default_branch);

  return (
    <>
      <TopBar
        back={{ href: `/p/${id}`, label: `${project.name} /` }}
        left={
          <>
            <span className="h-2 w-2 rounded-full bg-shared" />
            <span className="font-semibold">Current</span>
            <span className="git-hint">
              {project.default_branch} · {project.current_sha?.slice(0, 7)}
            </span>
          </>
        }
      />
      <PreviewStage template={TEMPLATES[project.type].sandpack} versions={[{ label: "Current", files }]} />
    </>
  );
}
