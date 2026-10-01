import { Sidebar } from "@/components/shell/sidebar";
import { LiveRefresh } from "@/components/live-refresh";
import { requireUser } from "@/lib/session";
import { listMyProjects, listReviewsForMe } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const me = await requireUser();
  const [projects, reviews] = await Promise.all([listMyProjects(me.id), listReviewsForMe(me.id)]);

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("changes")
    .select("id, title, project_id")
    .eq("author_id", me.id)
    .in("status", ["draft", "in_review", "changes_requested"]);

  const navProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    activeChanges: (mine ?? []).filter((c) => c.project_id === p.id),
  }));

  return (
    <div className="flex h-full">
      <Sidebar me={me} reviewCount={reviews.length} projects={navProjects} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      <LiveRefresh projectIds={projects.map((p) => p.id)} />
    </div>
  );
}
