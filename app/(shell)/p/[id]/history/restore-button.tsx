"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { useFeedback } from "@/components/motion/feedback-provider";
import { ActionLabel } from "@/components/motion/spinner";
import { restoreCurrent } from "../actions";

export function RestoreButton({ projectId, changeId, title }: { projectId: string; changeId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();

  if (!confirming) {
    return (
      <button className="text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setConfirming(true)}>
        Go back to before this
      </button>
    );
  }
  return (
    <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-[12px]">
      {error ? (
        <span className="text-danger">{error}</span>
      ) : (
        <span className="text-ink-2">Make Current look like it did just before “{title}”? Anything added after it is taken out too. It all stays in History.</span>
      )}
      <button
        className="btn btn-primary h-6 px-2 text-[12px]"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const id = toast({ tone: "loading", title: "Going back…" });
            const res = await restoreCurrent(projectId, changeId);
            if (res.error) {
              setError(res.error);
              toast({ id, tone: "error", title: "Couldn't go back", description: res.error });
            } else {
              setConfirming(false);
              toast({ id, tone: "success", title: "Current went back", description: `“${title}” is still in History if you need it.` });
            }
          })
        }
      >
        <ActionLabel pending={pending} pendingText="Going back…">
          Go back
        </ActionLabel>
      </button>
      <button className="text-muted" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </motion.span>
  );
}
