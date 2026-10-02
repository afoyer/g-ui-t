import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  getMembers,
  getProfiles,
  listMyOpenChanges,
  listMyProjects,
  listPendingInvites,
  listReviewsForMe,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { autoJoinAccepted } from "@/lib/members";
import { Avatar, Empty, firstName, PreviewTile, SectionLabel, StatusDot, statusLabel, timeAgo } from "@/components/ui";
import { TEMPLATES } from "@/templates";
import { Row, Stagger } from "@/components/motion/stagger";

export default async function HomePage() {
  const me = await requireUser();
  // Invites already accepted on GitHub become memberships first, so they show up as projects.
  const invites = await autoJoinAccepted(me.id, await listPendingInvites(me.github_login));
  const [projects, continuing, reviews] = await Promise.all([
    listMyProjects(me.id),
    listMyOpenChanges(me.id),
    listReviewsForMe(me.id),
  ]);

  // Recent comments from others on my open Changes.
  const supabase = await createClient();
  const { data: comments } = continuing.length
    ? await supabase
        .from("comments")
        .select("id, change_id, author_id, created_at")
        .in("change_id", continuing.map((c) => c.id))
        .neq("author_id", me.id)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const memberCounts = await Promise.all(projects.slice(0, 8).map((p) => getMembers(p.id)));
  const people = await getProfiles([
    ...reviews.map((r) => r.author_id),
    ...(comments ?? []).map((c) => c.author_id),
    ...invites.map((i) => i.invited_by),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col gap-[22px] px-[30px] py-[26px]">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">
            {greeting}, {firstName(me)}
          </h1>
          <div className="mt-0.5 text-[12.5px] text-muted">{today}</div>
        </div>
        <Link href="/new" className="btn btn-primary">
          New Project
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="flex flex-col gap-2">
          <SectionLabel>Continue working</SectionLabel>
          <Stagger className="panel">
            {continuing.map((c) => (
              <Row key={c.id} id={c.id}>
                <StatusDot status={c.status === "draft" ? "editing" : c.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-[12px] text-muted">
                    {c.projects.name} · {c.status === "draft" ? "Saved" : statusLabel(c.status)} {timeAgo(c.updated_at)}
                  </div>
                </div>
                <Link href={`/p/${c.project_id}/c/${c.id}`} className="btn btn-secondary h-[26px] px-2.5 text-[12px]">
                  Resume
                </Link>
              </Row>
            ))}
            {continuing.length === 0 && <Empty>Nothing in progress. Open a project and start a Change.</Empty>}
          </Stagger>
        </section>

        <section className="flex flex-col gap-2">
          <SectionLabel>Needs you</SectionLabel>
          <Stagger className="panel">
            {invites.map((inv) => {
              const by = people.get(inv.invited_by);
              return (
                <Row key={inv.id} id={inv.id} href={`/join/${inv.id}`} className="row hover:bg-[#fafaf9]">
                  {by && <Avatar profile={by} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{inv.projects.name}</div>
                    <div className="text-[12px] text-muted">
                      {by ? firstName(by) : "Someone"} invited you · you&apos;ll be an {inv.role === "editor" ? "Editor" : "Viewer"}
                    </div>
                  </div>
                </Row>
              );
            })}
            {reviews.map((c) => {
              const by = people.get(c.author_id);
              return (
                <Row key={c.id} id={c.id} href={`/p/${c.project_id}/c/${c.id}/review`} className="row hover:bg-[#fafaf9]">
                  {by && <Avatar profile={by} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-[12px] text-muted">{by ? firstName(by) : "Someone"} asked for your review</div>
                  </div>
                </Row>
              );
            })}
            {(comments ?? []).map((cm) => {
              const by = people.get(cm.author_id);
              const change = continuing.find((c) => c.id === cm.change_id)!;
              return (
                <Row
                  key={cm.id}
                  id={cm.id}
                  href={`/p/${change.project_id}/c/${change.id}/review`}
                  className="row hover:bg-[#fafaf9]"
                >
                  {by && <Avatar profile={by} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{change.title}</div>
                    <div className="text-[12px] text-muted">
                      {by ? firstName(by) : "Someone"} left a comment · {timeAgo(cm.created_at)}
                    </div>
                  </div>
                </Row>
              );
            })}
            {invites.length + reviews.length + (comments?.length ?? 0) === 0 && <Empty>You&apos;re all caught up.</Empty>}
          </Stagger>
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>Recent projects</SectionLabel>
        {projects.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 py-10">
            <div className="text-[13px] text-muted">No projects yet.</div>
            <Link href="/new" className="btn btn-primary">
              Start one
            </Link>
          </div>
        ) : (
          <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {projects.slice(0, 8).map((p, i) => {
              const n = memberCounts[i]?.length ?? 1;
              return (
                <Row
                  key={p.id}
                  id={p.id}
                  href={`/p/${p.id}`}
                  className="panel overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-[#c4c4c1] hover:shadow-[0_6px_18px_rgba(0,0,0,.06)]"
                >
                  <PreviewTile label="current preview" className="h-[78px]" />
                  <div className="px-2.5 py-2">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-[12px] text-muted">
                      {TEMPLATES[p.type].label} · {n === 1 ? "Just you" : `${n} people`}
                    </div>
                  </div>
                </Row>
              );
            })}
          </Stagger>
        )}
      </section>
    </div>
  );
}
