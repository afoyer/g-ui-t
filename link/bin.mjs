#!/usr/bin/env node
// G-ui-t local companion. Run from the repo with `npm run link`.
// Opens a Change as a folder under ~/G-ui-t, syncs it both ways with the
// browser, and runs a terminal there. Listens on 127.0.0.1 only.
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import chokidar from "chokidar";
import { WebSocketServer } from "ws";
import { createEchoGuard, event, fail, folderFor, isTextFile, ok, parseRequest, safeResolve } from "./protocol.mjs";

const run = promisify(execFile);
const PORT = 47321;
const ROOT = path.join(os.homedir(), "G-ui-t");
const MAX_FILE_BYTES = 200_000; // same cap as readFiles in lib/github/repo.ts
const IGNORED = /(^|[\\/])(\.git|node_modules)([\\/]|$)/;

const origins = new Set(["http://localhost:3000"]);
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--origin" && argv[i + 1]) origins.add(argv[++i].replace(/\/$/, ""));
}

const token = crypto.randomBytes(9).toString("base64url");

const wss = new WebSocketServer({
  host: "127.0.0.1",
  port: PORT,
  verifyClient: ({ origin, req }, done) => {
    const given = new URL(req.url ?? "/", "http://x").searchParams.get("token") ?? "";
    if (!origins.has(origin)) {
      console.warn(`✗ Rejected connection from origin ${origin || "(none)"}`);
      return done(false, 403, "Origin not allowed");
    }
    if (!safeEqual(given, token)) {
      console.warn(`✗ Rejected connection with a wrong token from ${origin}`);
      return done(false, 401, "Bad token");
    }
    done(true);
  },
});

wss.on("listening", () => {
  fs.mkdirSync(ROOT, { recursive: true });
  console.log(`
  G-ui-t link is running on ws://127.0.0.1:${PORT}

  Pairing code:  ${token}

  Folders go in: ${ROOT}
  Allowed sites: ${[...origins].join(", ")}
`);
});

wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") console.error(`Port ${PORT} is busy. Is another \`npm run link\` running?`);
  else console.error(err);
  process.exit(1);
});

wss.on("connection", (ws) => {
  console.log("✓ Browser connected");
  /** @type {{dir: string|null, watcher: import("chokidar").FSWatcher|null, pty: any}} */
  const state = { dir: null, watcher: null, pty: null };
  const echo = createEchoGuard();
  let ptyQueue = Promise.resolve();
  const send = (msg) => ws.readyState === ws.OPEN && ws.send(msg);

  function needDir() {
    if (!state.dir) throw new Error("Open a Change first");
    return state.dir;
  }

  async function startWatcher(dir) {
    await state.watcher?.close();
    const rel = (p) => path.relative(dir, p).split(path.sep).join("/");
    const report = async (abs) => {
      const p = rel(abs);
      if (!isTextFile(p)) return;
      try {
        const stat = await fs.promises.stat(abs);
        if (stat.size > MAX_FILE_BYTES) return;
        const content = await fs.promises.readFile(abs, "utf8");
        if (echo.isEcho(p, content)) return;
        send(event("fileChanged", { path: p, content }));
      } catch {
        // Gone again before we could read it; the unlink event covers it.
      }
    };
    state.watcher = chokidar
      .watch(dir, {
        ignored: (p) => IGNORED.test(path.relative(dir, p)),
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      })
      .on("add", report)
      .on("change", report)
      .on("unlink", (abs) => {
        const p = rel(abs);
        if (!isTextFile(p) || echo.isEcho(p, null)) return;
        send(event("fileChanged", { path: p, deleted: true }));
      });
  }

  const handlers = {
    async open({ repoUrl, branch }) {
      if (typeof repoUrl !== "string" || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(repoUrl)) {
        throw new Error("Expected a https://github.com/<owner>/<repo>.git URL");
      }
      if (typeof branch !== "string" || !branch || branch.startsWith("-") || /\s|\.\./.test(branch)) {
        throw new Error("Bad branch name");
      }
      const repoName = repoUrl.split("/").pop().replace(/\.git$/, "");
      const dir = folderFor(repoName, branch, os.homedir());
      if (!fs.existsSync(path.join(dir, ".git"))) {
        console.log(`↓ Cloning ${repoUrl} (${branch}) into ${dir}`);
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        await run("git", ["clone", "-b", branch, "--", repoUrl, dir]);
      } else {
        console.log(`↻ Updating ${dir}`);
        await run("git", ["fetch", "origin", branch], { cwd: dir });
        await run("git", ["checkout", branch], { cwd: dir });
        // Match HEAD to GitHub without touching the files; the browser writes them next.
        await run("git", ["reset", "--mixed", `origin/${branch}`], { cwd: dir });
      }
      state.dir = dir;
      await startWatcher(dir);
      return { dir };
    },

    async writeFile({ path: p, content }) {
      if (typeof content !== "string") throw new Error("content must be a string");
      const abs = safeResolve(needDir(), p);
      const prev = await fs.promises.readFile(abs, "utf8").catch(() => null);
      if (prev === content) return { changed: false };
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      echo.noteWrite(p, content);
      await fs.promises.writeFile(abs, content);
      return { changed: true };
    },

    async deleteFile({ path: p }) {
      const abs = safeResolve(needDir(), p);
      if (!fs.existsSync(abs)) return { changed: false };
      echo.noteWrite(p, null);
      await fs.promises.rm(abs);
      return { changed: true };
    },

    async sync({ branch }) {
      const dir = needDir();
      if (typeof branch !== "string" || branch.startsWith("-")) throw new Error("Bad branch name");
      // The checkpoint was committed through the GitHub API. Move HEAD and the
      // index to it but leave the working tree alone, so `git status` is clean.
      await run("git", ["fetch", "origin", branch], { cwd: dir });
      await run("git", ["reset", "--mixed", `origin/${branch}`], { cwd: dir });
      return null;
    },

    async reveal({ app }) {
      const dir = needDir();
      if (app === "vscode") await run("code", [dir]);
      else await run("open", [dir]);
      return null;
    },

    async "pty.spawn"({ cols, rows }) {
      const dir = needDir();
      state.pty?.kill();
      const pty = await loadPty();
      const shell = process.env.SHELL || "/bin/zsh";
      const term = pty.spawn(shell, ["-l"], {
        name: "xterm-256color",
        cols: Number(cols) || 80,
        rows: Number(rows) || 24,
        cwd: dir,
        env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
      });
      state.pty = term;
      term.onData((data) => send(event("pty.data", { data })));
      term.onExit(({ exitCode }) => {
        if (state.pty === term) state.pty = null;
        send(event("pty.exit", { code: exitCode }));
      });
      // Start Claude Code right away. If it isn't installed you still get a shell.
      term.write("claude\r");
      return null;
    },

    async "pty.write"({ data }) {
      if (typeof data === "string") state.pty?.write(data);
      return null;
    },

    async "pty.resize"({ cols, rows }) {
      if (cols > 0 && rows > 0) state.pty?.resize(cols, rows);
      return null;
    },

    async "pty.kill"() {
      state.pty?.kill();
      state.pty = null;
      return null;
    },
  };

  ws.on("message", async (raw) => {
    let req;
    try {
      req = parseRequest(raw);
    } catch (err) {
      return send(fail(null, err));
    }
    const handler = handlers[req.type];
    if (!handler) return send(fail(req.id, `Unknown request: ${req.type}`));
    try {
      // Terminal requests run one at a time so a quick spawn → kill → spawn
      // (React dev remounts) can't leave an orphaned shell behind.
      const result = req.type.startsWith("pty.")
        ? await (ptyQueue = ptyQueue.catch(() => {}).then(() => handler(req.payload)))
        : await handler(req.payload);
      send(ok(req.id, result));
    } catch (err) {
      const msg = err?.stderr?.toString().trim() || err?.message || String(err);
      console.error(`✗ ${req.type}: ${msg}`);
      send(fail(req.id, msg));
    }
  });

  ws.on("close", () => {
    console.log("· Browser disconnected");
    state.watcher?.close();
    state.pty?.kill();
  });
});

let ptyModule;
async function loadPty() {
  if (ptyModule) return ptyModule;
  try {
    ptyModule = (await import("node-pty")).default;
    return ptyModule;
  } catch (err) {
    throw new Error(`node-pty isn't available (${err.message}). Run \`npm install --prefix link\`.`);
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
