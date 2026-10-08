"use client";

import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
  type SandpackFiles,
} from "@codesandbox/sandpack-react";
import { Avatar, Chip, clockTime, firstName, StatusBadge } from "@/components/ui";
import { TopBar } from "@/components/top-bar";
import { Segmented, ViewportFrame, ViewportToggle, type Viewport } from "@/components/workspace/viewport";
import { ClaudePanel } from "@/components/workspace/claude-panel";
import { LinkButton } from "@/components/workspace/link-button";
import { AssistantPanel, CrosshairIcon, type ChatMessage } from "@/components/workspace/assistant-panel";
import { PreviewLoading } from "@/components/workspace/preview-loading";
import { PreviewOnly } from "@/components/workspace/preview-only";
import { componentNames, diffFiles, isEditable, toRepoPath, toSandpackPath } from "@/lib/files";
import { INSPECTOR_PATH, withInspector, withoutInspector, type PickedMessage } from "@/lib/assistant/inspector";
import type { Selection } from "@/lib/assistant/selection";
import { LOCAL_LINK_ENABLED, useFolderLink, type FolderLink } from "@/lib/local-link";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useFeedback } from "@/components/motion/feedback-provider";
import { SaveStatus, type SaveStatusState } from "@/components/motion/save-status";
import { ActionLabel, Spinner } from "@/components/motion/spinner";
import type { Change, FileMap, Profile } from "@/lib/types";
import {
  bringInCurrent,
  loadCurrentFiles,
  restoreCheckpoint,
  saveCheckpoint,
  shareForReview,
  type Checkpoint,
  type SyncResult,
} from "./actions";

const AUTOSAVE_MS = 20_000;
// Browser edits reach the linked folder after this pause.
const DISK_SYNC_MS = 300;

type Template = "react-ts" | "static" | "vanilla";

type Props = {
  project: { id: string; name: string; defaultBranch: string; repo: { owner: string; name: string } };
  change: Change;
  template: Template;
  initialFiles: FileMap;
  initialCheckpoints: Checkpoint[];
  initialChangedFiles: string[];
  initialBehindBy: number;
  overlaps: { changeId: string; title: string; components: string[]; author: Profile | null }[];
  reviewers: Profile[];
};

type SyncState = { checkpoints: Checkpoint[]; changedFiles: string[]; behindBy: number; savedAt: string | null };

/** Sandpack's copy: the repo files plus the hidden element picker (never saved). */
function sandpackFiles(files: FileMap, template: Template): SandpackFiles {
  const wired = withInspector(files, template);
  return Object.fromEntries(
    Object.entries(wired).map(([p, code]) => [p, p === INSPECTOR_PATH || !(p in files) ? { code, hidden: true } : code]),
  );
}

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
  // So does the conversation with Claude.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // The local folder link also lives up here, so a remount doesn't drop it.
  const link = useFolderLink({
    repoUrl: `https://github.com/${props.project.repo.owner}/${props.project.repo.name}.git`,
    branch: props.change.branch,
    changeId: props.change.id,
  });
  const files = useMemo(() => sandpackFiles(loaded.files, props.template), [loaded.files, props.template]);
  return (
    <SandpackProvider
      key={loaded.key}
      template={props.template}
      files={files}
      options={{ recompileMode: "delayed", recompileDelay: 400 }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <WorkspaceInner
        {...props}
        sync={sync}
        setSync={setSync}
        messages={messages}
        setMessages={setMessages}
        link={link}
        repoFiles={loaded.files}
        reload={(files) => setLoaded((l) => ({ key: l.key + 1, files }))}
      />
    </SandpackProvider>
  );
}

type SaveState = "idle" | "saving" | "error";
type LeftTab = "claude" | "code" | "terminal";
type View = "change" | "current" | "both";

function WorkspaceInner({
  project,
  change,
  template,
  overlaps,
  reviewers,
  sync,
  setSync,
  messages,
  setMessages,
  link,
  repoFiles,
  reload,
}: Props & {
  sync: SyncState;
  setSync: React.Dispatch<React.SetStateAction<SyncState>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  link: FolderLink;
  repoFiles: FileMap;
  reload: (files: FileMap) => void;
}) {
  const { sandpack } = useSandpack();
  const { dir: linkedDir, request: linkRequest, on: linkOn } = link;
  const current = flatten(sandpack.files);
  const { checkpoints, changedFiles, behindBy, savedAt } = sync;

  // What's in the latest checkpoint; resets whenever Sandpack remounts.
  const [saved, setSaved] = useState<FileMap>(() => current);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const { toast } = useFeedback();
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [leftTab, setLeftTab] = useState<LeftTab>("claude");
  // The terminal mounts on first visit, then stays mounted so its session survives tab switches.
  const [terminalOpened, setTerminalOpened] = useState(false);
  const [view, setView] = useState<View>("change");
  const [currentFiles, setCurrentFiles] = useState<FileMap | null>(null);
  const [picking, setPicking] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [checkpointName, setCheckpointName] = useState("");
  const [sharing, setSharing] = useState(false);
  const [pending, startTransition] = useTransition();
  const previewRef = useRef<HTMLDivElement>(null);

  const unsaved = diffFiles(saved, current);
  const dirty = Object.keys(unsaved).length > 0;
  const editable = change.status !== "merged" && change.status !== "closed";

  /** Puts repo-shaped files into Sandpack, re-adding the picker hooks where needed. */
  const writeToPreview = useCallback(
    (files: FileMap) => {
      const wired = withInspector(files, template);
      for (const p of Object.keys(files)) sandpack.updateFile(p, wired[p]);
    },
    [sandpack, template],
  );

  const apply = useCallback((res: SyncResult, snapshot?: FileMap) => {
    if (res.error) {
      setError(res.error);
      setSaveState("error");
      toast({ tone: "error", title: "Couldn't save to GitHub", description: res.error });
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
    setJustSaved(true);
    // The commit happened through the API; line the local clone's HEAD up with it.
    if (linkedDir) void linkRequest("sync", { branch: change.branch }).catch(() => {});
    return true;
  }, [setSync, toast, linkedDir, linkRequest, change.branch]);

  // The green "saved" check lingers briefly, then settles to a timestamp.
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2200);
    return () => clearTimeout(t);
  }, [justSaved]);

  const save = useCallback(
    async (message?: string, snapshot: FileMap = flatten(sandpack.files)) => {
      const files = diffFiles(saved, snapshot);
      if (!Object.keys(files).length && !message) return;
      setSaveState("saving");
      const auto = `Edited ${componentNames(Object.keys(files)).join(", ")}`;
      const res = await saveCheckpoint(project.id, change.id, files, message || auto);
      apply(res, snapshot);
    },
    [sandpack.files, saved, project.id, change.id, apply],
  );

  /** Claude's edits: show them right away and save them as a named version. */
  async function applyAssistantEdits(edits: FileMap, summary: string) {
    writeToPreview(edits);
    await save(summary, { ...current, ...edits });
  }

  // Auto-checkpoint after a pause in editing.
  const fingerprint = JSON.stringify(unsaved);
  useEffect(() => {
    if (!dirty || !editable) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [fingerprint, dirty, editable, save]);

  // ---- Element picker -----------------------------------------------------
  useEffect(() => {
    frameOf(previewRef)?.contentWindow?.postMessage({ type: "gui-pick", on: picking }, "*");
  }, [picking]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.source || e.source !== frameOf(previewRef)?.contentWindow) return;
      const data = e.data as PickedMessage | { type: "gui-pick-cancel" } | null;
      if (data?.type === "gui-picked") {
        setSelection({ tag: data.tag, text: data.text, classes: data.classes, component: data.component });
        setPicking(false);
        setLeftTab("claude");
      } else if (data?.type === "gui-pick-cancel") {
        setPicking(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // ---- Current, for comparing ---------------------------------------------
  function showView(v: View) {
    setView(v);
    if (v !== "change") setPicking(false);
    if (v !== "change" && !currentFiles) {
      startTransition(async () => {
        const res = await loadCurrentFiles(project.id, change.id);
        if (res.files) setCurrentFiles(res.files);
        else toast({ tone: "error", title: "Couldn't load Current", description: res.error });
      });
    }
  }

  // ---- Linked folder sync -------------------------------------------------
  // What the folder on disk holds, as far as we know. Resets on remount, so after a
  // Restore or "Update from Current" everything is rewritten (unchanged files are skipped).
  const lastSynced = useRef<FileMap | null>(null);
  const syncedDir = useRef<string | null>(null);
  // Files Sandpack adds from its template that aren't in the repo stay off disk unless edited.
  const [templateOnly] = useState<FileMap>(() =>
    Object.fromEntries(Object.entries(current).filter(([p]) => !(p in repoFiles))),
  );

  // Sandpack's own template files (package.json, …) aren't part of either version.
  const differences = currentFiles
    ? componentNames(
        Object.keys(
          fileDiff(currentFiles, Object.fromEntries(Object.entries(current).filter(([p]) => !(p in templateOnly) || p in currentFiles))),
        ),
      )
    : [];

  // Browser → disk.
  useEffect(() => {
    if (!linkedDir) {
      syncedDir.current = null;
      lastSynced.current = null;
      return;
    }
    const dir = linkedDir;
    const t = setTimeout(() => {
      if (syncedDir.current !== dir || !lastSynced.current) {
        syncedDir.current = dir;
        lastSynced.current = { ...templateOnly };
      }
      const synced = lastSynced.current;
      for (const [path, code] of Object.entries(diffFiles(synced, flatten(sandpack.files)))) {
        if (!isEditable(path)) continue;
        synced[path] = code;
        linkRequest("writeFile", { path: toRepoPath(path), content: code }).catch(() => {
          // Try again on the next edit.
          if (synced[path] === code) delete synced[path];
        });
      }
    }, DISK_SYNC_MS);
    return () => clearTimeout(t);
  }, [linkedDir, linkRequest, sandpack.files, templateOnly]);

  // Disk → browser. Edits from VS Code or Claude make the file dirty, so autosave checkpoints them.
  const onDiskChange = useEffectEvent((msg: Record<string, unknown>) => {
    const synced = lastSynced.current;
    if (!synced || !editable) return;
    const path = toSandpackPath(String(msg.path));
    if (msg.deleted) {
      delete synced[path];
      if (path in sandpack.files) sandpack.deleteFile(path);
      return;
    }
    const content = String(msg.content ?? "");
    // Our own write echoing back, possibly after we've typed more.
    if (synced[path] === content) return;
    synced[path] = content;
    writeToPreview({ [path]: content });
  });
  useEffect(() => {
    if (!linkedDir) return;
    return linkOn("fileChanged", onDiskChange);
  }, [linkedDir, linkOn]);

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
      setNaming(false);
      toast({ tone: "success", title: "Version saved", description: name });
    });
  }

  function restore(cp: Checkpoint) {
    if (dirty && !confirmLoseWork()) return;
    startTransition(async () => {
      const id = toast({ tone: "loading", title: `Going back to “${cp.message}”…` });
      const res = await restoreCheckpoint(project.id, change.id, cp.sha, cp.message);
      if (apply(res) && res.files) {
        reload(res.files);
        toast({ id, tone: "success", title: "Earlier version restored", description: "Later versions are still in the list, so nothing was lost." });
      } else toast({ id, tone: "error", title: "Couldn't restore", description: res.error });
    });
  }

  function updateFromCurrent() {
    startTransition(async () => {
      if (dirty) await save();
      const id = toast({ tone: "loading", title: "Bringing in the latest Current…" });
      const res = await bringInCurrent(project.id, change.id);
      if (apply(res) && res.files) {
        setCurrentFiles(null);
        if (view !== "change") setView("change");
        reload(res.files);
        toast({ id, tone: "success", title: "Up to date with Current" });
      } else toast({ id, tone: "error", title: "Couldn't update", description: res.error });
    });
  }

  const statusState: SaveStatusState =
    saveState === "saving" ? "saving" : saveState === "error" ? "error" : dirty ? "dirty" : justSaved ? "saved" : "empty";
  const statusText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Not saved"
        : dirty
          ? "Unsaved changes"
          : justSaved
            ? "Saved just now"
            : savedAt
              ? `Saved ${clockTime(savedAt)}`
              : "No changes yet";

  const components = componentNames(changedFiles);
  const nothingToShare = checkpoints.length === 0 && !dirty;
  const tabs: { value: LeftTab; label: string }[] = [
    { value: "claude", label: "Claude" },
    { value: "code", label: "Code" },
    ...(LOCAL_LINK_ENABLED ? [{ value: "terminal" as const, label: "Terminal" }] : []),
  ];

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
            {LOCAL_LINK_ENABLED && <LinkButton link={link} />}
            <SaveStatus state={statusState} text={statusText} />
            <AnimatePresence>
              {dirty && saveState !== "saving" && (
                <motion.button
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  className="btn btn-ghost h-6 px-2 text-[12px]"
                  onClick={() => startTransition(() => save())}
                >
                  Save now
                </motion.button>
              )}
            </AnimatePresence>
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1">
        {/* Panels are hidden rather than unmounted, so a running terminal survives tab switches. */}
        <motion.div
          initial={false}
          animate={{ width: leftTab === "claude" ? 340 : "min(44%, 640px)" }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT }}
          className="flex min-w-[300px] flex-none flex-col border-r border-line"
        >
          <div className="flex flex-none items-center gap-2 border-b border-line-soft bg-sidebar px-3 py-2">
            <Segmented label="Left panel" value={leftTab} onChange={(t) => {
              setLeftTab(t);
              if (t === "terminal") setTerminalOpened(true);
            }} options={tabs} />
            {leftTab !== "claude" && (
              <span className="truncate text-[11.5px] text-muted">For people comfortable with code</span>
            )}
          </div>
          <div className={`min-h-0 flex-1 ${leftTab === "claude" ? "block" : "hidden"}`}>
            <AssistantPanel
              messages={messages}
              setMessages={setMessages}
              files={current}
              selection={selection}
              onClearSelection={() => setSelection(null)}
              editable={editable}
              onApply={applyAssistantEdits}
            />
          </div>
          <div className={`min-h-0 flex-1 ${leftTab === "code" ? "flex" : "hidden"}`}>
            <div className="w-[160px] flex-none overflow-y-auto border-r border-line-soft bg-sidebar">
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
          {terminalOpened && (
            <div className={`min-h-0 flex-1 ${leftTab === "terminal" ? "block" : "hidden"}`}>
              <ClaudePanel link={link} />
            </div>
          )}
        </motion.div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 bg-stage px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <ViewportToggle value={viewport} onChange={setViewport} />
            {editable && (
              <button
                className={`btn h-[26px] px-2 text-[12px] ${picking ? "bg-accent text-white" : "btn-secondary"}`}
                onClick={() => {
                  if (view === "current") setView("change");
                  setPicking(!picking);
                }}
                aria-pressed={picking}
                title="Click something in the preview to point Claude at it"
              >
                <CrosshairIcon /> {picking ? "Click an element… (Esc)" : "Select"}
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Segmented
                label="What to show"
                value={view}
                onChange={showView}
                options={[
                  { value: "change", label: "Your version" },
                  { value: "current", label: "Current" },
                  { value: "both", label: "Side by side" },
                ]}
              />
              <button className="btn btn-secondary h-[26px] px-2 text-[12px] xl:hidden" onClick={() => setDetailsOpen(true)}>
                Details
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {view !== "change" && currentFiles && (
              <motion.div
                key={differences.length ? "diff" : "same"}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2"
              >
                {differences.length ? (
                  <>
                    <span className="text-muted">Different from Current:</span>
                    {differences.map((d) => (
                      <Chip key={d} tone="new">{d}</Chip>
                    ))}
                  </>
                ) : (
                  <span className="text-muted">No differences yet. Your version looks the same as Current.</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex min-h-0 flex-1 gap-4">
            {view !== "change" && (
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {view === "both" && <PaneLabel dot="bg-shared">Current</PaneLabel>}
                <ViewportFrame viewport={viewport}>
                  {currentFiles ? (
                    <PreviewOnly template={template} files={currentFiles} />
                  ) : (
                    <div className="flex h-full items-center justify-center gap-2 text-[12.5px] text-muted">
                      <Spinner /> Loading Current…
                    </div>
                  )}
                </ViewportFrame>
              </div>
            )}
            <div className={`min-w-0 flex-1 flex-col gap-2 ${view === "current" ? "hidden" : "flex"}`}>
              {view === "both" && <PaneLabel dot="bg-accent">{change.title}</PaneLabel>}
              <ViewportFrame viewport={viewport}>
                <div ref={previewRef} className={`relative flex h-full flex-col ${picking ? "ring-2 ring-accent ring-inset" : ""}`}>
                  <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ height: "100%" }} />
                  <PreviewLoading />
                </div>
              </ViewportFrame>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {detailsOpen && (
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/10 xl:hidden"
              onClick={() => setDetailsOpen(false)}
            />
          )}
        </AnimatePresence>

        <aside
          className={`${
            detailsOpen ? "absolute inset-y-0 right-0 z-40 flex shadow-[0_8px_32px_rgba(0,0,0,.12)]" : "hidden"
          } w-[300px] flex-none flex-col overflow-y-auto border-l border-[#ececea] bg-white xl:static xl:flex xl:shadow-none`}
        >
          <div className="flex flex-col gap-2.5 border-b border-[#f0f0ee] px-[18px] py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[16px] font-semibold">{change.title}</div>
              <span className="flex items-center gap-2">
                <StatusBadge status={change.status} />
                <button className="text-[16px] leading-none text-muted xl:hidden" onClick={() => setDetailsOpen(false)} aria-label="Close details">
                  ×
                </button>
              </span>
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
              <div className="text-[12px] text-muted">Nothing yet. Ask Claude for a change and it&apos;s saved for you.</div>
            )}
            <span className="git-hint">
              {changedFiles.length} {changedFiles.length === 1 ? "file" : "files"} · git diff {project.defaultBranch}...
            </span>
          </div>

          <AnimatePresence initial={false}>
          {overlaps.map((o) => (
            <motion.div
              key={o.changeId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE_OUT }}
              className="overflow-hidden"
            >
            <div className="flex gap-[9px] border-b border-[#f0f0ee] bg-note px-[18px] py-3.5">
              {o.author && <Avatar profile={o.author} size={20} />}
              <div className="text-[12px] leading-[1.45]">
                {o.author ? firstName(o.author) : "A teammate"} is also editing{" "}
                <b className="font-semibold">{o.components.join(", ")}</b> in {o.title}. Nothing is wrong yet.{" "}
                <Link href={`/p/${project.id}/c/${o.changeId}/review`} className="underline">
                  See their version
                </Link>
              </div>
            </div>
            </motion.div>
          ))}
          </AnimatePresence>

          <AnimatePresence initial={false}>
          {behindBy > 0 && (
            <motion.div
              key="behind"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE_OUT }}
              className="flex flex-col gap-2 overflow-hidden border-b border-[#f0f0ee] px-[18px] py-3.5"
            >
              <div className="text-[12px] leading-[1.45] text-ink-2">
                Current has {behindBy} new {behindBy === 1 ? "update" : "updates"} since you started.
              </div>
              <button className="btn btn-secondary w-fit" disabled={pending} onClick={updateFromCurrent}>
                <ActionLabel pending={pending} pendingText="Updating…">Update from Current</ActionLabel>
              </button>
              <span className="git-hint">git merge {project.defaultBranch}</span>
            </motion.div>
          )}
          </AnimatePresence>

          <div className="flex flex-1 flex-col gap-2 px-[18px] py-3.5">
            <div className="label">Versions</div>
            <ol className="flex flex-col">
              <AnimatePresence initial={false}>
              {checkpoints.map((cp, i) => (
                <motion.li
                  key={cp.sha}
                  layout="position"
                  initial={{ opacity: 0, x: -8, backgroundColor: "oklch(0.96 0.03 155 / 1)" }}
                  animate={{ opacity: 1, x: 0, backgroundColor: "oklch(0.96 0.03 155 / 0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.slow, ease: EASE_OUT, backgroundColor: { duration: 1.4 } }}
                  className="group -mx-1.5 flex items-center justify-between gap-2 rounded-[5px] px-1.5 py-1 text-[12.5px]"
                >
                  <span className="min-w-0 truncate" title={cp.message}>
                    {cp.message}
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    {i > 0 && editable && (
                      <button
                        className="hidden text-[11.5px] text-accent group-hover:inline"
                        disabled={pending}
                        onClick={() => restore(cp)}
                        title="Make your work look like this again. Later versions stay in the list."
                      >
                        Go back
                      </button>
                    )}
                    <span className="text-[#8b8d92]">{clockTime(cp.date)}</span>
                  </span>
                </motion.li>
              ))}
              </AnimatePresence>
              <motion.li layout="position" className="py-1 text-[12.5px] text-muted">Started from Current</motion.li>
            </ol>
            <div className="text-[11.5px] text-muted">
              Saved automatically whenever you pause. Hover a version to go back to it.
            </div>
            {editable &&
              (naming ? (
                <form onSubmit={namedCheckpoint} className="mt-1 flex flex-col gap-1">
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      className="input h-7 text-[12px]"
                      placeholder="e.g. Before the colour change"
                      value={checkpointName}
                      onChange={(e) => setCheckpointName(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
                    />
                    <button className="btn btn-secondary h-7 px-2 text-[12px]" disabled={pending || !checkpointName.trim()}>
                      <ActionLabel pending={pending && saveState === "saving"}>Save</ActionLabel>
                    </button>
                  </div>
                  <span className="text-[11px] text-faint">A name makes this version easy to find later.</span>
                </form>
              ) : (
                <button className="w-fit text-[12px] text-accent hover:underline" onClick={() => setNaming(true)}>
                  + Name this version
                </button>
              ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                key={error}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mx-[18px] mb-2 rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

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
                  const id = toast({
                    tone: "loading",
                    title: "Sharing for review…",
                    description: "Sending it to your reviewers",
                    onNavigate: { tone: "success", title: "Shared for review", description: "Your reviewers have been notified." },
                  });
                  const res = await shareForReview(project.id, change.id, ids, note);
                  if (res?.error) {
                    setError(res.error);
                    toast({ id, tone: "error", title: "Couldn't share", description: res.error });
                  }
                }}
              />
            ) : nothingToShare ? (
              <div className="rounded-[8px] border border-dashed border-line px-3 py-2.5 text-[12px] leading-[1.45] text-muted">
                <b className="font-medium text-ink-2">Share for Review</b> unlocks after your first change. Ask Claude for
                one on the left.
              </div>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => setSharing(true)}>
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

function PaneLabel({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
      <span className={`h-[7px] w-[7px] rounded-full ${dot}`} />
      {children}
    </div>
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
    <motion.div
      className="flex flex-col gap-2"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
    >
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
          <ActionLabel pending={pending} pendingText="Sharing…">
            Share
          </ActionLabel>
        </button>
      </div>
    </motion.div>
  );
}

/** Sandpack's files as the repo should see them: no picker hooks. */
function flatten(files: Record<string, { code: string }>): FileMap {
  return withoutInspector(Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f.code])));
}

/** Files that differ between two versions, including ones only one side has. */
function fileDiff(a: FileMap, b: FileMap): FileMap {
  const out = diffFiles(a, b);
  for (const p of Object.keys(a)) if (!(p in b)) out[p] = "";
  return out;
}

function frameOf(ref: React.RefObject<HTMLDivElement | null>) {
  return ref.current?.querySelector("iframe") ?? null;
}

function confirmLoseWork() {
  return window.confirm("You have unsaved edits. Going back will discard them. Continue?");
}
