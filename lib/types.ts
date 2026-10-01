export type ProjectType = "prototype" | "website" | "blank";
export type Role = "editor" | "viewer";
export type ChangeStatus = "draft" | "in_review" | "changes_requested" | "merged" | "closed";
export type ReviewState = "waiting" | "approved" | "changes_requested";

export type Profile = {
  id: string;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
};

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  type: ProjectType;
  repo_owner: string;
  repo_name: string;
  default_branch: string;
  current_sha: string | null;
  updated_at: string;
};

export type Change = {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  description: string | null;
  branch: string;
  status: ChangeStatus;
  pr_number: number | null;
  changed_files: string[];
  merge_sha: string | null;
  merged_at: string | null;
  merged_by: string | null;
  updated_at: string;
  created_at: string;
};

export type Comment = {
  id: string;
  change_id: string;
  author_id: string;
  body: string;
  pin_x: number | null;
  pin_y: number | null;
  viewport: string | null;
  created_at: string;
};

export type ReviewRequest = {
  change_id: string;
  reviewer_id: string;
  state: ReviewState;
};

export type Invite = {
  id: string;
  project_id: string;
  github_login: string;
  role: Role;
  invited_by: string;
  accepted_at: string | null;
};

export type Activity = {
  id: number;
  project_id: string;
  actor_id: string;
  kind: "created" | "change_started" | "shared" | "approved" | "changes_requested" | "merged" | "restored" | "joined" | "commented";
  payload: Record<string, string | number | null>;
  created_at: string;
};

/** Sandpack-style file map: keys start with "/". */
export type FileMap = Record<string, string>;
