import { describe, expect, it, vi } from "vitest";
import { commitFiles, restoreCurrentBefore, slugify } from "@/lib/github/repo";

function mockGitHub() {
  const calls: string[] = [];
  const track = <T>(name: string, value: T) =>
    vi.fn(async (args: unknown) => {
      calls.push(name);
      return typeof value === "function" ? (value as (a: unknown) => unknown)(args) : value;
    });
  const git = {
    getRef: track("getRef", { data: { object: { sha: "head" } } }),
    getCommit: track("getCommit", (a: unknown) => {
      const sha = (a as { commit_sha: string }).commit_sha;
      return { data: { sha, tree: { sha: `tree-of-${sha}` }, parents: [{ sha: `parent-of-${sha}` }] } };
    }),
    createTree: track("createTree", { data: { sha: "new-tree" } }),
    createCommit: track("createCommit", { data: { sha: "new-commit" } }),
    updateRef: track("updateRef", { data: {} }),
  };
  return { gh: { rest: { git } } as never, git, calls };
}

const repo = { owner: "maya", repo: "harbor" };

describe("commitFiles", () => {
  it("builds blob tree → commit → moves the branch", async () => {
    const { gh, git, calls } = mockGitHub();
    const sha = await commitFiles(gh, repo, "maya/checkout", { "/App.tsx": "x" }, "Checkpoint");
    expect(sha).toBe("new-commit");
    expect(calls).toEqual(["getRef", "getCommit", "createTree", "createCommit", "updateRef"]);
    expect(git.createTree).toHaveBeenCalledWith(
      expect.objectContaining({ base_tree: "tree-of-head", tree: [expect.objectContaining({ path: "App.tsx", content: "x" })] }),
    );
    expect(git.createCommit).toHaveBeenCalledWith(expect.objectContaining({ parents: ["head"], tree: "new-tree" }));
    expect(git.updateRef).toHaveBeenCalledWith(expect.objectContaining({ ref: "heads/maya/checkout", sha: "new-commit" }));
  });

  it("skips the commit when nothing changed", async () => {
    const { gh, git, calls } = mockGitHub();
    git.createTree.mockResolvedValueOnce({ data: { sha: "tree-of-head" } });
    expect(await commitFiles(gh, repo, "main", { "/App.tsx": "same" }, "noop")).toBe("head");
    expect(calls).not.toContain("createCommit");
  });
});

describe("restoreCurrentBefore", () => {
  it("adds a new commit on Current with the tree from before the merge", async () => {
    const { gh, git } = mockGitHub();
    await restoreCurrentBefore(gh, repo, "main", "merge123", "Header experiment");
    expect(git.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({ tree: "tree-of-parent-of-merge123", parents: ["head"] }),
    );
    expect(git.updateRef).toHaveBeenCalledWith(expect.objectContaining({ ref: "heads/main" }));
  });
});

describe("slugify", () => {
  it("makes repo-safe names", () => {
    expect(slugify("Checkout Redesign!")).toBe("checkout-redesign");
    expect(slugify("  Café   menu ")).toBe("cafe-menu");
  });
});
