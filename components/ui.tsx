import type { ChangeStatus, Profile } from "@/lib/types";

/** A stable hue per person/project, so colours match everywhere. */
export function hueFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return [30, 220, 330, 120, 265, 155, 75][h % 7];
}

export function initials(p: Pick<Profile, "name" | "github_login">) {
  const source = p.name?.trim() || p.github_login;
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)).toUpperCase();
}

export function firstName(p: Pick<Profile, "name" | "github_login">) {
  return p.name?.trim().split(/\s+/)[0] || p.github_login;
}

export function Avatar({
  profile,
  size = 22,
}: {
  profile: Pick<Profile, "name" | "github_login" | "avatar_url">;
  size?: number;
}) {
  const hue = hueFor(profile.github_login);
  return (
    <span
      title={profile.name ?? profile.github_login}
      className="inline-flex flex-none items-center justify-center overflow-hidden rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.43,
        background: `oklch(0.9 0.05 ${hue})`,
        color: `oklch(0.42 0.1 ${hue})`,
      }}
    >
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" width={size} height={size} />
      ) : (
        initials(profile)
      )}
    </span>
  );
}

export function ProjectSwatch({ id, size = 8 }: { id: string; size?: number }) {
  return (
    <span
      className="inline-block flex-none rounded-[2px]"
      style={{ width: size, height: size, background: `oklch(0.7 0.1 ${hueFor(id)})` }}
    />
  );
}

const STATUS: Record<ChangeStatus, { label: string; color: string; filled: boolean }> = {
  draft: { label: "Draft", color: "var(--color-draft)", filled: false },
  in_review: { label: "In review", color: "var(--color-review)", filled: true },
  changes_requested: { label: "Changes requested", color: "var(--color-danger)", filled: true },
  merged: { label: "Added to Current", color: "var(--color-shared)", filled: true },
  closed: { label: "Closed", color: "var(--color-draft)", filled: false },
};

export function statusLabel(s: ChangeStatus) {
  return STATUS[s].label;
}

export function StatusDot({ status, size = 7 }: { status: ChangeStatus | "editing"; size?: number }) {
  const color = status === "editing" ? "var(--color-editing)" : STATUS[status].color;
  const filled = status === "editing" || STATUS[status].filled;
  return (
    <span
      className="inline-block flex-none rounded-full"
      style={{ width: size, height: size, background: filled ? color : "transparent", border: `1.5px solid ${color}` }}
    />
  );
}

export function StatusBadge({ status }: { status: ChangeStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
      <StatusDot status={status} />
      {STATUS[status].label}
    </span>
  );
}

export function GitHint({ children }: { children: React.ReactNode }) {
  return <span className="git-hint">{children}</span>;
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <div className="label">{children}</div>
      {right}
    </div>
  );
}

export function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "new" }) {
  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-2 py-[3px] text-[12px] ${
        tone === "new" ? "bg-new text-new-ink" : "bg-chip text-ink"
      }`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-6 text-center text-[12.5px] text-muted">{children}</div>;
}

/** Striped stand-in while a real preview loads, or when it can't. */
export function PreviewTile({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`hatch flex items-center justify-center font-mono text-[10.5px] text-faint ${className}`}>
      {label}
    </div>
  );
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  // Past a day, "4 days ago" on every row stops telling things apart; give the real time.
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function clockTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
