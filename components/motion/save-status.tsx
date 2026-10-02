"use client";

import { AnimatePresence, motion } from "motion/react";
import { DURATION } from "@/lib/motion";
import { Spinner } from "./spinner";

export type SaveStatusState = "empty" | "dirty" | "saving" | "saved" | "error";

/** The "Saved just now" pill: pulse while unsaved, spin while saving, a check when done. */
export function SaveStatus({ state, text }: { state: SaveStatusState; text: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] transition-colors duration-300 ${
        state === "error" ? "bg-danger/10 text-danger" : state === "saved" ? "bg-new text-new-ink" : "text-muted"
      }`}
      aria-live="polite"
    >
      <span className="flex h-3 w-3 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {state === "saving" && (
            <motion.span key="saving" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
              <Spinner size={11} />
            </motion.span>
          )}
          {state === "dirty" && (
            <motion.span
              key="dirty"
              className="h-[7px] w-[7px] rounded-full bg-review"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [1, 0.45, 1], scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ opacity: { repeat: Infinity, duration: 1.6, ease: "easeInOut" } }}
            />
          )}
          {state === "saved" && (
            <motion.span
              key="saved"
              className="text-[11px] leading-none"
              initial={{ opacity: 0, scale: 0.3, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 600, damping: 22 }}
            >
              ✓
            </motion.span>
          )}
          {state === "error" && (
            <motion.span key="error" className="text-[11px] font-bold leading-none" initial={{ x: -3 }} animate={{ x: [3, -2, 1, 0] }} transition={{ duration: 0.3 }}>
              !
            </motion.span>
          )}
          {state === "empty" && <motion.span key="empty" className="h-[6px] w-[6px] rounded-full bg-draft" exit={{ opacity: 0 }} />}
        </AnimatePresence>
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: DURATION.fast }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
