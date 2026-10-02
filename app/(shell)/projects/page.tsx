import Link from "next/link";
import { getMembers, listChanges, listMyProjects } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { Row, Stagger } from "@/components/motion/stagger";
import { Empty, ProjectSwatch, timeAgo } from "@/components/ui";
import { TEMPLATES } from "@/templates";

export default async function ProjectsPage() {
  const me = await requireUser();
  const projects = await listMyProjects(me.id);
  const details = await Promise.all(projects.map(async (p) => ({ members: await getMembers(p.id), open: await listChanges(p.id) })));

  return (
    <div className="flex max-w-[960px] flex-col gap-5 px-[30px] py-[26px]">
      <div className="flex items-end justify-between">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Projects</h1>
        <Link href="/new" className="btn btn-primary">
          New Project
        </Link>
      </div>
      <Stagger className="panel">
        {projects.map((p, i) => (
          <Row key={p.id} id={p.id} href={`/p/${p.id}`} className="row hover:bg-[#fafaf9]">
            <ProjectSwatch id={p.id} size={10} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-[12px] text-muted">
                {TEMPLATES[p.type].label} · {details[i].members.length === 1 ? "Just you" : `${details[i].members.length} people`} ·{" "}
                {details[i].open.length} active · updated {timeAgo(p.updated_at)}
              </div>
            </div>
            <span className="git-hint">
              {p.repo_owner}/{p.repo_name}
            </span>
          </Row>
        ))}
        {projects.length === 0 && <Empty>No projects yet.</Empty>}
      </Stagger>
    </div>
  );
}
