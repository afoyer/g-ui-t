"use client";

import { useState, useTransition } from "react";
import { useFeedback } from "@/components/motion/feedback-provider";
import type { Role } from "@/lib/types";
import { changeRole, invitePerson, removeMember, withdrawInvite } from "../actions";

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();
  const run = (fn: () => Promise<{ error?: string }>, success?: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setError(res.error);
        toast({ tone: "error", title: "That didn't work", description: res.error });
      } else if (success) toast({ tone: "success", title: success });
    });
  };
  return { error, pending, run };
}

export function MemberControls({ projectId, userId, role }: { projectId: string; userId: string; role: Role }) {
  const { error, pending, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          className="rounded-[5px] bg-transparent text-[12px] text-ink-2"
          value={role}
          disabled={pending}
          aria-label="Role"
          onChange={(e) => {
            const next = e.target.value as Role;
            run(() => changeRole(projectId, userId, next), `Now ${next === "editor" ? "an Editor" : "a Viewer"}`);
          }}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        {confirming ? (
          <>
            <button className="btn btn-primary h-6 px-2 text-[12px]" disabled={pending} onClick={() => run(() => removeMember(projectId, userId), "Removed from the project")}>
              {pending ? "Removing…" : "Remove"}
            </button>
            <button className="text-[12px] text-muted" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="text-[12px] text-faint hover:text-danger" onClick={() => setConfirming(true)}>
            Remove
          </button>
        )}
      </div>
      {error && <span className="text-[11.5px] text-danger">{error}</span>}
    </div>
  );
}

export function InviteControls({
  projectId,
  inviteId,
  login,
  role,
  declined,
}: {
  projectId: string;
  inviteId: string;
  login: string;
  role: Role;
  declined: boolean;
}) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 text-[12px]">
        {declined && (
          <button className="text-accent" disabled={pending} onClick={() => run(() => invitePerson(projectId, login, role), `Invited @${login} again`)}>
            Invite again
          </button>
        )}
        <button className="text-faint hover:text-danger" disabled={pending} onClick={() => run(() => withdrawInvite(projectId, inviteId), "Invite withdrawn")}>
          {pending ? "…" : "Withdraw"}
        </button>
      </div>
      {error && <span className="text-[11.5px] text-danger">{error}</span>}
    </div>
  );
}
