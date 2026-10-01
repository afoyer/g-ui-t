import { redirect } from "next/navigation";
import { loadChangeContext } from "@/lib/change";
import { compareWithCurrent, readFiles } from "@/lib/github/repo";
import { getMembers, listChanges } from "@/lib/data";
import { findOverlaps } from "@/lib/overlap";
import { requireUser } from "@/lib/session";
import { LiveRefresh } from "@/components/live-refresh";
import { TEMPLATES } from "@/templates";
import { Workspace } from "./workspace";

export default async function ChangePage({ params }: PageProps<"/p/[id]/c/[changeId]">) {
  const { id, changeId } = await params;
  const me = await requireUser();
  const { project, change, gh, repo } = await loadChangeContext(id, changeId);

  // Other people's work, and finished Changes, open in the review screen.
  if (change.author_id !== me.id || change.status === "merged" || change.status === "closed") {
    redirect(`/p/${id}/c/${changeId}/review`);
  }

  const [files, cmp, members, open] = await Promise.all([
    readFiles(gh, repo, change.branch),
    compareWithCurrent(gh, repo, project.default_branch, change.branch),
    getMembers(id),
    listChanges(id, "open"),
  ]);

  const overlaps = findOverlaps({ ...change, changed_files: cmp.files }, open).map((o) => ({
    changeId: o.change.id,
    title: o.change.title,
    components: o.components,
    author: members.find((m) => m.id === o.change.author_id) ?? null,
  }));

  return (
    <>
      <Workspace
        project={{ id, name: project.name, defaultBranch: project.default_branch }}
        change={change}
        template={TEMPLATES[project.type].sandpack}
        initialFiles={files}
        initialCheckpoints={cmp.checkpoints}
        initialChangedFiles={cmp.files}
        initialBehindBy={cmp.behindBy}
        overlaps={overlaps}
        reviewers={members.filter((m) => m.id !== me.id && m.role === "editor")}
      />
      <LiveRefresh projectIds={[id]} />
    </>
  );
}
