"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { joinProject } from "./actions";

const STEPS = [
  { title: "Accept the invitation on GitHub", hint: "accept repo invitation" },
  { title: "Add you to the team", hint: "project membership" },
  { title: "Open Current, the version everyone shares", hint: "main" },
];

export function JoinSteps({ inviteId, accepted, projectId }: { inviteId: string; accepted: boolean; projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="label">What happens when you open it</div>
        <ol className="mt-2 flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
                  pending ? "animate-pulse bg-accent text-white" : "bg-chip text-ink-2"
                }`}
              >
                {i + 1}
              </span>
              <div>
                <div>{s.title}</div>
                <div className="git-hint">{s.hint}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="rounded-[8px] bg-stage px-3 py-2.5 text-[12px] leading-relaxed text-ink-2">
        Nothing you do affects the others until you share it and it gets approved.
      </p>
      {error && <p className="rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink">{error}</p>}
      {accepted ? (
        <Link href={`/p/${projectId}`} className="btn btn-primary btn-lg">
          Open Project
        </Link>
      ) : (
        <button
          className="btn btn-primary btn-lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await joinProject(inviteId);
              if (res?.error) setError(res.error);
            })
          }
        >
          {pending ? "Setting you up…" : "Open Project"}
        </button>
      )}
    </div>
  );
}
