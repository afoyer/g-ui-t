import { getMembers, getProject, listProjectInvites } from "@/lib/data";
import { syncInvites, type InviteStatus } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { Avatar, SectionLabel } from "@/components/ui";
import { InviteForm } from "./invite-form";
import { InviteControls, MemberControls } from "./member-controls";

const STATUS_TEXT: Record<InviteStatus, string> = {
  waiting: "Invited · hasn't accepted on GitHub yet",
  needs_sign_in: "Accepted on GitHub · hasn't opened G-ui-t yet",
  declined: "Invitation declined or expired",
  unknown: "Invited",
};

export default async function PeopleTab({ params }: PageProps<"/p/[id]/people">) {
  const { id } = await params;
  const me = await requireUser();
  const project = await getProject(id);

  // Catch up with anyone who accepted on GitHub before rendering the list.
  const pendingBefore = await listProjectInvites(id);
  const { statuses, joined } = await syncInvites(project, pendingBefore, me.id);
  const [members, invites] = joined
    ? await Promise.all([getMembers(id), listProjectInvites(id)])
    : [await getMembers(id), pendingBefore];

  const isOwner = project.owner_id === me.id;

  return (
    <div className="grid grid-cols-1 gap-6 px-[30px] py-6 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-2">
        <SectionLabel>Members</SectionLabel>
        <div className="panel">
          {members.map((m) => (
            <div key={m.id} className="row">
              <Avatar profile={m} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {m.name ?? m.github_login}
                  {m.id === me.id && <span className="font-normal text-muted"> (you)</span>}
                </div>
                <div className="git-hint">@{m.github_login}</div>
              </div>
              {isOwner && m.id !== me.id ? (
                <MemberControls projectId={id} userId={m.id} role={m.role} />
              ) : (
                <span className="text-[12px] text-muted">{m.id === project.owner_id ? "Owner" : m.role === "editor" ? "Editor" : "Viewer"}</span>
              )}
            </div>
          ))}
          {invites.map((i) => {
            const status = statuses.get(i.id) ?? "unknown";
            return (
              <div key={i.id} className="row">
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-dashed border-control text-[10px] text-muted">
                  ?
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">@{i.github_login}</div>
                  <div className={`text-[12px] ${status === "declined" ? "text-danger" : "text-muted"}`}>
                    {STATUS_TEXT[status]} · {i.role === "editor" ? "Editor" : "Viewer"}
                  </div>
                </div>
                {isOwner && (
                  <InviteControls projectId={id} inviteId={i.id} login={i.github_login} role={i.role} declined={status === "declined"} />
                )}
              </div>
            );
          })}
        </div>
        {invites.some((i) => statuses.get(i.id) === "needs_sign_in") && (
          <p className="text-[12px] text-muted">
            People who accepted on GitHub join automatically as soon as they open G-ui-t.
          </p>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <SectionLabel>Invite someone</SectionLabel>
        <div className="panel p-4">
          <p className="mb-3 text-[12.5px] text-muted">
            Editors can start Changes, review and add work to Current. Viewers can look and comment.
          </p>
          <InviteForm projectId={id} />
        </div>
      </section>
    </div>
  );
}
