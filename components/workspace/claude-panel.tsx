"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { FolderLink } from "@/lib/local-link";
import { LinkButton, tildify } from "./link-button";

// xterm touches the DOM on import, so it never renders on the server.
const Terminal = dynamic(() => import("./terminal"), {
  ssr: false,
  loading: () => <div className="h-full bg-[#1b1c1e]" />,
});

type Where = "local" | "cloud";

/** The Claude tab: Claude Code on your computer, or (soon) in the cloud. */
export function ClaudePanel({ link }: { link: FolderLink }) {
  const [where, setWhere] = useState<Where>("local");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid flex-none grid-cols-2 gap-2 border-b border-line-soft bg-sidebar p-2.5">
        <Option
          active={where === "local"}
          onClick={() => setWhere("local")}
          title="On my computer"
          body={link.dir ? `Claude Code in ${tildify(link.dir)}` : "Runs the claude CLI in a linked folder"}
        />
        <Option
          disabled
          title="In the cloud"
          badge="Coming soon"
          body="Ask Claude without installing anything."
        />
      </div>

      <div className="min-h-0 flex-1">
        {link.dir ? (
          // A new folder gets a fresh shell.
          <Terminal key={link.dir} link={link} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-[13px] font-semibold">Link a folder first</div>
            <p className="max-w-[300px] text-[12.5px] leading-[1.5] text-muted">
              Claude Code works on real files. Open this Change on your computer and it will start in that folder. Its
              edits show up here and are saved as Checkpoints.
            </p>
            <LinkButton link={link} align="left" />
          </div>
        )}
      </div>
    </div>
  );
}

function Option({
  title,
  body,
  badge,
  active,
  disabled,
  onClick,
}: {
  title: string;
  body: string;
  badge?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col gap-0.5 rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
        active ? "border-ink bg-white" : "border-line bg-white/60"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-ink-2"}`}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
        {title}
        {badge && (
          <span className="rounded-[4px] bg-chip px-1.5 py-px text-[10.5px] font-medium text-muted">{badge}</span>
        )}
      </span>
      <span className="truncate text-[11.5px] text-muted">{body}</span>
    </button>
  );
}
