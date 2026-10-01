import Link from "next/link";
import { getProfiles, listMyInReview, listReviewsForMe } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { Avatar, Empty, firstName, SectionLabel, StatusBadge, timeAgo } from "@/components/ui";

export default async function ReviewsPage() {
  const me = await requireUser();
  const [waiting, mine] = await Promise.all([listReviewsForMe(me.id), listMyInReview(me.id)]);
  const people = await getProfiles(waiting.map((c) => c.author_id));

  return (
    <div className="flex max-w-[860px] flex-col gap-6 px-[30px] py-[26px]">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Reviews</h1>
      <section className="flex flex-col gap-2">
        <SectionLabel>Waiting on you</SectionLabel>
        <div className="panel">
          {waiting.map((c) => {
            const by = people.get(c.author_id);
            return (
              <Link key={c.id} href={`/p/${c.project_id}/c/${c.id}/review`} className="row hover:bg-[#fafaf9]">
                {by && <Avatar profile={by} />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-[12px] text-muted">
                    {c.projects.name} · {by ? firstName(by) : "Someone"} · {timeAgo(c.updated_at)}
                    {c.pr_number && <span className="git-hint"> · PR #{c.pr_number}</span>}
                  </div>
                </div>
                <span className="btn btn-primary h-[26px] text-[12px]">Review</span>
              </Link>
            );
          })}
          {waiting.length === 0 && <Empty>Nobody is waiting on you.</Empty>}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <SectionLabel>Yours, out for review</SectionLabel>
        <div className="panel">
          {mine.map((c) => (
            <Link key={c.id} href={`/p/${c.project_id}/c/${c.id}/review`} className="row hover:bg-[#fafaf9]">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.title}</div>
                <div className="text-[12px] text-muted">
                  {c.projects.name} · shared {timeAgo(c.updated_at)}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
          {mine.length === 0 && <Empty>You haven&apos;t shared anything for review.</Empty>}
        </div>
      </section>
    </div>
  );
}
