"use client";

import { useState, useTransition } from "react";
import type { Role } from "@/lib/types";
import { invitePerson } from "../actions";

export function InviteForm({ projectId }: { projectId: string }) {
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await invitePerson(projectId, login, role);
      if (res.error) setMessage({ tone: "error", text: res.error });
      else {
        setMessage({ tone: "ok", text: `Invited @${login.replace(/^@/, "")}. They'll see it on their Home.` });
        setLogin("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input className="input" placeholder="GitHub username" value={login} onChange={(e) => setLogin(e.target.value)} />
        <select className="input w-[110px]" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button className="btn btn-primary h-8" disabled={pending || !login.trim()}>
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>
      {message && (
        <p className={`text-[12px] ${message.tone === "error" ? "text-danger" : "text-new-ink"}`}>{message.text}</p>
      )}
      <span className="git-hint">adds a repo collaborator on GitHub</span>
    </form>
  );
}
