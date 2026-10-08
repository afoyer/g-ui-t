"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useFeedback } from "@/components/motion/feedback-provider";
import { DURATION, EASE_OUT } from "@/lib/motion";
import type { FolderLink } from "@/lib/local-link";

/** "/Users/me/G-ui-t/shop@main" → "~/G-ui-t/shop@main" */
export function tildify(dir: string) {
  return dir.replace(/^(\/Users|\/home)\/[^/]+/, "~");
}

/** "Open on my computer": pairs with `npm run link`, then opens this Change as a folder. */
export function LinkButton({ link, align = "right" }: { link: FolderLink; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useFeedback();

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const connected = link.status === "connected";

  async function openFolder() {
    await link.open();
  }

  async function reveal(app: "finder" | "vscode") {
    setOpen(false);
    try {
      await link.reveal(app);
    } catch (err) {
      toast({
        tone: "error",
        title: app === "vscode" ? "Couldn't open VS Code" : "Couldn't open Finder",
        description: app === "vscode" ? "Is the `code` command installed? (VS Code → Shell Command)" : String(err),
      });
    }
  }

  let button: React.ReactNode;
  if (link.dir) {
    button = (
      <button
        className="inline-flex h-6 items-center gap-1.5 rounded-[5px] bg-new px-2 text-[12px] text-new-ink"
        onClick={() => setOpen(!open)}
        title={link.dir}
      >
        <span className="h-[6px] w-[6px] rounded-full bg-editing" />
        Linked · <span className="max-w-[180px] truncate font-mono text-[11px]">{tildify(link.dir)}</span> ▾
      </button>
    );
  } else if (connected) {
    button = (
      <button className="btn btn-secondary h-6 px-2 text-[12px]" disabled={link.opening} onClick={openFolder}>
        {link.opening ? "Opening…" : "Open on my computer"}
      </button>
    );
  } else {
    button = (
      <button className="btn btn-secondary h-6 px-2 text-[12px]" onClick={() => setOpen(!open)}>
        {link.status === "connecting" ? "Connecting…" : "Open on my computer"}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      {button}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT }}
            className={`absolute top-8 z-50 w-[280px] rounded-[8px] border border-line bg-white p-3 text-[12.5px] shadow-lg ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {link.dir ? (
              <div className="flex flex-col gap-1">
                <div className="mb-1 break-all font-mono text-[11px] text-muted">{tildify(link.dir)}</div>
                <button className="btn btn-ghost h-7 justify-start px-2" onClick={() => reveal("vscode")}>
                  Open in VS Code
                </button>
                <button className="btn btn-ghost h-7 justify-start px-2" onClick={() => reveal("finder")}>
                  Show in Finder
                </button>
                <button
                  className="btn btn-ghost h-7 justify-start px-2 text-muted"
                  onClick={() => {
                    setOpen(false);
                    link.unlink();
                  }}
                >
                  Stop syncing
                </button>
              </div>
            ) : (
              <PairForm link={link} onPaired={() => setOpen(false)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {link.error && !link.dir && !open && (
        <div className="absolute right-0 top-8 z-40 w-[280px] rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink">
          {link.error}
        </div>
      )}
    </div>
  );
}

function PairForm({ link, onPaired }: { link: FolderLink; onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await link.pair(code);
      onPaired();
      // The folder opens once the connection is up (see useFolderLink).
      await link.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="leading-[1.45] text-ink-2">
        {link.status === "off" ? "Can't reach your computer. " : ""}
        Run <code className="rounded bg-chip px-1 font-mono text-[11.5px]">npm run link</code> in the G-ui-t repo, then paste
        the code it prints.
      </div>
      <div className="flex gap-1.5">
        <input
          autoFocus
          className="input h-7 font-mono text-[12px]"
          placeholder="Pairing code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn btn-primary h-7 px-2.5 text-[12px]" disabled={busy || !code.trim()}>
          {busy ? "…" : "Connect"}
        </button>
      </div>
      {error && <div className="text-[12px] text-danger">{error}</div>}
      <div className="git-hint">Each Change becomes its own git clone in ~/G-ui-t</div>
    </form>
  );
}
