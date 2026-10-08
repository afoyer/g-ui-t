import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  createEchoGuard,
  event,
  fail,
  folderFor,
  isTextFile,
  ok,
  parseRequest,
  safeResolve,
} from "../link/protocol.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "guit-link-"));
const root = path.join(tmp, "root");
const outside = path.join(tmp, "outside");
fs.mkdirSync(path.join(root, "src"), { recursive: true });
fs.mkdirSync(outside);
fs.symlinkSync(outside, path.join(root, "escape"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("safeResolve", () => {
  it("resolves paths inside the folder, including new files", () => {
    const real = fs.realpathSync(root);
    expect(safeResolve(root, "src/App.tsx")).toBe(path.join(real, "src/App.tsx"));
    expect(safeResolve(root, "new/dir/file.css")).toBe(path.join(real, "new/dir/file.css"));
  });

  it("rejects paths that escape", () => {
    expect(() => safeResolve(root, "../x")).toThrow();
    expect(() => safeResolve(root, "src/../../x")).toThrow();
    expect(() => safeResolve(root, "/etc/passwd")).toThrow();
    expect(() => safeResolve(root, "escape/secret.txt")).toThrow();
  });
});

describe("folderFor", () => {
  it("gives each branch its own folder", () => {
    expect(folderFor("shop", "change/new-cart", "/home/me")).toBe("/home/me/G-ui-t/shop@change-new-cart");
    expect(folderFor("shop", "main", "/home/me")).toBe("/home/me/G-ui-t/shop@main");
  });
});

describe("isTextFile", () => {
  it("matches the editable extensions", () => {
    expect(isTextFile("App.tsx")).toBe(true);
    expect(isTextFile("logo.png")).toBe(false);
  });
});

describe("echo guard", () => {
  it("skips our own write once, then reports external edits", () => {
    const g = createEchoGuard();
    g.noteWrite("App.tsx", "a");
    expect(g.isEcho("App.tsx", "a")).toBe(true);
    // A later edit, even back to the same content, is someone else's.
    expect(g.isEcho("App.tsx", "a")).toBe(false);
    g.noteWrite("App.tsx", "b");
    expect(g.isEcho("App.tsx", "c")).toBe(false);
  });
});

describe("envelope", () => {
  it("round-trips requests, responses and events", () => {
    expect(parseRequest(JSON.stringify({ id: 1, type: "writeFile", path: "a", content: "x" }))).toEqual({
      id: 1,
      type: "writeFile",
      payload: { path: "a", content: "x" },
    });
    expect(() => parseRequest("{}")).toThrow();
    expect(() => parseRequest("nope")).toThrow();
    expect(JSON.parse(ok(1, { dir: "/d" }))).toEqual({ id: 1, ok: true, data: { dir: "/d" } });
    expect(JSON.parse(fail(2, new Error("boom")))).toEqual({ id: 2, ok: false, error: "boom" });
    expect(JSON.parse(event("fileChanged", { path: "a", content: "x" }))).toEqual({
      event: "fileChanged",
      path: "a",
      content: "x",
    });
  });
});
