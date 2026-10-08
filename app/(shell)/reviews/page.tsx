import Link from "next/link";
import { Row, Stagger } from "@/components/motion/stagger";
import { getProfiles, listMyFinishedReviews, listMyInReview, listReviewsForMe, listWaitingReviewers } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { Avatar, firstName, SectionLabel, StatusBadge, timeAgo } from "@/components/ui";

export default async function ReviewsPage() {
  const me = await requireUser();
  const [waiting, mine, finished] = await Promise.all([
    listReviewsForMe(me.id),
    listMyInReview(me.id),
    listMyFinishedReviews(me.id),
  ]);
  const [people, waitingOn] = await Promise.all([
    getProfiles(waiting.map((c) => c.author_id)),
    listWaitingReviewers(mine.map((c) => c.id)),
  ]);
  const nothing = waiting.length + mine.length + finished.length === 0;

  return (
    <div className="flex max-w-[860px] flex-col gap-6 px-[30px] py-[26px]">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Reviews</h1>

      {nothing && (
        <div className="panel flex flex-col items-center gap-2 px-6 py-10 text-center">
          <div className="text-[13px] font-medium">No reviews yet</div>
          <p className="max-w-[380px] text-[12.5px] text-muted">
            When you share a Change, or a teammate asks you to look at theirs, it shows up here, and stays here once
            it&apos;s done.
          </p>
        </div>
      )}

      {waiting.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Waiting on you</SectionLabel>
          <Stagger className="panel">
            {waiting.map((c) => {
              const by = people.get(c.author_id);
              return (
                <Row key={c.id} id={c.id} href={`/p/${c.project_id}/c/${c.id}/review`} className="row hover:bg-[#fafaf9]">
                  {by && <Avatar profile={by} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-[12px] text-muted">
                      {c.projects.name} · from {by ? firstName(by) : "someone"} · {timeAgo(c.updated_at)}
                      {c.pr_number && <span className="git-hint"> · PR #{c.pr_number}</span>}
                    </div>
                  </div>
                  <span className="btn btn-primary h-[26px] text-[12px]">Review</span>
                </Row>
              );
            })}
          </Stagger>
        </section>
      )}

      {mine.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Yours, out for review</SectionLabel>
          <Stagger className="panel">
            {mine.map((c) => {
              const on = waitingOn.get(c.id) ?? [];
              return (
                <Row key={c.id} id={c.id} href={`/p/${c.project_id}/c/${c.id}/review`} className="row hover:bg-[#fafaf9]">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-[12px] text-muted">
                      {c.projects.name} · shared {timeAgo(c.updated_at)}
                      {c.status === "in_review" && on.length > 0 && <> · waiting on {on.map(firstName).join(", ")}</>}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </Row>
              );
            })}
          </Stagger>
        </section>
      )}

      {finished.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel right={<Link href="/activity" className="text-[12px] text-muted hover:text-ink">All activity →</Link>}>
            Recently finished
          </SectionLabel>
          <Stagger className="panel">
            {finished.map(({ change: c, myAnswer }) => (
              <Row key={c.id} id={c.id} href={`/p/${c.project_id}/c/${c.id}/review`} className="row hover:bg-[#fafaf9]">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-[12px] text-muted">
                    {c.projects.name} ·{" "}
                    {myAnswer === "approved"
                      ? "you approved it"
                      : myAnswer === "changes_requested"
                        ? "you asked for changes"
                        : "yours"}{" "}
                    · {timeAgo(c.merged_at ?? c.updated_at)}
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </Row>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}
