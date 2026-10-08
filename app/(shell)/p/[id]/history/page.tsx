import Link from "next/link";
import { getMembers, listActivity, listChanges } from "@/lib/data";
import { componentNames } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";
import { Avatar, clockTime, Empty, firstName } from "@/components/ui";
import { groupByDay } from "@/lib/dates";
import { RestoreButton } from "./restore-button";
import { Row, Stagger } from "@/components/motion/stagger";

type Entry =
  | { kind: "merged"; at: string; id: string; title: string; actorId: string; approvers: string[]; components: string[]; sha: string | null; pr: number | null; changeId: string }
  | { kind: "restored"; at: string; id: string; title: string; actorId: string; sha: string | null };

export default async function HistoryPage({ params, searchParams }: PageProps<"/p/[id]/history">) {
  const { id } = await params;
  const { who } = await searchParams;
  const [merged, activity, members] = await Promise.all([listChanges(id, "merged"), listActivity([id], 200), getMembers(id)]);

  const supabase = await createClient();
  const { data: approvals } = merged.length
    ? await supabase.from("review_requests").select("change_id, reviewer_id").eq("state", "approved").in("change_id", merged.map((c) => c.id))
    : { data: [] };

  const people = new Map(members.map((m) => [m.id, m]));
  const entries: Entry[] = [
    ...merged.map((c) => ({
      kind: "merged" as const,
      at: c.merged_at ?? c.updated_at,
      id: c.id,
      changeId: c.id,
      title: c.title,
      actorId: c.author_id,
      approvers: (approvals ?? []).filter((a) => a.change_id === c.id).map((a) => a.reviewer_id),
      components: componentNames(c.changed_files),
      sha: c.merge_sha,
      pr: c.pr_number,
    })),
    ...activity
      .filter((a) => a.kind === "restored")
      .map((a) => ({
        kind: "restored" as const,
        at: a.created_at,
        id: `r${a.id}`,
        title: String(a.payload.title ?? ""),
        actorId: a.actor_id,
        sha: (a.payload.sha as string) ?? null,
      })),
  ]
    .filter((e) => typeof who !== "string" || e.actorId === who)
    .sort((a, b) => b.at.localeCompare(a.at));

  const days = groupByDay(entries, (e) => e.at);

  return (
    <div className="flex flex-col gap-5 px-[30px] py-6">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="label mr-1">What&apos;s been added to Current</span>
        <span className="ml-auto mr-1 text-muted">Show changes by</span>
        <div className="flex gap-0.5 rounded-[6px] bg-[#e4e4e2] p-0.5">
        <FilterLink href={`/p/${id}/history`} active={typeof who !== "string"}>
          Anyone
        </FilterLink>
        {members.map((m) => (
          <FilterLink key={m.id} href={`/p/${id}/history?who=${m.id}`} active={who === m.id}>
            {firstName(m)}
          </FilterLink>
        ))}
        </div>
      </div>

      {days.length === 0 && (
        <div className="panel">
          <Empty>Nothing has been added to Current yet. Approved Changes show up here.</Empty>
        </div>
      )}

      {days.map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <div className="label">{day}</div>
          <Stagger className="panel">
            {list.map((e) => {
              const actor = people.get(e.actorId);
              return (
                <Row key={e.id} id={String(e.id)} className="row items-start">
                  {e.kind === "merged" ? (
                    actor && <Avatar profile={actor} />
                  ) : (
                    <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-chip text-muted">↺</span>
                  )}
                  <div className="min-w-0 flex-1">
                    {e.kind === "merged" ? (
                      <>
                        <div>
                          <b className="font-medium">{e.title}</b>{" "}
                          <span className="text-muted">added to Current by {actor ? firstName(actor) : "someone"}</span>
                        </div>
                        <div className="text-[12px] text-muted">
                          {e.components.join(", ") || "No visual changes"}
                          {e.approvers.length > 0 &&
                            ` · approved by ${e.approvers.map((a) => (people.get(a) ? firstName(people.get(a)!) : "someone")).join(", ")}`}
                          <span className="git-hint">
                            {" "}
                            · merge {e.sha?.slice(0, 7)}
                            {e.pr && ` · #${e.pr}`}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-4">
                          {e.sha && (
                            <Link href={`/p/${id}/compare?change=${e.changeId}`} className="text-[12px] underline-offset-2 hover:underline">
                              Compare
                            </Link>
                          )}
                          <Link href={`/p/${id}/c/${e.changeId}/review`} className="text-[12px] text-muted hover:text-ink">
                            Discussion
                          </Link>
                          {e.sha && <RestoreButton projectId={id} changeId={e.changeId} title={e.title} />}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <b className="font-medium">Current restored</b>{" "}
                          <span className="text-muted">to before {e.title}</span>
                        </div>
                        <div className="text-[12px] text-muted">
                          by {actor ? firstName(actor) : "someone"} · {e.title} is still in History
                          <span className="git-hint"> · {e.sha?.slice(0, 7)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <span className="text-[12px] text-[#8b8d92]">{clockTime(e.at)}</span>
                </Row>
              );
            })}
          </Stagger>
        </section>
      ))}
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
