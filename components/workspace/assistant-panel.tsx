"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { componentName } from "@/lib/files";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { runAssistant, suggestionsFor, type AssistantResult, type Step } from "@/lib/assistant/intents";
import { describeSelection, type Selection } from "@/lib/assistant/selection";
import type { FileMap } from "@/lib/types";
import { Spinner } from "@/components/motion/spinner";

/** Delay between "Looking at…" / "Editing…" lines, so the work reads as it happens. */
const STEP_MS = 420;

export type ChatMessage =
  | { id: number; role: "user"; text: string; selection: Selection | null }
  | {
      id: number;
      role: "assistant";
      result: AssistantResult;
      /** How many steps are on screen so far. */
      shown: number;
      done: boolean;
      /** The edited files as they were before, for Undo. */
      before: FileMap;
      undone: boolean;
    };

type Props = {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  files: FileMap;
  selection: Selection | null;
  onClearSelection: () => void;
  editable: boolean;
  /** Writes files into the preview and saves a named version. */
  onApply: (files: FileMap, summary: string) => Promise<void>;
};

/** "Claude": a scripted assistant that edits the project for you. See lib/assistant. */
export function AssistantPanel({ messages, setMessages, files, selection, onClearSelection, editable, onApply }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = messages.some((m) => m.role === "assistant" && !m.done);
  // Steps play out over a second or two; by then `onApply` has a newer closure.
  const applyRef = useRef(onApply);
  useEffect(() => {
    applyRef.current = onApply;
  });

  // Picking an element hands focus straight to the composer.
  useEffect(() => {
    if (selection) inputRef.current?.focus();
  }, [selection]);

  // Follow the conversation as it grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    const prompt = text.trim();
    if (!prompt || busy || !editable) return;
    // A suggestion with a blank to fill goes into the composer instead.
    if (prompt.includes("…")) {
      setDraft(prompt.replace(/“…”|…/, "“”"));
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        const at = el.value.indexOf("”");
        el.setSelectionRange(at, at);
      });
      return;
    }
    const result = runAssistant(prompt, { files, selection });
    const before = result.ok ? Object.fromEntries(Object.keys(result.edits).map((p) => [p, files[p] ?? ""])) : {};
    // Messages are only ever appended, so their position is a stable id.
    const id = messages.length + 1;
    setMessages((m) => [
      ...m,
      { id: id - 1, role: "user", text: prompt, selection },
      { id, role: "assistant", result, shown: 0, done: false, before, undone: false },
    ]);
    setDraft("");
    onClearSelection();
    void play(id, result);
  }

  async function play(id: number, result: AssistantResult) {
    const patch = (fn: (m: Extract<ChatMessage, { role: "assistant" }>) => Partial<ChatMessage>) =>
      setMessages((all) => all.map((m) => (m.id === id && m.role === "assistant" ? ({ ...m, ...fn(m) } as ChatMessage) : m)));
    const steps = result.ok ? result.steps.length : 0;
    for (let i = 1; i <= steps; i++) {
      await wait(STEP_MS);
      patch(() => ({ shown: i }));
    }
    await wait(steps ? STEP_MS / 2 : STEP_MS * 1.5);
    if (result.ok) await applyRef.current(result.edits, result.summary);
    patch(() => ({ done: true }));
  }

  async function undo(id: number) {
    const msg = messages.find((m) => m.id === id);
    if (!msg || msg.role !== "assistant" || !msg.result.ok || msg.undone) return;
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, undone: true } : m)));
    await applyRef.current(msg.before, `Undid: ${msg.result.summary}`);
  }

  const suggestions = suggestionsFor({ files, selection });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-3 pb-2">
            <div className="flex items-center gap-2">
              <ClaudeMark />
              <span className="text-[13px] font-semibold">What would you like to change?</span>
            </div>
            <p className="text-[12.5px] leading-[1.5] text-muted">
              Describe it in your own words. To point at something, press <b className="font-medium text-ink-2">Select</b>{" "}
              above the preview and click it. Every change is saved as a version you can undo.
            </p>
            {editable && <Suggestions items={suggestions} onPick={send} />}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT }}
                  className="ml-8 flex flex-col items-end gap-1"
                >
                  {m.selection && <SelectionChip selection={m.selection} />}
                  <div className="rounded-[10px] rounded-br-[3px] bg-stage px-3 py-2 text-[12.5px] leading-[1.45]">{m.text}</div>
                </motion.div>
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  onUndo={() => void undo(m.id)}
                  onSuggest={send}
                  canUndo={editable && !busy}
                />
              ),
            )}
          </div>
        )}
      </div>

      {editable ? (
        <form
          className="flex-none border-t border-line-soft p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <div className="flex flex-col gap-2 rounded-[10px] border border-control bg-white p-2 focus-within:border-accent focus-within:shadow-[0_0_0_3px_oklch(0.48_0.13_265/0.12)]">
            <AnimatePresence initial={false}>
              {selection && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT }}
                >
                  <SelectionChip selection={selection} onClear={onClearSelection} />
                </motion.div>
              )}
            </AnimatePresence>
            <textarea
              ref={inputRef}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder={selection ? "What should change about it?" : "e.g. Make the button green"}
              className="w-full resize-none bg-transparent px-1 text-[13px] leading-[1.45] outline-none placeholder:text-faint"
            />
            <div className="flex items-center justify-between">
              <span className="px-1 text-[11px] text-faint">Enter to send · Shift+Enter for a new line</span>
              <button className="btn btn-primary h-7 px-3 text-[12px]" disabled={busy || !draft.trim()}>
                {busy ? <Spinner /> : "Send"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex-none border-t border-line-soft px-4 py-3 text-[12px] text-muted">
          This Change is finished, so it can&apos;t be edited.
        </div>
      )}
    </div>
  );
}

function AssistantMessage({
  message,
  onUndo,
  onSuggest,
  canUndo,
}: {
  message: Extract<ChatMessage, { role: "assistant" }>;
  onUndo: () => void;
  onSuggest: (s: string) => void;
  canUndo: boolean;
}) {
  const { result, shown, done, undone } = message;
  const steps = result.ok ? result.steps.slice(0, shown) : [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      className="mr-4 flex gap-2.5"
    >
      <ClaudeMark />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {steps.length > 0 && (
          <ul className="flex flex-col gap-1">
            {steps.map((s, i) => (
              <StepLine key={i} step={s} />
            ))}
          </ul>
        )}
        {!done ? (
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <Spinner size={11} /> {steps.length ? "Working…" : "Thinking…"}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
            <p className="text-[12.5px] leading-[1.5] text-ink">{result.reply}</p>
            {result.ok ? (
              <div className="flex items-center gap-2 text-[11.5px]">
                <span className="inline-flex items-center gap-1 text-new-ink">
                  <span aria-hidden>✓</span> Saved as “{result.summary}”
                </span>
                {undone ? (
                  <span className="text-muted">· Undone</span>
                ) : (
                  <button className="text-accent hover:underline disabled:opacity-40" onClick={onUndo} disabled={!canUndo}>
                    Undo
                  </button>
                )}
              </div>
            ) : (
              <Suggestions items={result.suggestions} onPick={onSuggest} />
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function StepLine({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const name = componentName(step.path);
  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      className="text-[12px] text-muted"
    >
      {step.kind === "read" ? (
        <span>Looked at {name}</span>
      ) : (
        <>
          <button className="inline-flex items-center gap-1.5 hover:text-ink" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span>Edited {name}</span>
            <span className="font-mono text-[10.5px]">
              <span className="text-new-ink">+{step.added.length}</span> <span className="text-danger">−{step.removed.length}</span>
            </span>
            <span className="text-[10px]">{open ? "Hide" : "Show"} change</span>
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: DURATION.base, ease: EASE_OUT }}
                className="mt-1 overflow-x-auto rounded-[6px] bg-stage px-2 py-1.5 font-mono text-[10.5px] leading-[1.5]"
              >
                {step.removed.map((l, i) => (
                  <div key={`r${i}`} className="text-danger">
                    − {l.trim()}
                  </div>
                ))}
                {step.added.map((l, i) => (
                  <div key={`a${i}`} className="text-new-ink">
                    + {l.trim()}
                  </div>
                ))}
              </motion.pre>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.li>
  );
}

function Suggestions({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-ink-2 hover:text-ink"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function SelectionChip({ selection, onClear }: { selection: Selection; onClear?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-[6px] bg-[oklch(0.95_0.03_265)] px-2 py-[3px] text-[11.5px] text-accent">
      <CrosshairIcon />
      <span className="truncate">{describeSelection(selection)}</span>
      {onClear && (
        <button type="button" onClick={onClear} className="ml-0.5 opacity-70 hover:opacity-100" aria-label="Clear selection">
          ×
        </button>
      )}
    </span>
  );
}

export function CrosshairIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3" strokeLinecap="round" />
    </svg>
  );
}

function ClaudeMark() {
  return (
    <span
      className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px] text-[12px] text-white"
      style={{ background: "oklch(0.62 0.14 45)" }}
      aria-hidden
    >
      ✳
    </span>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
