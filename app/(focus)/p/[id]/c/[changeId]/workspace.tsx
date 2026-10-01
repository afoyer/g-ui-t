"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { Avatar, Chip, clockTime, firstName, StatusBadge } from "@/components/ui";
import { TopBar } from "@/components/top-bar";
import { ViewportFrame, ViewportToggle, type Viewport } from "@/components/workspace/viewport";
import { componentNames, diffFiles } from "@/lib/files";
import type { Change, FileMap, Profile } from "@/lib/types";
import { bringInCurrent, restoreCheckpoint, saveCheckpoint, shareForReview, type Checkpoint, type SyncResult } from "./actions";

const AUTOSAVE_MS = 20_000;

type Props = {
  project: { id: string; name: string; defaultBranch: string };
  change: Change;
  template: "react-ts" | "static" | "vanilla";
  initialFiles: FileMap;
  initialCheckpoints: Checkpoint[];
  initialChangedFiles: string[];
  initialBehindBy: number;
  overlaps: { changeId: string; title: string; components: string[]; author: Profile | null }[];
  reviewers: Profile[];
};

type SyncState = { checkpoints: Checkpoint[]; changedFiles: string[]; behindBy: number; savedAt: string | null };

export function Workspace(props: Props) {
  // Remounting Sandpack (new key) is how we load files after a restore or update.
  const [loaded, setLoaded] = useState({ key: 0, files: props.initialFiles });
  // Lives above the provider so it survives those remounts.
  const [sync, setSync] = useState<SyncState>({
    checkpoints: props.initialCheckpoints,
    changedFiles: props.initialChangedFiles,
    behindBy: props.initialBehindBy,
    savedAt: props.initialCheckpoints[0]?.date ?? null,
  });
  return (
    <SandpackProvider
      key={loaded.key}
      template={props.template}
      files={loaded.files}
      options={{ recompileMode: "delayed", recompileDelay: 400 }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <WorkspaceInner
        {...props}
        sync={sync}
        setSync={setSync}
        reload={(files) => setLoaded((l) => ({ key: l.key + 1, files }))}
      />
    </SandpackProvider>
  );
}

type SaveState = "idle" | "saving" | "error";

function WorkspaceInner({
  project,
  change,
  overlaps,
  reviewers,
  sync,
  setSync,
  reload,
}: Props & {
  sync: SyncState;
  setSync: React.Dispatch<React.SetStateAction<SyncState>>;
  reload: (files: FileMap) => void;
}) {
  const { sandpack } = useSandpack();
  const current = flatten(sandpack.files);
  const { checkpoints, changedFiles, behindBy, savedAt } = sync;

  // What's in the latest checkpoint; resets whenever Sandpack remounts.
  const [saved, setSaved] = useState<FileMap>(() => current);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [showCode, setShowCode] = useState(true);
  const [checkpointName, setCheckpointName] = useState("");
  const [sharing, setSharing] = useState(false);
  const [pending, startTransition] = useTransition();

  const unsaved = diffFiles(saved, current);
  const dirty = Object.keys(unsaved).length > 0;
  const editable = change.status !== "merged" && change.status !== "closed";

  const apply = useCallback((res: SyncResult, snapshot?: FileMap) => {
    if (res.error) {
      setError(res.error);
      setSaveState("error");
      return false;
    }
    setError(null);
    setSync((s) => ({
      checkpoints: res.checkpoints ?? s.checkpoints,
      changedFiles: res.changedFiles ?? s.changedFiles,
      behindBy: res.behindBy ?? s.behindBy,
      savedAt: new Date().toISOString(),
    }));
    if (snapshot) setSaved(snapshot);
    setSaveState("idle");
    return true;
  }, [setSync]);

  const save = useCallback(
    async (message?: string) => {
      const snapshot = flatten(sandpack.files);
      const files = diffFiles(saved, snapshot);
      if (!Object.keys(files).length && !message) return;
      setSaveState("saving");
      const auto = `Edited ${componentNames(Object.keys(files)).join(", ")}`;
      const res = await saveCheckpoint(project.id, change.id, files, message || auto);
      apply(res, snapshot);
    },
    [sandpack.files, saved, project.id, change.id, apply],
  );

  // Auto-checkpoint after a pause in editing.
  const fingerprint = JSON.stringify(unsaved);
  useEffect(() => {
    if (!dirty || !editable) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [fingerprint, dirty, editable, save]);

  // Don't lose work on close.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function namedCheckpoint(e: React.FormEvent) {
    e.preventDefault();
    const name = checkpointName.trim();
    if (!name) return;
    startTransition(async () => {
      await save(name);
      setCheckpointName("");
    });
  }

  function restore(cp: Checkpoint) {
    if (dirty && !confirmLoseWork()) return;
    startTransition(async () => {
      const res = await restoreCheckpoint(project.id, change.id, cp.sha, cp.message);
      if (apply(res) && res.files) reload(res.files);
    });
  }

  function updateFromCurrent() {
    startTransition(async () => {
      if (dirty) await save();
      const res = await bringInCurrent(project.id, change.id);
      if (apply(res) && res.files) reload(res.files);
    });
  }

  const statusText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Not saved"
        : dirty
          ? "Unsaved changes"
          : savedAt
            ? `Saved ${clockTime(savedAt)}`
            : "Nothing changed yet";

  const components = componentNames(changedFiles);

  return (
    <>
      <TopBar
        back={{ href: `/p/${project.id}`, label: `${project.name} ▾` }}
        center={
          <>
            <span className="h-[7px] w-[7px] rounded-full bg-accent" />
            Working on <b className="font-semibold">{change.title}</b>
            <span className="git-hint">{change.branch}</span>
          </>
        }
        right={
          <>
            <span className={`text-[12px] ${saveState === "error" ? "text-danger" : "text-muted"}`}>{statusText}</span>
            {dirty && (
              <button className="btn btn-ghost h-6 px-2 text-[12px]" onClick={() => startTransition(() => save())}>
                Save now
              </button>
            )}
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        {showCode && (
          <div className="flex w-[44%] min-w-[360px] max-w-[640px] flex-none border-r border-line">
            <div className="w-[170px] flex-none overflow-y-auto border-r border-line-soft bg-sidebar">
              <SandpackFileExplorer autoHiddenFiles style={{ height: "100%", background: "transparent" }} />
            </div>
            <div className="min-w-0 flex-1">
              <SandpackCodeEditor
                showTabs
                closableTabs
                showLineNumbers
                readOnly={!editable}
                style={{ height: "100%" }}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3 bg-stage px-4 py-3">
          <div className="flex items-center gap-2">
            <ViewportToggle value={viewport} onChange={setViewport} />
            <button className="btn btn-ghost h-[26px] px-2 text-[12px]" onClick={() => setShowCode(!showCode)}>
              {showCode ? "Hide code" : "Show code"}
            </button>
            <Link
              href={`/p/${project.id}/compare?before=${encodeURIComponent(project.defaultBranch)}&after=${encodeURIComponent(change.branch)}&title=${encodeURIComponent(change.title)}`}
              className="ml-auto text-[12px] text-[#55575c] underline-offset-2 hover:underline"
              target="_blank"
            >
              Compare with Current ↗
            </Link>
          </div>
          <ViewportFrame viewport={viewport}>
            <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ height: "100%" }} />
          </ViewportFrame>
        </div>

        <aside className="flex w-[300px] flex-none flex-col overflow-y-auto border-l border-[#ececea]">
          <div className="flex flex-col gap-2.5 border-b border-[#f0f0ee] px-[18px] py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[16px] font-semibold">{change.title}</div>
              <StatusBadge status={change.status} />
            </div>
            {change.description && <p className="text-[12.5px] text-ink-2">{change.description}</p>}
            <div className="rounded-[8px] bg-stage px-[11px] py-[9px] text-[12px] leading-normal text-ink-2">
              You&apos;re working separately from Current. Nothing here reaches the shared project until it&apos;s reviewed.
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-[#f0f0ee] px-[18px] py-3.5">
            <div className="label">Changed so far</div>
            {components.length ? (
              <div className="flex flex-wrap gap-[5px]">
                {components.map((c) => (
                  <Chip key={c}>{c}</Chip>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-muted">Nothing yet. Edit a file and it&apos;s saved for you.</div>
            )}
            <div className="text-[12px] text-muted">
              {changedFiles.length} {changedFiles.length === 1 ? "file" : "files"}
              <span className="git-hint"> · git diff {project.defaultBranch}...</span>
            </div>
          </div>

          {overlaps.map((o) => (
            <div key={o.changeId} className="flex gap-[9px] border-b border-[#f0f0ee] bg-note px-[18px] py-3.5">
              {o.author && <Avatar profile={o.author} size={20} />}
              <div className="text-[12px] leading-[1.45]">
                {o.author ? firstName(o.author) : "A teammate"} is also editing{" "}
                <b className="font-semibold">{o.components.join(", ")}</b> in {o.title}. Nothing is wrong yet.{" "}
                <Link href={`/p/${project.id}/c/${o.changeId}/review`} className="underline">
                  See their version
                </Link>
              </div>
            </div>
          ))}

          {behindBy > 0 && (
            <div className="flex flex-col gap-2 border-b border-[#f0f0ee] px-[18px] py-3.5">
              <div className="text-[12px] leading-[1.45] text-ink-2">
                Current has {behindBy} new {behindBy === 1 ? "update" : "updates"} since you started.
              </div>
              <button className="btn btn-secondary w-fit" disabled={pending} onClick={updateFromCurrent}>
                Update from Current
              </button>
              <span className="git-hint">git merge {project.defaultBranch}</span>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-2 px-[18px] py-3.5">
            <div className="label">Checkpoints</div>
            <ol className="flex flex-col">
              {checkpoints.map((cp, i) => (
                <li key={cp.sha} className="group flex items-center justify-between gap-2 py-1 text-[12.5px]">
                  <span className="min-w-0 truncate" title={cp.message}>
                    {cp.message}
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    {i > 0 && editable && (
                      <button
                        className="hidden text-[11.5px] text-accent group-hover:inline"
                        disabled={pending}
                        onClick={() => restore(cp)}
                      >
                        Restore
                      </button>
                    )}
                    <span className="text-[#8b8d92]">{clockTime(cp.date)}</span>
                  </span>
                </li>
              ))}
              <li className="py-1 text-[12.5px] text-muted">Started from Current</li>
            </ol>
            <div className="text-[11.5px] text-muted">Any checkpoint can be restored.</div>
            {editable && (
              <form onSubmit={namedCheckpoint} className="mt-1 flex gap-1.5">
                <input
                  className="input h-7 text-[12px]"
                  placeholder="Name this checkpoint"
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                />
                <button className="btn btn-secondary h-7 px-2 text-[12px]" disabled={pending || !checkpointName.trim()}>
                  Save
                </button>
              </form>
            )}
          </div>

          {error && <p className="mx-[18px] mb-2 rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink">{error}</p>}

          <div className="flex flex-col gap-1.5 border-t border-[#f0f0ee] px-[18px] py-3.5">
            {change.status === "in_review" ? (
              <Link href={`/p/${project.id}/c/${change.id}/review`} className="btn btn-secondary btn-lg">
                See review
              </Link>
            ) : sharing ? (
              <ShareForm
                reviewers={reviewers}
                defaultNote={change.description ?? ""}
                onCancel={() => setSharing(false)}
                onShare={async (ids, note) => {
                  if (dirty) await save();
                  const res = await shareForReview(project.id, change.id, ids, note);
                  if (res?.error) setError(res.error);
                }}
              />
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setSharing(true)}
                disabled={checkpoints.length === 0 && !dirty}
                title={checkpoints.length === 0 && !dirty ? "Make a change first" : undefined}
              >
                {change.status === "changes_requested" ? "Share again" : "Share for Review"}
              </button>
            )}
            <span className="git-hint text-center">push + open pull request</span>
          </div>
        </aside>
      </div>
    </>
  );
}

function ShareForm({
  reviewers,
  defaultNote,
  onShare,
  onCancel,
}: {
  reviewers: Profile[];
  defaultNote: string;
  onShare: (ids: string[], note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(reviewers.slice(0, 1).map((r) => r.id));
  const [note, setNote] = useState(defaultNote);
  const [pending, startTransition] = useTransition();

  if (!reviewers.length) {
    return (
      <div className="flex flex-col gap-2 text-[12px] text-muted">
        Nobody else can review yet. Invite an editor from the project&apos;s People tab.
        <button className="btn btn-ghost w-fit" onClick={onCancel}>
          OK
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="label">Who should review?</div>
      {reviewers.map((r) => (
        <label key={r.id} className="flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={picked.includes(r.id)}
            onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))}
          />
          <Avatar profile={r} size={18} />
          {r.name ?? r.github_login}
        </label>
      ))}
      <textarea
        className="input text-[12.5px]"
        rows={2}
        placeholder="What should they look at?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-primary flex-1"
          disabled={pending || !picked.length}
          onClick={() => startTransition(() => onShare(picked, note))}
        >
          {pending ? "Sharing…" : "Share"}
        </button>
      </div>
    </div>
  );
}

function flatten(files: Record<string, { code: string }>): FileMap {
  return Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f.code]));
}

function confirmLoseWork() {
  return window.confirm("You have unsaved edits. Restoring will discard them. Continue?");
}
