"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-hints"] });
  return () => obs.disconnect();
}

/** "Tweaks" from the mockup: show or hide the small Git terms. */
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
      className="flex w-full items-center justify-between rounded-[6px] px-2 py-[5px] text-[12px] text-muted hover:bg-[#efefed]"
      aria-pressed={on}
    >
      Show Git terms
      <span
        className="relative h-[14px] w-[26px] rounded-[10px] transition-colors"
        style={{ background: on ? "var(--color-ink)" : "#c9c9c6" }}
      >
        <span
          className="absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-all"
          style={{ left: on ? 14 : 2 }}
        />
      </span>
    </button>
  );
}
