import type { Octokit } from "octokit";
import type { FileMap } from "@/lib/types";
import { isEditable, slugify, toRepoPath, toSandpackPath } from "@/lib/files";

export { slugify };

/**
 * All Git work G-ui-t does, in designer terms:
 *   Current = default branch, Change = branch, Checkpoint = commit,
 *   Share for Review = pull request, Add to Current = merge.
 * Every function takes the Octokit instance so tests can pass a mock.
 */
export type Repo = { owner: string; repo: string };
type GH = Pick<Octokit, "rest">;

export class FriendlyError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Creates a private repo and seeds it with the template as its first commit. */
export async function createProjectRepo(
  gh: GH,
  opts: { name: string; description?: string; files: FileMap },
) {
  const repoName = slugify(opts.name) || "project";
  let created;
  try {
    created = await gh.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: opts.description || "Made with G-ui-t",
      private: true,
      auto_init: true,
    });
  } catch (e) {
    if (status(e) === 422) {
      throw new FriendlyError(`You already have a GitHub repo called "${repoName}". Try another name.`);
    }
    throw e;
  }
  const repo: Repo = { owner: created.data.owner.login, repo: created.data.name };
  const branch = created.data.default_branch;

  // auto_init's first commit can take a moment to appear.
  let sha: string | null = null;
  for (let i = 0; i < 5 && !sha; i++) {
    try {
      sha = await commitFiles(gh, repo, branch, opts.files, "Start project from G-ui-t template");
    } catch (e) {
      if (status(e) !== 409 && status(e) !== 404) throw e;
      await sleep(800);
    }
  }
  if (!sha) throw new FriendlyError("GitHub took too long to set up the repo. Try again in a moment.");
  return { ...repo, defaultBranch: branch, sha };
}

/** Reads every editable text file at `ref` into a Sandpack file map. */
export async function readFiles(gh: GH, repo: Repo, ref: string): Promise<FileMap> {
  const { data: tree } = await gh.rest.git.getTree({ ...repo, tree_sha: ref, recursive: "true" });
  const blobs = tree.tree.filter(
    (e) => e.type === "blob" && e.path && isEditable(e.path) && (e.size ?? 0) < 200_000,
  );
  const entries = await Promise.all(
    blobs.map(async (e) => {
      const { data } = await gh.rest.git.getBlob({ ...repo, file_sha: e.sha! });
      return [toSandpackPath(e.path!), Buffer.from(data.content, "base64").toString("utf8")] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Saves a Checkpoint: one commit on `branch` containing `files`
 * (only the files that changed). Returns the new commit sha, or the
 * current head if nothing actually changed.
 */
export async function commitFiles(
  gh: GH,
  repo: Repo,
  branch: string,
  files: FileMap,
  message: string,
): Promise<string> {
  const { data: ref } = await gh.rest.git.getRef({ ...repo, ref: `heads/${branch}` });
  const head = ref.object.sha;
  const { data: headCommit } = await gh.rest.git.getCommit({ ...repo, commit_sha: head });

  const { data: tree } = await gh.rest.git.createTree({
    ...repo,
    base_tree: headCommit.tree.sha,
    tree: Object.entries(files).map(([path, content]) => ({
      path: toRepoPath(path),
      mode: "100644" as const,
      type: "blob" as const,
      content,
    })),
  });
  if (tree.sha === headCommit.tree.sha) return head;

  return writeCommit(gh, repo, branch, tree.sha, head, message);
}

/** Points `branch` at a new commit whose tree is `treeSha` (history is kept). */
async function writeCommit(gh: GH, repo: Repo, branch: string, treeSha: string, parent: string, message: string) {
  const { data: commit } = await gh.rest.git.createCommit({
    ...repo,
    message,
    tree: treeSha,
    parents: [parent],
  });
  await gh.rest.git.updateRef({ ...repo, ref: `heads/${branch}`, sha: commit.sha });
  return commit.sha;
}

/**
 * Makes `branch` look exactly like it did at `sha`, as a new commit on top.
 * Used both for restoring a Checkpoint and for restoring Current.
 */
export async function restoreTo(gh: GH, repo: Repo, branch: string, sha: string, message: string) {
  const { data: target } = await gh.rest.git.getCommit({ ...repo, commit_sha: sha });
  const { data: ref } = await gh.rest.git.getRef({ ...repo, ref: `heads/${branch}` });
  return writeCommit(gh, repo, branch, target.tree.sha, ref.object.sha, message);
}

/** Restores Current to just before a merge (the merge's first parent). */
export async function restoreCurrentBefore(gh: GH, repo: Repo, defaultBranch: string, mergeSha: string, title: string) {
  const { data: merge } = await gh.rest.git.getCommit({ ...repo, commit_sha: mergeSha });
  const before = merge.parents[0]?.sha;
  if (!before) throw new FriendlyError("That was the very first version, so there's nothing before it.");
  return restoreTo(gh, repo, defaultBranch, before, `Restore Current to before "${title}"`);
}

export async function createBranch(gh: GH, repo: Repo, from: string, branch: string) {
  const { data: ref } = await gh.rest.git.getRef({ ...repo, ref: `heads/${from}` });
  await gh.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha: ref.object.sha });
  return ref.object.sha;
}

/** Checkpoints on a Change (commits ahead of Current) and the files it touches. */
export async function compareWithCurrent(gh: GH, repo: Repo, defaultBranch: string, branch: string) {
  const { data } = await gh.rest.repos.compareCommitsWithBasehead({
    ...repo,
    basehead: `${defaultBranch}...${branch}`,
  });
  return {
    behindBy: data.behind_by,
    checkpoints: data.commits
      .map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        date: c.commit.author?.date ?? c.commit.committer?.date ?? null,
        author: c.author?.login ?? c.commit.author?.name ?? null,
      }))
      .reverse(),
    files: (data.files ?? []).map((f) => f.filename),
  };
}

/** Brings the latest Current into a Change. */
export async function updateFromCurrent(gh: GH, repo: Repo, defaultBranch: string, branch: string) {
  try {
    const res = await gh.rest.repos.merge({
      ...repo,
      base: branch,
      head: defaultBranch,
      commit_message: "Bring in the latest Current",
    });
    return res.status === 201 ? res.data.sha : null;
  } catch (e) {
    if (status(e) === 409) {
      throw new FriendlyError(
        "Your Change and Current edit the same lines. Talk to whoever changed Current, or resolve it on GitHub.",
      );
    }
    throw e;
  }
}

export async function openPullRequest(
  gh: GH,
  repo: Repo,
  opts: { base: string; branch: string; title: string; body: string; reviewers: string[] },
) {
  const { data: pr } = await gh.rest.pulls.create({
    ...repo,
    base: opts.base,
    head: opts.branch,
    title: opts.title,
    body: opts.body,
  });
  if (opts.reviewers.length) {
    // Reviewers who haven't accepted their invite yet can't be requested; that's fine.
    await gh.rest.pulls
      .requestReviewers({ ...repo, pull_number: pr.number, reviewers: opts.reviewers })
      .catch(() => undefined);
  }
  return pr.number;
}

export async function submitReview(
  gh: GH,
  repo: Repo,
  prNumber: number,
  event: "APPROVE" | "REQUEST_CHANGES",
  body: string,
) {
  await gh.rest.pulls.createReview({ ...repo, pull_number: prNumber, event, body: body || undefined });
}

export async function mergePullRequest(gh: GH, repo: Repo, prNumber: number, title: string) {
  try {
    const { data } = await gh.rest.pulls.merge({
      ...repo,
      pull_number: prNumber,
      merge_method: "merge",
      commit_title: `Add "${title}" to Current (#${prNumber})`,
    });
    return data.sha;
  } catch (e) {
    if (status(e) === 405 || status(e) === 409) {
      throw new FriendlyError(
        "This Change can't be added automatically, usually because Current moved on. Use “Update from Current” first.",
      );
    }
    throw e;
  }
}

export async function inviteCollaborator(gh: GH, repo: Repo, username: string, role: "editor" | "viewer") {
  try {
    await gh.rest.repos.addCollaborator({
      ...repo,
      username,
      permission: role === "editor" ? "push" : "pull",
    });
  } catch (e) {
    if (status(e) === 404) throw new FriendlyError(`There's no GitHub user called "${username}".`);
    throw e;
  }
}

/**
 * Where each invited login stands on GitHub: already a collaborator,
 * still has a pending invitation, or neither (declined or expired).
 * Listing invitations needs admin rights, so non-owners only learn "joined".
 */
export async function invitationStatuses(gh: GH, repo: Repo) {
  const collaborators = await gh.rest.repos
    .listCollaborators({ ...repo, affiliation: "direct", per_page: 100 })
    .then((r) => new Set(r.data.map((c) => c.login.toLowerCase())))
    .catch(() => new Set<string>());
  const pending = await gh.rest.repos
    .listInvitations({ ...repo, per_page: 100 })
    .then((r) => new Map(r.data.filter((i) => i.invitee).map((i) => [i.invitee!.login.toLowerCase(), i.id])))
    .catch(() => null);
  return { collaborators, pending };
}

/** Removes someone's access, or withdraws their pending invitation. */
export async function revokeAccess(gh: GH, repo: Repo, username: string) {
  const { pending } = await invitationStatuses(gh, repo);
  const invitationId = pending?.get(username.toLowerCase());
  if (invitationId) await gh.rest.repos.deleteInvitation({ ...repo, invitation_id: invitationId });
  else await gh.rest.repos.removeCollaborator({ ...repo, username }).catch(() => undefined);
}

/** Accepts the pending GitHub invitation for this repo, if there is one. */
export async function acceptInvitation(gh: GH, repo: Repo) {
  const { data } = await gh.rest.repos.listInvitationsForAuthenticatedUser({ per_page: 100 });
  const fullName = `${repo.owner}/${repo.repo}`.toLowerCase();
  const invitation = data.find((i) => i.repository.full_name.toLowerCase() === fullName);
  if (invitation) {
    await gh.rest.repos.acceptInvitationForAuthenticatedUser({ invitation_id: invitation.id });
  }
  return Boolean(invitation);
}

function status(e: unknown) {
  return typeof e === "object" && e && "status" in e ? (e as { status: number }).status : undefined;
}
