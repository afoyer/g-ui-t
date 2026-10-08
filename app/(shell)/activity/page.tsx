import Link from "next/link";
import { getProfiles, listActivity, listMyProjects } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { groupByDay } from "@/lib/dates";
import { Avatar, clockTime, Empty, firstName, ProjectSwatch } from "@/components/ui";
import { ACTIVITY_VERB as VERB } from "@/lib/activity-text";
import { Row, Stagger } from "@/components/motion/stagger";
import type { Activity } from "@/lib/types";

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const sp = await searchParams;
  const projectFilter = typeof sp.project === "string" ? sp.project : null;
  const whoFilter = typeof sp.who === "string" ? sp.who : null;

  const me = await requireUser();
  const projects = await listMyProjects(me.id);
  const all = await listActivity(projects.map((p) => p.id), 120);
  const people = await getProfiles([me.id, ...all.map((a) => a.actor_id)]);
  const names = new Map(projects.map((p) => [p.id, p.name]));

  const activity = all.filter(
    (a) => (!projectFilter || a.project_id === projectFilter) && (!whoFilter || a.actor_id === whoFilter),
  );
  const actors = [...new Set(all.map((a) => a.actor_id))].flatMap((id) => people.get(id) ?? []);
  const href = (next: { project?: string | null; who?: string | null }) => {
    const q = new URLSearchParams();
    const project = next.project === undefined ? projectFilter : next.project;
    const who = next.who === undefined ? whoFilter : next.who;
    if (project) q.set("project", project);
    if (who) q.set("who", who);
    const s = q.toString();
    return s ? `/activity?${s}` : "/activity";
  };

  return (
    <div className="flex max-w-[860px] flex-col gap-5 px-[30px] py-[26px]">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Activity</h1>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
        {projects.length > 1 && (
          <Filter label="Project">
            <FilterLink href={href({ project: null })} active={!projectFilter}>
              All
            </FilterLink>
            {projects.map((p) => (
              <FilterLink key={p.id} href={href({ project: p.id })} active={projectFilter === p.id}>
                {p.name}
              </FilterLink>
            ))}
          </Filter>
        )}
        {actors.length > 1 && (
          <Filter label="By">
            <FilterLink href={href({ who: null })} active={!whoFilter}>
              Anyone
            </FilterLink>
            {actors.map((p) => (
              <FilterLink key={p.id} href={href({ who: p.id })} active={whoFilter === p.id}>
                {p.id === me.id ? "You" : firstName(p)}
              </FilterLink>
            ))}
          </Filter>
        )}
      </div>

      {activity.length === 0 && (
        <div className="panel">
          <Empty>{all.length ? "Nothing matches these filters." : "No activity yet."}</Empty>
        </div>
      )}

      {groupByDay(activity, (a) => a.created_at).map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <div className="label">{day}</div>
          <Stagger className="panel">
            {list.map((a) => {
              const who = people.get(a.actor_id);
              const title = a.payload.title as string | undefined;
              return (
                <Row key={a.id} id={(a.payload.change_id as string | undefined) ?? String(a.id)} href={linkFor(a)} className="row hover:bg-[#fafaf9]">
                  {who && <Avatar profile={who} />}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{who ? (who.id === me.id ? "You" : firstName(who)) : "Someone"}</span>{" "}
                    <span className="text-ink-2">{VERB[a.kind]}</span>{" "}
                    {title && a.kind !== "created" && <span className="font-medium">{title}</span>}
                    <div className="flex items-center gap-1.5 text-[12px] text-muted">
                      <ProjectSwatch id={a.project_id} />
                      {names.get(a.project_id)}
                    </div>
                  </div>
                  <span className="flex-none text-[12px] text-[#8b8d92]">{clockTime(a.created_at)}</span>
                  <span className="flex-none text-faint" aria-hidden>
                    ›
                  </span>
                </Row>
              );
            })}
          </Stagger>
        </section>
      ))}
    </div>
  );
}

/** Where an event leads: the Change it's about, else its project. */
function linkFor(a: Activity) {
  const changeId = a.payload.change_id as string | undefined;
  if (changeId) return `/p/${a.project_id}/c/${changeId}/review`;
  if (a.kind === "restored") return `/p/${a.project_id}/history`;
  if (a.kind === "joined") return `/p/${a.project_id}/people`;
  return `/p/${a.project_id}`;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted">{label}</span>
      <div className="flex flex-wrap gap-0.5 rounded-[6px] bg-[#e4e4e2] p-0.5">{children}</div>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-[5px] px-2.5 py-[3px] ${active ? "bg-white text-ink shadow-[0_1px_1px_rgba(0,0,0,.06)]" : "text-[#55575c] hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
