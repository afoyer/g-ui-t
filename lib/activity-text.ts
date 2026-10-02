import type { Activity } from "@/lib/types";

export const ACTIVITY_VERB: Record<Activity["kind"], string> = {
  created: "created the project",
  change_started: "started",
  shared: "shared for review",
  approved: "approved",
  changes_requested: "asked for changes on",
  merged: "added to Current",
  restored: "restored Current to before",
  joined: "joined the project",
  commented: "commented on",
};
