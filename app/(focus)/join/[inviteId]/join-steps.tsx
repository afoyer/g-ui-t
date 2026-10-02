"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { useFeedback } from "@/components/motion/feedback-provider";
import { ActionLabel } from "@/components/motion/spinner";
import { joinProject } from "./actions";

const STEPS = [
  { title: "Accept the invitation on GitHub", hint: "accept repo invitation" },
  { title: "Add you to the team", hint: "project membership" },
  { title: "Open Current, the version everyone shares", hint: "main" },
];

export function JoinSteps({ inviteId, accepted, projectId }: { inviteId: string; accepted: boolean; projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useFeedback();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="label">What happens when you open it</div>
        <ol className="mt-2 flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              className="flex items-start gap-3"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
            >
              <span
                className="relative flex h-5 w-5 flex-none items-center justify-center overflow-hidden rounded-full bg-chip text-[11px] font-semibold text-ink-2"
              >
                {pending && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-accent"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.6, duration: 0.3 }}
                  />
                )}
                <span className={`relative ${pending ? "text-white" : ""}`}>{i + 1}</span>
              </span>
              <div>
                <div>{s.title}</div>
                <div className="git-hint">{s.hint}</div>
              </div>
            </motion.li>
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
              const id = toast({
                tone: "loading",
                title: "Joining…",
                description: "Accepting the invitation on GitHub",
                onNavigate: { tone: "success", title: "You're in", description: "You're looking at Current, the shared version." },
              });
              const res = await joinProject(inviteId);
              if (res?.error) {
                setError(res.error);
                toast({ id, tone: "error", title: "Couldn't join", description: res.error });
              }
            })
          }
        >
          <ActionLabel pending={pending} pendingText="Setting you up…">
            Open Project
          </ActionLabel>
        </button>
      )}
    </div>
  );
}
