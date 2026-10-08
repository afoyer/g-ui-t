import { Sidebar } from "@/components/shell/sidebar";
import { LiveRefresh } from "@/components/live-refresh";
import { requireUser } from "@/lib/session";
import { listMyProjects, listReviewsForMe, listWaitingReviewers } from "@/lib/data";
import { firstName } from "@/components/ui";
import type { ChangeStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const me = await requireUser();
  const [projects, reviews] = await Promise.all([listMyProjects(me.id), listReviewsForMe(me.id)]);

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("changes")
    .select("id, title, project_id, status")
    .eq("author_id", me.id)
    .in("status", ["draft", "in_review", "changes_requested"]);

  const inReview = (mine ?? []).filter((c) => c.status === "in_review").map((c) => c.id);
  const waitingOn = await listWaitingReviewers(inReview);

  const navProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    activeChanges: (mine ?? [])
      .filter((c) => c.project_id === p.id)
      .map((c) => ({ id: c.id, title: c.title, state: stateLine(c.status as ChangeStatus, waitingOn.get(c.id)?.map(firstName)) })),
  }));

  return (
    <div className="flex h-full">
      <Sidebar me={me} reviewCount={reviews.length} projects={navProjects} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      <LiveRefresh projectIds={projects.map((p) => p.id)} meId={me.id} />
    </div>
  );
}

/** What a Change is waiting for, in a few words, or null while it's still a draft. */
function stateLine(status: ChangeStatus, waitingOn: string[] = []) {
  if (status === "changes_requested") return { text: "Changes requested", tone: "attention" as const };
  if (status === "in_review") {
    return { text: waitingOn.length ? `Waiting on ${waitingOn.join(", ")}` : "In review", tone: "waiting" as const };
  }
  return null;
}
