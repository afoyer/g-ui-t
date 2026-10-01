"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { TopBar } from "@/components/top-bar";
import { Avatar, Chip, firstName, StatusBadge, timeAgo } from "@/components/ui";
import { PreviewOnly } from "@/components/workspace/preview-only";
import { ViewportFrame, ViewportToggle, type Viewport } from "@/components/workspace/viewport";
import type { Change, Comment, FileMap, Profile, ReviewRequest, Role } from "@/lib/types";
import { addComment, addToCurrent, review } from "./actions";

type Props = {
  me: Profile;
  myRole: Role;
  project: { id: string; name: string; repoUrl: string };
  change: Change;
  template: "react-ts" | "static" | "vanilla";
  files: FileMap;
  comments: Comment[];
  reviews: ReviewRequest[];
  members: (Profile & { role: Role })[];
  whatChanged: { name: string; isNew: boolean }[];
};

type Pin = { x: number; y: number; viewport: Viewport };

export function ReviewScreen(props: Props) {
  const { me, myRole, project, change, comments, reviews, members } = props;
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [mode, setMode] = useState<"comment" | "interact">("comment");
  const [draftPin, setDraftPin] = useState<Pin | null>(null);
  const [text, setText] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const people = new Map(members.map((m) => [m.id, m]));
  const author = people.get(change.author_id);
  const pinned = comments.filter((c) => c.pin_x !== null && c.pin_y !== null);
  const pinNumber = new Map(pinned.map((c, i) => [c.id, i + 1]));
  const visiblePins = pinned.filter((c) => (c.viewport ?? "desktop") === viewport);

  const isAuthor = change.author_id === me.id;
  const open = change.status === "in_review" || change.status === "changes_requested";
  const canDecide = open && !isAuthor && myRole === "editor";
  const approvals = reviews.filter((r) => r.state === "approved").length;
  const blocked = reviews.some((r) => r.state === "changes_requested");
  const canMerge = change.status === "in_review" && myRole === "editor" && approvals > 0 && !blocked;
  const names = [...new Map(props.whatChanged.map((w) => [w.name, w])).values()];

  function placePin(e: React.MouseEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    setDraftPin({
      x: clamp((e.clientX - box.left) / box.width),
      y: clamp((e.clientY - box.top) / box.height),
      viewport,
    });
    setActive(null);
    document.getElementById("comment-box")?.focus();
  }

  function run(fn: () => Promise<{ error?: string } | undefined>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else after?.();
    });
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => addComment(project.id, change.id, text, draftPin),
      () => {
        setText("");
        setDraftPin(null);
      },
    );
  }

  return (
    <>
      <TopBar
        back={{ href: `/p/${project.id}`, label: `${project.name} /` }}
        left={
          <>
            <span className="font-semibold">{change.title}</span>
            <StatusBadge status={change.status} />
            {change.pr_number && <span className="git-hint">PR #{change.pr_number}</span>}
          </>
        }
        right={
          change.pr_number ? (
            <a
              href={`${project.repoUrl}/pull/${change.pr_number}/files`}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-[#55575c] underline"
            >
              View code · {change.changed_files.length} files
            </a>
          ) : null
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 bg-stage p-[18px]">
          <div className="flex items-center gap-2">
            <ViewportToggle value={viewport} onChange={setViewport} />
            <div className="ml-auto flex gap-0.5 rounded-[6px] bg-[#e4e4e2] p-0.5 text-[12px]">
              {(["comment", "interact"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-[5px] px-2.5 py-[3px] ${mode === m ? "bg-white shadow-[0_1px_1px_rgba(0,0,0,.06)]" : "text-[#55575c]"}`}
                >
                  {m === "comment" ? "Comment" : "Click through"}
                </button>
              ))}
            </div>
          </div>
          <ViewportFrame viewport={viewport}>
            <PreviewOnly template={props.template} files={props.files} />
            {/* The iframe swallows clicks, so pins live on a layer above it. */}
            <div
              className={`absolute inset-0 ${mode === "comment" ? "cursor-crosshair" : "pointer-events-none"}`}
              onClick={mode === "comment" && change.status !== "merged" ? placePin : undefined}
            >
              {visiblePins.map((c) => (
                <PinMark
                  key={c.id}
                  x={c.pin_x!}
                  y={c.pin_y!}
                  label={String(pinNumber.get(c.id))}
                  highlighted={active === c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive(c.id);
                    document.getElementById(`c-${c.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  }}
                />
              ))}
              {draftPin && draftPin.viewport === viewport && <PinMark x={draftPin.x} y={draftPin.y} label="+" draft />}
            </div>
          </ViewportFrame>
          <div className="text-center text-[12px] text-muted">
            {mode === "comment" ? "Click anywhere on the preview to leave a comment" : "Use the preview like a visitor would"}
          </div>
        </div>

        <aside className="flex w-[300px] flex-none flex-col border-l border-[#ececea]">
          <div className="flex items-start gap-2 border-b border-[#f0f0ee] px-4 py-3.5">
            {author && <Avatar profile={author} />}
            <div className="text-[12.5px] leading-snug">
              <b className="font-semibold">{author ? firstName(author) : "Someone"}</b>{" "}
              {change.description ? `“${change.description}”` : <span className="text-muted">didn&apos;t add a note.</span>}
              <div className="mt-0.5 text-[11.5px] text-muted">updated {timeAgo(change.updated_at)}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-[#f0f0ee] px-4 py-3">
            <div className="label">What changed</div>
            <div className="flex flex-wrap gap-[5px]">
              {names.map((w) => (
                <Chip key={w.name} tone={w.isNew ? "new" : "plain"}>
                  {w.name}
                  {w.isNew && " · new"}
                </Chip>
              ))}
              {names.length === 0 && <span className="text-[12px] text-muted">No file changes yet.</span>}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
            <div className="label">Discussion</div>
            {comments.map((c) => {
              const who = people.get(c.author_id);
              const n = pinNumber.get(c.id);
              return (
                <button
                  key={c.id}
                  id={`c-${c.id}`}
                  onClick={() => {
                    if (n && c.viewport) setViewport(c.viewport as Viewport);
                    setActive(c.id);
                  }}
                  className={`flex gap-[9px] rounded-[6px] text-left ${active === c.id ? "bg-note" : ""}`}
                >
                  {n ? (
                    <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[50%_50%_50%_2px] bg-accent text-[10px] font-semibold text-white">
                      {n}
                    </span>
                  ) : who ? (
                    <Avatar profile={who} size={18} />
                  ) : null}
                  <div className="min-w-0 text-[12.5px] leading-snug">
                    <b className="font-semibold">{c.author_id === me.id ? "You" : who ? firstName(who) : "Someone"}</b>{" "}
                    {c.body}
                    <div className="mt-0.5 text-[11.5px] text-muted">
                      {n && c.viewport ? `${c.viewport} · ` : ""}
                      {timeAgo(c.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}
            {comments.length === 0 && <div className="text-[12px] text-muted">No comments yet.</div>}
          </div>

          {change.status !== "merged" && (
            <form onSubmit={submitComment} className="flex flex-col gap-1.5 border-t border-[#f0f0ee] px-4 py-3">
              {draftPin && (
                <div className="flex items-center justify-between text-[11.5px] text-muted">
                  Pinned on the {draftPin.viewport} preview
                  <button type="button" className="underline" onClick={() => setDraftPin(null)}>
                    Unpin
                  </button>
                </div>
              )}
              <textarea
                id="comment-box"
                className="input text-[12.5px]"
                rows={2}
                placeholder="Add a comment…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                }}
              />
              <button className="btn btn-secondary self-end" disabled={pending || !text.trim()}>
                Comment
              </button>
            </form>
          )}

          <div className="flex flex-col gap-2 border-t border-[#f0f0ee] px-4 py-3">
            <div className="label">Reviewers</div>
            {reviews.map((r) => {
              const who = people.get(r.reviewer_id);
              return (
                <div key={r.reviewer_id} className="flex items-center gap-2 text-[12.5px]">
                  {who && <Avatar profile={who} size={18} />}
                  <span className="flex-1">{r.reviewer_id === me.id ? "You" : who ? firstName(who) : "Someone"}</span>
                  <span
                    className={
                      r.state === "approved" ? "text-new-ink" : r.state === "changes_requested" ? "text-danger" : "text-muted"
                    }
                  >
                    {r.state === "approved" ? "✓ Approved" : r.state === "changes_requested" ? "Changes requested" : r.reviewer_id === me.id ? "Your turn" : "Waiting"}
                  </span>
                </div>
              );
            })}
          </div>

          {error && <p className="mx-4 mb-2 rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink">{error}</p>}

          <div className="flex flex-col gap-2 border-t border-[#f0f0ee] px-4 py-3">
            {change.status === "merged" ? (
              <div className="rounded-[8px] bg-new px-3 py-2 text-[12.5px] text-new-ink">
                Added to Current {timeAgo(change.merged_at)}.{" "}
                <Link href={`/p/${project.id}/history`} className="underline">
                  See History
                </Link>
              </div>
            ) : (
              <>
                {canDecide && (
                  <>
                    <input
                      className="input h-7 text-[12px]"
                      placeholder="Note with your decision (needed to request changes)"
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary flex-1"
                        disabled={pending}
                        onClick={() => run(() => review(project.id, change.id, "changes_requested", decisionNote), () => setDecisionNote(""))}
                      >
                        Request changes
                      </button>
                      <button
                        className="btn btn-primary flex-1"
                        disabled={pending}
                        onClick={() => run(() => review(project.id, change.id, "approved", decisionNote), () => setDecisionNote(""))}
                      >
                        Approve
                      </button>
                    </div>
                  </>
                )}
                {isAuthor && change.status !== "in_review" && (
                  <Link href={`/p/${project.id}/c/${change.id}`} className="btn btn-secondary">
                    Back to editing
                  </Link>
                )}
                {isAuthor && change.status === "in_review" && (
                  <Link href={`/p/${project.id}/c/${change.id}`} className="btn btn-ghost">
                    Keep editing (reviewers see updates)
                  </Link>
                )}
                {change.status === "in_review" && (
                  <button
                    className="btn btn-primary btn-lg"
                    disabled={pending || !canMerge}
                    title={canMerge ? undefined : "Needs an approval first"}
                    onClick={() => run(() => addToCurrent(project.id, change.id))}
                  >
                    Add to Current
                  </button>
                )}
                <span className="git-hint text-center">
                  {canDecide ? "pull request review" : "merge pull request"}
                </span>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function PinMark({
  x,
  y,
  label,
  draft,
  highlighted,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  draft?: boolean;
  highlighted?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className={`absolute flex h-[22px] w-[22px] -translate-y-full items-center justify-center rounded-[50%_50%_50%_2px] text-[11px] font-semibold text-white shadow-[0_2px_6px_rgba(0,0,0,.2)] ${
        draft ? "bg-ink" : "bg-accent"
      } ${highlighted ? "scale-125 ring-2 ring-white" : ""} transition-transform`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      {label}
    </span>
  );
}

function clamp(n: number) {
  return Math.min(1, Math.max(0, n));
}
