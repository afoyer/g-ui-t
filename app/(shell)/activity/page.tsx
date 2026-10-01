import Link from "next/link";
import { getProfiles, listActivity, listMyProjects } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { Avatar, Empty, firstName, ProjectSwatch, timeAgo } from "@/components/ui";
import type { Activity } from "@/lib/types";

const VERB: Record<Activity["kind"], string> = {
  created: "created the project",
  change_started: "started",
  shared: "shared for review",
  approved: "approved",
  changes_requested: "asked for changes on",
  merged: "added to Current",
  restored: "restored Current to before",
  joined: "joined the project",
  commented: "commented on",
};

export default async function ActivityPage() {
  const me = await requireUser();
  const projects = await listMyProjects(me.id);
  const activity = await listActivity(projects.map((p) => p.id), 60);
  const people = await getProfiles(activity.map((a) => a.actor_id));
  const names = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div className="flex max-w-[860px] flex-col gap-5 px-[30px] py-[26px]">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Activity</h1>
      <div className="panel">
        {activity.map((a) => {
          const who = people.get(a.actor_id);
          const changeId = a.payload.change_id as string | undefined;
          const title = a.payload.title as string | undefined;
          return (
            <div key={a.id} className="row">
              {who && <Avatar profile={who} />}
              <div className="min-w-0 flex-1">
                <span className="font-medium">{who ? (who.id === me.id ? "You" : firstName(who)) : "Someone"}</span>{" "}
                <span className="text-ink-2">{VERB[a.kind]}</span>{" "}
                {title && a.kind !== "created" && (
                  changeId ? (
                    <Link href={`/p/${a.project_id}/c/${changeId}/review`} className="font-medium hover:underline">
                      {title}
                    </Link>
                  ) : (
                    <span className="font-medium">{title}</span>
                  )
                )}
                <div className="flex items-center gap-1.5 text-[12px] text-muted">
                  <ProjectSwatch id={a.project_id} />
                  <Link href={`/p/${a.project_id}`} className="hover:underline">
                    {names.get(a.project_id)}
                  </Link>
                  · {timeAgo(a.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        {activity.length === 0 && <Empty>No activity yet.</Empty>}
      </div>
    </div>
  );
}
