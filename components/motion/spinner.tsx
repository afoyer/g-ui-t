"use client";

import { AnimatePresence, motion } from "motion/react";
import { DURATION } from "@/lib/motion";

export function Spinner({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </motion.svg>
  );
}

/**
 * Button contents that swap smoothly between idle, working and done.
 * Keeps the button's width steady so nothing jumps.
 */
export function ActionLabel({
  pending,
  done,
  children,
  pendingText,
  doneText = "Done",
}: {
  pending: boolean;
  done?: boolean;
  children: React.ReactNode;
  pendingText?: React.ReactNode;
  doneText?: React.ReactNode;
}) {
  const state = pending ? "pending" : done ? "done" : "idle";
  return (
    <span className="relative inline-grid place-items-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className="inline-flex items-center gap-1.5"
          initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
          transition={{ duration: DURATION.fast }}
        >
          {state === "pending" && (
            <>
              <Spinner />
              {pendingText ?? children}
            </>
          )}
          {state === "done" && (
            <>
              <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 20 }}>
                ✓
              </motion.span>
              {doneText}
            </>
          )}
          {state === "idle" && children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
