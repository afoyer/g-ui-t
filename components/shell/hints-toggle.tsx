"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-hints"] });
  return () => obs.disconnect();
}

/** Show or hide the small Git terms (branches, commits, repos) shown next to friendly labels. */
export function HintsToggle() {
  const on = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.hints !== "off",
    () => true,
  );

  function toggle() {
    const next = !on;
    if (next) delete document.documentElement.dataset.hints;
    else document.documentElement.dataset.hints = "off";
    try {
      localStorage.setItem("guit-hints", next ? "on" : "off");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center justify-between gap-2 rounded-[6px] px-2 py-[5px] text-left text-[12px] text-ink-2 hover:bg-[#efefed]"
      aria-pressed={on}
      title="Shows branch names, commits and GitHub terms next to the friendly labels. Handy when talking to developers."
    >
      <span className="flex flex-col">
        <span>Developer details</span>
        <span className="text-[11px] leading-tight text-muted">Branches, commits, GitHub terms</span>
      </span>
      <span
        className="relative h-[14px] w-[26px] flex-none rounded-[10px] transition-colors"
        style={{ background: on ? "var(--color-ink)" : "#b5b6b9" }}
      >
        <span
          className="absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-all"
          style={{ left: on ? 14 : 2 }}
        />
      </span>
    </button>
  );
}
