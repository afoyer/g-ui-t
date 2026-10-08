// Pure helpers for the companion. No sockets or child processes here, so
// vitest can import this file directly (tests/link.test.ts).
import fs from "node:fs";
import path from "node:path";

// Same list as isEditable in lib/files.ts. Copied because this package is separate.
export const TEXT_EXTENSIONS = ["ts", "tsx", "js", "jsx", "css", "html", "json", "md", "svg", "txt"];

export function isTextFile(p) {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.includes(ext);
}

/**
 * Resolve `rel` inside `root`, refusing anything that would land outside it:
 * absolute paths, `..` segments, and symlinks that point elsewhere.
 * Works for files that don't exist yet by checking their nearest existing parent.
 */
export function safeResolve(root, rel) {
  if (typeof rel !== "string" || !rel) throw new Error("Empty path");
  if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) throw new Error(`Absolute path not allowed: ${rel}`);
  if (rel.split(/[\\/]+/).includes("..")) throw new Error(`Path escapes the folder: ${rel}`);

  const realRoot = fs.realpathSync(root);
  const target = path.resolve(realRoot, rel);

  // Walk up to the nearest existing ancestor and resolve its real location.
  let existing = target;
  const rest = [];
  while (!fs.existsSync(existing)) {
    rest.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  const real = path.join(fs.realpathSync(existing), ...rest);
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
    throw new Error(`Path escapes the folder: ${rel}`);
  }
  return real;
}

/** ~/G-ui-t/<repo>@<branch>, with "/" in branch names turned into "-". */
export function folderFor(repoName, branch, home) {
  const slug = branch.replace(/\//g, "-");
  return path.join(home, "G-ui-t", `${repoName}@${slug}`);
}

/**
 * Remembers what we just wrote so the watcher can ignore the echo of our own
 * writes. Each noted write is consumed once, so a later external edit (even to
 * the same content) is still reported.
 */
export function createEchoGuard() {
  const pending = new Map();
  return {
    noteWrite(p, content) {
      pending.set(p, content);
    },
    isEcho(p, content) {
      if (!pending.has(p) || pending.get(p) !== content) return false;
      pending.delete(p);
      return true;
    },
  };
}

// Message envelope:
//   request  {id, type, ...payload}
//   response {id, ok: true, data} | {id, ok: false, error}
//   event    {event, ...payload}
/** @param {string|number|null} id @param {unknown} [data] */
export function ok(id, data = null) {
  return JSON.stringify({ id, ok: true, data });
}

/** @param {string|number|null} id @param {unknown} error */
export function fail(id, error) {
  return JSON.stringify({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
}

/** @param {string} name @param {Record<string, unknown>} [payload] */
export function event(name, payload = {}) {
  return JSON.stringify({ ...payload, event: name });
}

/** Returns {id, type, payload} or throws on anything malformed. */
export function parseRequest(raw) {
  const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
  if (!msg || typeof msg !== "object") throw new Error("Bad message");
  const { id, type, ...payload } = msg;
  if ((typeof id !== "number" && typeof id !== "string") || typeof type !== "string") throw new Error("Bad message");
  return { id, type, payload };
}
