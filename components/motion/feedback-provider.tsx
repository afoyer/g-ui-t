"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { DURATION, EASE_OUT, SPRING_SOFT } from "@/lib/motion";
import { Spinner } from "./spinner";

type Tone = "success" | "error" | "info" | "loading";
export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: Tone;
  /** ms before it hides itself; loading toasts stay until replaced. */
  duration?: number;
  /** When the page changes (e.g. a server action redirected), become this toast. */
  onNavigate?: Omit<Toast, "id" | "onNavigate">;
};

type Feedback = {
  toast: (t: Omit<Toast, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
  startProgress: () => void;
  /** Mark rows as just-changed so <Highlight> can flash them. */
  flash: (ids: string[]) => void;
  flashed: ReadonlySet<string>;
};

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [progressKey, setProgressKey] = useState<number | null>(null);
  const [flashed, setFlashed] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (t: Toast) => {
      clearTimeout(timers.current.get(t.id));
      if (t.tone === "loading") return;
      timers.current.set(t.id, setTimeout(() => dismiss(t.id), t.duration ?? (t.tone === "error" ? 6000 : 3200)));
    },
    [dismiss],
  );

  const startProgress = useCallback(() => setProgressKey(Date.now()), []);

  const toast = useCallback<Feedback["toast"]>(
    (input) => {
      const t: Toast = { ...input, id: input.id ?? Math.random().toString(36).slice(2) };
      setToasts((list) => [...list.filter((x) => x.id !== t.id), t].slice(-4));
      schedule(t);
      if (t.onNavigate) startProgress();
      return t.id;
    },
    [schedule, startProgress],
  );

  const flash = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFlashed((s) => new Set([...s, ...ids]));
    setTimeout(() => setFlashed((s) => new Set([...s].filter((id) => !ids.includes(id)))), 2400);
  }, []);

  // A navigation finished: settle redirect toasts and the progress bar.
  const onNavigated = useCallback(() => {
    setProgressKey(null);
    setToasts((list) =>
      list.map((t) => {
        if (!t.onNavigate) return t;
        const next = { ...t.onNavigate, id: t.id };
        schedule(next);
        return next;
      }),
    );
  }, [schedule]);

  const value = useMemo(
    () => ({ toast, dismiss, startProgress, flash, flashed }),
    [toast, dismiss, startProgress, flash, flashed],
  );

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE_OUT }}>
      <FeedbackContext.Provider value={value}>
        {children}
        <Suspense fallback={null}>
          <NavigationWatcher onStart={startProgress} onDone={onNavigated} />
        </Suspense>
        <ProgressBar runKey={progressKey} />
        <Toaster toasts={toasts} onDismiss={dismiss} />
      </FeedbackContext.Provider>
    </MotionConfig>
  );
}

/** Starts the bar on internal link clicks and back/forward; stops when the URL changes. */
function NavigationWatcher({ onStart, onDone }: { onStart: () => void; onDone: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    onDone();
  }, [pathname, search, onDone]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      onStart();
    }
    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onStart);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onStart);
    };
  }, [onStart]);

  return null;
}

/**
 * A 2px bar that eases toward ~85% while waiting, then completes and fades.
 * `runKey` is non-null while a navigation is in flight.
 */
function ProgressBar({ runKey }: { runKey: number | null }) {
  const running = runKey !== null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]" aria-hidden>
      <AnimatePresence>
        {running && (
          <motion.div
            key={runKey}
            className="h-full origin-left bg-accent shadow-[0_0_8px_oklch(0.48_0.13_265/0.5)]"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: [0, 0.35, 0.6, 0.78, 0.86], transition: { duration: 8, times: [0, 0.04, 0.15, 0.4, 1], ease: "easeOut" } }}
            exit={{ scaleX: 1, opacity: 0, transition: { scaleX: { duration: 0.18, ease: EASE_OUT }, opacity: { duration: 0.25, delay: 0.12 } } }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const TONE_ICON: Record<Tone, React.ReactNode> = {
  success: <span className="flex h-4 w-4 items-center justify-center rounded-full bg-shared text-[10px] text-white">✓</span>,
  error: <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">!</span>,
  info: <span className="h-2 w-2 rounded-full bg-accent" />,
  loading: <Spinner size={14} />,
};

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[90] flex w-[320px] max-w-[calc(100vw-32px)] flex-col items-end gap-2"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: DURATION.fast } }}
            transition={SPRING_SOFT}
            className="pointer-events-auto flex w-full items-start gap-2.5 rounded-[10px] border border-white/10 bg-ink/95 px-3.5 py-3 text-white shadow-[0_10px_30px_rgba(0,0,0,.25)] backdrop-blur"
          >
            <span className="mt-[1px] flex h-4 w-4 flex-none items-center justify-center">{TONE_ICON[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={t.title}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: DURATION.fast }}
                >
                  <div className="text-[12.5px] font-medium">{t.title}</div>
                  {t.description && <div className="mt-0.5 text-[12px] leading-snug text-white/65">{t.description}</div>}
                </motion.div>
              </AnimatePresence>
            </div>
            {t.tone !== "loading" && (
              <button onClick={() => onDismiss(t.id)} className="text-[12px] text-white/40 hover:text-white" aria-label="Dismiss">
                ✕
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
