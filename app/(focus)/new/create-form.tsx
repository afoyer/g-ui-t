"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useFeedback } from "@/components/motion/feedback-provider";
import { ActionLabel } from "@/components/motion/spinner";
import { COMING_SOON, TEMPLATES } from "@/templates";
import { slugify } from "@/lib/files";
import type { ProjectType, Role } from "@/lib/types";
import { createProject, type NewProject } from "./actions";

const TYPES = Object.entries(TEMPLATES) as [ProjectType, (typeof TEMPLATES)[ProjectType]][];

export function CreateForm({ githubLogin }: { githubLogin: string }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("prototype");
  const [startFrom, setStartFrom] = useState<NewProject["startFrom"]>("template");
  const [sharing, setSharing] = useState<"me" | "invite">("me");
  const [invites, setInvites] = useState<{ login: string; role: Role }[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();

  const t = TEMPLATES[type];
  const repoName = slugify(name) || "your-project";
  const people = sharing === "invite" ? invites : [];

  function addInvite() {
    const login = draft.trim().replace(/^@/, "");
    if (!login || invites.some((i) => i.login.toLowerCase() === login.toLowerCase())) return;
    setInvites([...invites, { login, role: "editor" }]);
    setDraft("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = toast({
      tone: "loading",
      title: `Setting up ${name.trim()}…`,
      description: "Creating a private space and adding the starter files",
      onNavigate: { tone: "success", title: `${name.trim()} is ready`, description: "Start a Change to begin designing." },
    });
    startTransition(async () => {
      const res = await createProject({ name, description, type, startFrom, invites: people });
      if (res?.error) {
        setError(res.error);
        toast({ id, tone: "error", title: "Couldn't create the project", description: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-[1000px] grid-cols-1 gap-8 px-8 py-8 md:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <Field label="Project name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fieldnotes" autoFocus required />
        </Field>
        <Field label="Description (optional)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A field journal for birders" />
        </Field>

        <Field label="What are you making?">
          <div className="flex flex-wrap gap-2">
            {TYPES.map(([key, tpl]) => (
              <Choice key={key} selected={type === key} onClick={() => setType(key)} title={tpl.label} sub={tpl.blurb} />
            ))}
            {COMING_SOON.map((c) => (
              <Choice key={c.label} disabled title={c.label} sub="Coming soon" />
            ))}
          </div>
        </Field>

        <Field label="Start from">
          <Segmented
            value={startFrom}
            onChange={(v) => setStartFrom(v as NewProject["startFrom"])}
            options={[
              { value: "template", label: "Starter files" },
              { value: "empty", label: "Empty" },
              { value: "folder", label: "A folder", disabled: true },
              { value: "github", label: "From GitHub", disabled: true },
            ]}
          />
          <p className="text-[12px] text-muted">
            {startFrom === "template" ? `Comes with a small ${t.label.toLowerCase()} to change.` : "Just a README. Add everything yourself."}{" "}
            Bringing in an existing folder or GitHub project is coming soon.
          </p>
        </Field>

        <Field label="Who can open it?">
          <Segmented
            value={sharing}
            onChange={(v) => setSharing(v as "me" | "invite")}
            options={[
              { value: "me", label: "Just me" },
              { value: "invite", label: "Invite people" },
            ]}
          />
          <p className="text-[12px] text-muted">
            {sharing === "me"
              ? "Only you, for now. You can invite people later from the project's People tab."
              : "Add teammates now. They'll see the project on their Home and can make Changes or just look."}
          </p>
          <AnimatePresence initial={false}>
          {sharing === "invite" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE_OUT }}
              className="overflow-hidden"
            >
            <div className="mt-3 flex flex-col gap-2">
              <AnimatePresence initial={false}>
              {invites.map((inv, i) => (
                <motion.div
                  key={inv.login}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: -8 }}
                  className="flex items-center gap-2 rounded-[6px] border border-line px-2.5 py-1.5"
                >
                  <span className="flex-1 font-medium">@{inv.login}</span>
                  <select
                    className="rounded-[5px] bg-transparent text-[12px] text-ink-2"
                    value={inv.role}
                    onChange={(e) =>
                      setInvites(invites.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))
                    }
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="button" className="text-[12px] text-faint hover:text-ink" onClick={() => setInvites(invites.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </motion.div>
              ))}
              </AnimatePresence>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Add by GitHub username"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInvite();
                    }
                  }}
                />
                <button type="button" className="btn btn-secondary h-8" onClick={addInvite}>
                  Add
                </button>
              </div>
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </Field>
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-[10px] bg-stage p-5 md:sticky md:top-6">
        <div className="text-[13px] font-semibold">We&apos;ll set this up for you</div>
        <motion.ul layout className="flex flex-col gap-3">
          <Check title={startFrom === "template" ? t.stack : `Empty ${t.stack} project`} sub={startFrom === "template" ? `From the ${t.label} template` : "Just a README to start"} />
          <Check title="A live preview" sub="Opens as you make changes" />
          <Check title="Saved privately" sub="Only people you invite can open it" hint={`private GitHub repo ${githubLogin}/${repoName} · main`} />
          <AnimatePresence initial={false}>
          {people.length > 0 && (
            <Check
              key="invites"
              title={`Invites for ${people.map((p) => "@" + p.login).join(", ")}`}
              sub="They'll see it on their Home"
              hint="collaborator invitations"
            />
          )}
          </AnimatePresence>
        </motion.ul>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <button className="btn btn-primary btn-lg w-full" disabled={pending || !name.trim()}>
          <ActionLabel pending={pending} pendingText="Setting up…">
            Create Project
          </ActionLabel>
        </button>
        <p className="-mt-2 text-center text-[11.5px] text-muted">Takes a few seconds</p>
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function Choice({
  title,
  sub,
  selected,
  disabled,
  onClick,
}: {
  title: string;
  sub: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`w-[170px] rounded-[8px] border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-ink bg-white shadow-[0_0_0_1px_var(--color-ink)]" : "border-line bg-white hover:border-[#c4c4c1]"
      } disabled:cursor-default disabled:opacity-45 disabled:hover:border-line`}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-0.5 text-[12px] leading-snug text-muted">{sub}</div>
    </motion.button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <div className="flex w-fit gap-0.5 rounded-[6px] bg-[#e4e4e2] p-0.5 text-[12.5px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          title={o.disabled ? "Coming soon" : undefined}
          onClick={() => onChange(o.value)}
          className={`relative rounded-[5px] px-3 py-1 ${value === o.value ? "text-ink" : "text-[#55575c]"} disabled:opacity-40`}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join("-")}`}
              className="absolute inset-0 rounded-[5px] bg-white shadow-[0_1px_1px_rgba(0,0,0,.06)]"
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Check({ title, sub, hint }: { title: string; sub?: string; hint?: string }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      className="flex gap-2.5"
    >
      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-shared text-[10px] text-white">
        ✓
      </span>
      <div className="min-w-0">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={title}
            className="font-medium"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast }}
          >
            {title}
          </motion.div>
        </AnimatePresence>
        {sub && <div className="text-[12px] text-muted">{sub}</div>}
        {hint && <div className="git-hint truncate">{hint}</div>}
      </div>
    </motion.li>
  );
}
