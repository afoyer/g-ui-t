import Link from "next/link";
import { getMembers, getProject, listActivity, listChanges, listReviewsForMe } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { findOverlaps } from "@/lib/overlap";
import { componentNames } from "@/lib/files";
import { Avatar, Chip, Empty, firstName, PreviewTile, SectionLabel, StatusDot, statusLabel, timeAgo } from "@/components/ui";
import { StartChangeButton } from "./start-change";

export default async function ProjectOverview({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const me = await requireUser();
  const [project, members, open, merged, activity, reviews] = await Promise.all([
    getProject(id),
    getMembers(id),
    listChanges(id, "open"),
    listChanges(id, "merged"),
    listActivity([id], 1),
    listReviewsForMe(me.id),
  ]);

  const mine = open.filter((c) => c.author_id === me.id);
  const others = open.filter((c) => c.author_id !== me.id);
  const byId = new Map(members.map((m) => [m.id, m]));
  const lastMerged = merged.find((c) => c.merged_at);
  const lastActor = lastMerged ? byId.get(lastMerged.merged_by ?? lastMerged.author_id) : undefined;
  const myReviews = reviews.filter((r) => r.project_id === id);
  const overlaps = mine.flatMap((c) => findOverlaps(c, others).map((o) => ({ mine: c, ...o })));
  const lastEvent = activity[0];

  return (
    <div className="grid grid-cols-1 gap-6 px-[30px] py-6 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <section className="panel flex overflow-hidden">
          <PreviewTile label="current preview" className="w-[220px] flex-none" />
          <div className="flex flex-1 flex-col gap-1.5 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-shared" />
              <span className="font-semibold">Current</span>
              <span className="git-hint">
                {project.default_branch} · {project.current_sha?.slice(0, 7)}
              </span>
            </div>
            <div className="text-[12.5px] text-ink-2">The version everyone shares</div>
            <div className="text-[12px] text-muted">
              {lastMerged
                ? `Updated ${timeAgo(lastMerged.merged_at)}. ${lastActor ? firstName(lastActor) : "Someone"} added ${lastMerged.title}.`
                : lastEvent?.kind === "restored"
                  ? `Restored ${timeAgo(lastEvent.created_at)}.`
                  : `Started ${timeAgo(project.updated_at)}. Changes are added only after review.`}
            </div>
            <div className="mt-auto flex gap-2 pt-2">
              <Link href={`/p/${id}/preview`} className="btn btn-secondary">
                Open preview
              </Link>
              <Link href={`/p/${id}/history`} className="btn btn-ghost">
                What changed
              </Link>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionLabel>Your work</SectionLabel>
          <div className="panel">
            {mine.map((c) => (
              <div key={c.id} className="row">
                <StatusDot status={c.status === "draft" ? "editing" : c.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-[12px] text-muted">
                    {c.status === "draft" ? "Editing" : statusLabel(c.status)} · {c.changed_files.length} files ·{" "}
                    {c.status === "draft" ? "not shared yet" : `updated ${timeAgo(c.updated_at)}`}
                    <span className="git-hint"> · {c.branch}</span>
                  </div>
                </div>
                <Link href={`/p/${id}/c/${c.id}`} className="btn btn-secondary h-[26px] px-2.5 text-[12px]">
                  Open
                </Link>
              </div>
            ))}
            {mine.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="text-[12.5px] text-muted">You&apos;re not working on anything here yet.</div>
                <StartChangeButton projectId={id} />
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionLabel>Team</SectionLabel>
          <div className="panel">
            {members
              .filter((m) => m.id !== me.id)
              .map((m) => {
                const work = others.filter((c) => c.author_id === m.id);
                return (
                  <div key={m.id} className="row">
                    <Avatar profile={m} />
                    <div className="min-w-0 flex-1">
                      {work.length === 0 ? (
                        <span>
                          {firstName(m)} <span className="text-muted">· nothing active</span>
                        </span>
                      ) : (
                        work.map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="truncate">
                              {firstName(m)} · {c.title}
                            </span>
                            <span className="flex items-center gap-1.5 text-[12px] text-muted">
                              <StatusDot status={c.status} />
                              {statusLabel(c.status)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            {members.length <= 1 && (
              <Empty>
                Just you so far. <Link className="underline" href={`/p/${id}/people`}>Invite people</Link>
              </Empty>
            )}
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-2">
        <SectionLabel>Needs attention</SectionLabel>
        <div className="flex flex-col gap-3">
          {myReviews.map((c) => {
            const by = byId.get(c.author_id);
            return (
              <div key={c.id} className="panel flex flex-col gap-2 p-3">
                <div className="font-medium">{c.title}</div>
                <div className="text-[12px] text-muted">{by ? firstName(by) : "Someone"} asked you to review it</div>
                <Link href={`/p/${id}/c/${c.id}/review`} className="btn btn-primary w-fit">
                  Review
                </Link>
              </div>
            );
          })}
          {overlaps.map((o) => {
            const who = byId.get(o.change.author_id);
            return (
              <div key={o.mine.id + o.change.id} className="flex flex-col gap-2 rounded-[8px] bg-note p-3">
                <div className="font-medium">Possible overlap</div>
                <div className="text-[12px] leading-relaxed text-ink-2">
                  You and {who ? firstName(who) : "a teammate"} are both changing{" "}
                  {o.components.map((c, i) => (
                    <b key={c} className="font-semibold">
                      {i > 0 && ", "}
                      {c}
                    </b>
                  ))}
                  . Nothing is wrong yet.
                </div>
                <Link href={`/p/${id}/c/${o.change.id}/review`} className="text-[12px] underline">
                  See {who ? `${firstName(who)}'s` : "their"} work
                </Link>
              </div>
            );
          })}
          {myReviews.length + overlaps.length === 0 && (
            <div className="panel">
              <Empty>Nothing needs you right now.</Empty>
            </div>
          )}
          {others.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <SectionLabel>Being changed right now</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {componentNames(others.flatMap((c) => c.changed_files)).map((n) => (
                  <Chip key={n}>{n}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
