"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Talks to the local companion (`npm run link`, see link/bin.mjs) over a
 * WebSocket on 127.0.0.1. One socket per tab, kept at module level so it
 * survives Sandpack remounts.
 */

/** Hidden on the deployed site unless explicitly turned on. */
export const LOCAL_LINK_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_LOCAL_LINK === "1";

export type LinkStatus = "off" | "connecting" | "connected" | "unpaired";

type Pairing = { token: string; port: number };
type Pending = { resolve: (data: unknown) => void; reject: (err: Error) => void };
type Listener = (msg: Record<string, unknown>) => void;

const STORAGE_KEY = "gui-link";
const DEFAULT_PORT = 47321;
const MAX_BACKOFF_MS = 15_000;

function readPairing(): Pairing | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Pairing) : null;
  } catch {
    return null;
  }
}

function writePairing(p: Pairing | null) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: pairing just won't persist across reloads.
  }
}

type Snapshot = { status: LinkStatus; /** Bumps on every new connection. */ generation: number };

class LocalLink {
  private snapshot: Snapshot = { status: "unpaired", generation: 0 };
  private ws: WebSocket | null = null;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  private listeners = new Map<string, Set<Listener>>();
  private statusListeners = new Set<() => void>();
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  /** Connect with the saved pairing, if any. Safe to call repeatedly. */
  start() {
    if (this.started || !LOCAL_LINK_ENABLED) return;
    this.started = true;
    const p = readPairing();
    if (p) this.connect(p);
  }

  /** Try a new code. Resolves once connected; the code is only saved if it works. */
  pair(token: string, port = DEFAULT_PORT) {
    this.disconnect();
    return new Promise<void>((resolve, reject) => {
      const ws = this.connect({ token: token.trim(), port }, false);
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("close", () => reject(new Error("Couldn't connect. Is `npm run link` running, and is the code right?")), {
        once: true,
      });
    });
  }

  forget() {
    writePairing(null);
    this.disconnect();
    this.setStatus("unpaired");
  }

  request<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Not connected to your computer"));
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (d: unknown) => void, reject });
      ws.send(JSON.stringify({ id, type, ...payload }));
    });
  }

  on(event: string, fn: Listener) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(fn);
    return () => void set.delete(fn);
  }

  subscribe = (fn: () => void) => {
    this.statusListeners.add(fn);
    this.start();
    return () => void this.statusListeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  private setStatus(status: LinkStatus) {
    if (this.snapshot.status === status) return;
    const generation = this.snapshot.generation + (status === "connected" ? 1 : 0);
    this.snapshot = { status, generation };
    this.statusListeners.forEach((fn) => fn());
  }

  private connect(p: Pairing, retry = true) {
    if (this.timer) clearTimeout(this.timer);
    this.setStatus("connecting");
    const ws = new WebSocket(`ws://127.0.0.1:${p.port}?token=${encodeURIComponent(p.token)}`);
    this.ws = ws;
    let opened = false;

    ws.onopen = () => {
      opened = true;
      this.attempt = 0;
      writePairing(p);
      this.setStatus("connected");
    };
    ws.onmessage = (e) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (typeof msg.event === "string") {
        this.listeners.get(msg.event)?.forEach((fn) => fn(msg));
        return;
      }
      const waiter = this.pending.get(msg.id as number);
      if (!waiter) return;
      this.pending.delete(msg.id as number);
      if (msg.ok) waiter.resolve(msg.data);
      else waiter.reject(new Error(String(msg.error ?? "Request failed")));
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.pending.forEach((w) => w.reject(new Error("Lost the connection to your computer")));
      this.pending.clear();
      this.setStatus(readPairing() ? "off" : "unpaired");
      // Only keep retrying a pairing that has worked before.
      if ((retry || opened) && readPairing()) {
        const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempt++);
        this.timer = setTimeout(() => {
          const saved = readPairing();
          if (saved) this.connect(saved);
        }, delay);
      }
    };
    return ws;
  }

  private disconnect() {
    if (this.timer) clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.pending.forEach((w) => w.reject(new Error("Disconnected")));
    this.pending.clear();
    this.attempt = 0;
  }
}

export const localLink = new LocalLink();

const request = localLink.request.bind(localLink);
const on = localLink.on.bind(localLink);
const pair = (token: string) => localLink.pair(token);

const SERVER_SNAPSHOT: Snapshot = { status: "off", generation: 0 };

function useSnapshot() {
  return useSyncExternalStore(localLink.subscribe, localLink.getSnapshot, () => SERVER_SNAPSHOT);
}

export function useLocalLink() {
  const { status } = useSnapshot();
  return { status, pair, request, on };
}

/**
 * The folder for one Change: opens it (clone or update), remembers that it's
 * linked so a reload or reconnect re-opens it, and exposes the folder path.
 */
export function useFolderLink({ repoUrl, branch, changeId }: { repoUrl: string; branch: string; changeId: string }) {
  const { status, generation } = useSnapshot();
  const key = `gui-link-open:${changeId}`;
  const [wanted, setWanted] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  // The companion forgets the folder when the socket drops, so an opened folder
  // only counts for the connection it was opened on.
  const [opened, setOpened] = useState<{ dir: string; generation: number } | null>(null);
  const dir = status === "connected" && opened?.generation === generation ? opened.dir : null;
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const res = await request<{ dir: string }>("open", { repoUrl, branch });
      setOpened({ dir: res.dir, generation: localLink.getSnapshot().generation });
      setWanted(true);
      try {
        localStorage.setItem(key, "1");
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpening(false);
    }
  }, [repoUrl, branch, key]);

  const unlink = useCallback(() => {
    setWanted(false);
    setOpened(null);
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [key]);

  // Each new connection starts without a folder: re-open it if this Change was linked.
  useEffect(() => {
    if (status !== "connected" || !wanted || dir) return;
    let live = true;
    request<{ dir: string }>("open", { repoUrl, branch }).then(
      (res) => {
        if (!live) return;
        setOpened({ dir: res.dir, generation });
        setError(null);
      },
      (err) => live && setError(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      live = false;
    };
  }, [status, generation, wanted, dir, repoUrl, branch]);

  return {
    status,
    dir,
    opening,
    error,
    open,
    unlink,
    pair,
    request,
    on,
    reveal: (app: "finder" | "vscode") => request("reveal", { app }),
  };
}

export type FolderLink = ReturnType<typeof useFolderLink>;
