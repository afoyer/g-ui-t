"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { FolderLink } from "@/lib/local-link";

/**
 * A real shell in the linked folder, run by the companion with node-pty.
 * It starts `claude` right away. Loaded with next/dynamic (ssr: false) because
 * xterm needs the DOM.
 */
export default function Terminal({ link }: { link: Pick<FolderLink, "request" | "on"> }) {
  const host = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState(0);
  const [exited, setExited] = useState(false);
  const { request, on } = link;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const term = new XTerm({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12.5,
      cursorBlink: true,
      theme: { background: "#1b1c1e", foreground: "#e6e6e4", cursor: "#e6e6e4", selectionBackground: "#3a3b3f" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);

    // A hidden panel has no size; fitting it would give 0 columns.
    const fitIfVisible = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) fit.fit();
    };
    fitIfVisible();

    const offData = on("pty.data", (msg) => term.write(String(msg.data)));
    const offExit = on("pty.exit", () => setExited(true));
    const input = term.onData((data) => void request("pty.write", { data }).catch(() => {}));

    let last = "";
    const observer = new ResizeObserver(() => {
      fitIfVisible();
      const size = `${term.cols}x${term.rows}`;
      if (size === last) return;
      last = size;
      void request("pty.resize", { cols: term.cols, rows: term.rows }).catch(() => {});
    });
    observer.observe(el);

    request("pty.spawn", { cols: term.cols, rows: term.rows }).catch((err) => {
      term.write(`\r\n\x1b[31m${err instanceof Error ? err.message : String(err)}\x1b[0m\r\n`);
    });
    term.focus();

    return () => {
      observer.disconnect();
      input.dispose();
      offData();
      offExit();
      void request("pty.kill").catch(() => {});
      term.dispose();
    };
  }, [request, on, session]);

  return (
    <div className="relative h-full min-h-0 bg-[#1b1c1e] p-2">
      <div ref={host} className="h-full w-full" />
      {exited && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[#2a2b2e] px-3 py-2 text-[12px] text-[#e6e6e4]">
          Session ended.
          <button
            className="rounded-[5px] bg-[#e6e6e4] px-2 py-0.5 text-[12px] text-ink"
            onClick={() => {
              setExited(false);
              setSession((s) => s + 1);
            }}
          >
            Start again
          </button>
        </div>
      )}
    </div>
  );
}
