import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfiles } from "@/lib/data";
import { TopBar } from "@/components/top-bar";
import { Avatar, firstName } from "@/components/ui";
import { TEMPLATES } from "@/templates";
import type { Invite, Project } from "@/lib/types";
import { JoinSteps } from "./join-steps";

export default async function JoinPage({ params }: PageProps<"/join/[inviteId]">) {
  const { inviteId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("invites").select("*, projects(*)").eq("id", inviteId).maybeSingle();
  if (!data) notFound();
  const invite = data as Invite & { projects: Project };
  const inviter = (await getProfiles([invite.invited_by])).get(invite.invited_by);

  return (
    <>
      <TopBar left={<span className="ml-2 font-semibold">Joining a project</span>} />
      <div className="flex flex-1 items-start justify-center overflow-y-auto bg-stage px-4 py-16">
        <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-[10px] border border-line bg-white p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            {inviter && <Avatar profile={inviter} size={40} />}
            <div className="text-[13px] text-muted">{inviter ? `${firstName(inviter)} invited you to` : "You're invited to"}</div>
            <h1 className="text-[24px] font-semibold tracking-[-0.01em]">{invite.projects.name}</h1>
            <div className="text-[12.5px] text-muted">
              {invite.projects.description || TEMPLATES[invite.projects.type].label} · you&apos;ll be an{" "}
              {invite.role === "editor" ? "Editor" : "Viewer"}
            </div>
          </div>
          <JoinSteps inviteId={inviteId} accepted={Boolean(invite.accepted_at)} projectId={invite.project_id} />
        </div>
      </div>
    </>
  );
}
