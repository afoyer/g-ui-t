import { loadChangeContext } from "@/lib/change";
import { readFiles } from "@/lib/github/repo";
import { getComments, getMembers, getReviews } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { componentName } from "@/lib/files";
import { LiveRefresh } from "@/components/live-refresh";
import { TEMPLATES } from "@/templates";
import { ReviewScreen } from "./review-screen";

export default async function ReviewPage({ params }: PageProps<"/p/[id]/c/[changeId]/review">) {
  const { id, changeId } = await params;
  const me = await requireUser();
  const { project, change, gh, repo } = await loadChangeContext(id, changeId);

  // A merged Change's branch may be gone, so show it as it was merged.
  const ref = change.status === "merged" && change.merge_sha ? change.merge_sha : change.branch;
  const [files, comments, reviews, members, mainFiles] = await Promise.all([
    readFiles(gh, repo, ref),
    getComments(changeId),
    getReviews(changeId),
    getMembers(id),
    readFiles(gh, repo, project.default_branch).catch(() => ({}) as Record<string, string>),
  ]);

  const myRole = members.find((m) => m.id === me.id)?.role ?? "viewer";
  const whatChanged = [...new Set(change.changed_files)].map((f) => ({
    name: componentName(f),
    isNew: !(("/" + f) in mainFiles) && change.status !== "merged",
  }));

  return (
    <>
      <ReviewScreen
        me={me}
        myRole={myRole}
        project={{ id, name: project.name, repoUrl: `https://github.com/${project.repo_owner}/${project.repo_name}` }}
        change={change}
        template={TEMPLATES[project.type].sandpack}
        files={files}
        comments={comments}
        reviews={reviews}
        members={members}
        whatChanged={whatChanged}
      />
      <LiveRefresh projectIds={[id]} changeId={changeId} />
    </>
  );
}
