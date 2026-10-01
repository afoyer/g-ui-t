"use client";

import { useState, useTransition } from "react";
import { restoreCurrent } from "../actions";

export function RestoreButton({ projectId, changeId, title }: { projectId: string; changeId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button className="text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setConfirming(true)}>
        Restore before this
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[12px]">
      {error ? (
        <span className="text-danger">{error}</span>
      ) : (
        <span className="text-ink-2">Put Current back to before “{title}”? It stays in History.</span>
      )}
      <button
        className="btn btn-primary h-6 px-2 text-[12px]"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await restoreCurrent(projectId, changeId);
            if (res.error) setError(res.error);
            else setConfirming(false);
          })
        }
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
      <button className="text-muted" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
