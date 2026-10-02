import { getMembers, listChanges } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { componentNames } from "@/lib/files";
import { Avatar, Empty, firstName, StatusBadge, timeAgo } from "@/components/ui";
import { Row, Stagger } from "@/components/motion/stagger";

export default async function ChangesTab({ params }: PageProps<"/p/[id]/changes">) {
  const { id } = await params;
  const me = await requireUser();
  const [changes, members] = await Promise.all([listChanges(id, "all"), getMembers(id)]);
  const people = new Map(members.map((m) => [m.id, m]));
  const open = changes.filter((c) => c.status !== "merged" && c.status !== "closed");
  const done = changes.filter((c) => c.status === "merged" || c.status === "closed");

  const list = (items: typeof changes) => (
    <Stagger className="panel">
      {items.map((c) => {
        const who = people.get(c.author_id);
        const href = c.author_id === me.id && c.status !== "merged" ? `/p/${id}/c/${c.id}` : `/p/${id}/c/${c.id}/review`;
        return (
          <Row key={c.id} id={String(c.id)} href={href} className="row hover:bg-[#fafaf9]">
            {who && <Avatar profile={who} />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{c.title}</div>
              <div className="truncate text-[12px] text-muted">
                {who ? (who.id === me.id ? "You" : firstName(who)) : "Someone"} · {componentNames(c.changed_files).join(", ") || "no edits yet"} ·{" "}
                {timeAgo(c.updated_at)}
                <span className="git-hint"> · {c.branch}</span>
              </div>
            </div>
            <StatusBadge status={c.status} />
          </Row>
        );
      })}
      {items.length === 0 && <Empty>None.</Empty>}
    </Stagger>
  );

  return (
    <div className="flex flex-col gap-5 px-[30px] py-6">
      <section className="flex flex-col gap-2">
        <div className="label">In progress</div>
        {list(open)}
      </section>
      <section className="flex flex-col gap-2">
        <div className="label">Finished</div>
        {list(done)}
      </section>
    </div>
  );
}
