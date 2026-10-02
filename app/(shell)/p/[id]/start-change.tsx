"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useFeedback } from "@/components/motion/feedback-provider";
import { ActionLabel } from "@/components/motion/spinner";
import { startChange } from "./actions";

export function StartChangeButton({ projectId, label = "Start Change" }: { projectId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = toast({
      tone: "loading",
      title: `Starting “${title.trim()}”…`,
      description: "Making your own copy of Current",
      onNavigate: { tone: "success", title: "Your Change is ready", description: "Edits save as checkpoints automatically." },
    });
    startTransition(async () => {
      const res = await startChange(projectId, title, description);
      if (res?.error) {
        setError(res.error);
        toast({ id, tone: "error", title: "Couldn't start the Change", description: res.error });
      }
    });
  }

  return (
    <div className="relative">
      <button className="btn btn-primary" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
      </button>
      <AnimatePresence>
      {open && (
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -4, transition: { duration: DURATION.fast } }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          style={{ originX: 1, originY: 0 }}
          className="absolute right-0 z-20 mt-2 flex w-[320px] flex-col gap-3 rounded-[10px] border border-line bg-white p-4 shadow-[0_14px_36px_rgba(0,0,0,.12)]"
        >
          <div>
            <div className="font-semibold">Start a Change</div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Your own copy of Current. Nothing you do reaches the others until it&apos;s reviewed.
            </p>
          </div>
          <input
            className="input"
            placeholder="What are you working on?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="input"
            rows={2}
            placeholder="A sentence for reviewers (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink">{error}</p>}
          <div className="flex items-center justify-between">
            <span className="git-hint">git checkout -b</span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={pending || !title.trim()}>
                <ActionLabel pending={pending} pendingText="Starting…">
                  Start
                </ActionLabel>
              </button>
            </div>
          </div>
        </motion.form>
      )}
      </AnimatePresence>
    </div>
  );
}
