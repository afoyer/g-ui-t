"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { Spinner } from "@/components/motion/spinner";
import { DURATION } from "@/lib/motion";

// Never cover the preview forever, even if Sandpack never reports back.
const GIVE_UP_MS = 30_000;

/**
 * Covers Sandpack's raw bundler log ("Downloaded @babel/core…") with a calm
 * message until the first build finishes. Place inside a `relative` box.
 * `quiet` drops the words, for thumbnails too small to read them.
 */
export function PreviewLoading({ quiet = false }: { quiet?: boolean }) {
  const { listen } = useSandpack();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stop = listen((msg) => {
      if (msg.type === "done") setReady(true);
    });
    const t = setTimeout(() => setReady(true), GIVE_UP_MS);
    return () => {
      stop();
      clearTimeout(t);
    };
  }, [listen]);

  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.slow }}
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center ${quiet ? "hatch" : "bg-white"}`}
        >
          {!quiet && (
            <>
              <Spinner size={16} className="text-muted" />
              <div className="text-[12.5px] text-ink-2">Building your preview…</div>
              <div className="text-[11.5px] text-faint">The first load takes a few seconds.</div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
