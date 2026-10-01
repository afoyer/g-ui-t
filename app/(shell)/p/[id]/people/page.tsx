import { getMembers, listProjectInvites } from "@/lib/data";
import { Avatar, SectionLabel } from "@/components/ui";
import { InviteForm } from "./invite-form";

export default async function PeopleTab({ params }: PageProps<"/p/[id]/people">) {
  const { id } = await params;
  const [members, invites] = await Promise.all([getMembers(id), listProjectInvites(id)]);

  return (
    <div className="grid grid-cols-1 gap-6 px-[30px] py-6 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-2">
        <SectionLabel>Members</SectionLabel>
        <div className="panel">
          {members.map((m) => (
            <div key={m.id} className="row">
              <Avatar profile={m} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.name ?? m.github_login}</div>
                <div className="git-hint">@{m.github_login}</div>
              </div>
              <span className="text-[12px] capitalize text-muted">{m.role}</span>
            </div>
          ))}
          {invites.map((i) => (
            <div key={i.id} className="row">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-control text-[10px] text-muted">
                ?
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">@{i.github_login}</div>
                <div className="text-[12px] text-muted">Invited · hasn&apos;t joined yet</div>
              </div>
              <span className="text-[12px] capitalize text-muted">{i.role}</span>
            </div>
          ))}
        </div>
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
