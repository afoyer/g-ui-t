"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ProjectSwatch } from "@/components/ui";
import { SPRING } from "@/lib/motion";

/** The grey pill that glides to whichever item is active. */
function ActivePill() {
  return (
    <motion.span
      layoutId="sidebar-active"
      className="absolute inset-0 -z-10 rounded-[6px] bg-sidebar-active"
      transition={SPRING}
    />
  );
}

type Props = {
  reviewCount: number;
  projects: {
    id: string;
    name: string;
    activeChanges: { id: string; title: string; state: { text: string; tone: "waiting" | "attention" } | null }[];
  }[];
};

export function Nav({ reviewCount, projects }: Props) {
  const path = usePathname();
  const item = (href: string, label: string, extra?: React.ReactNode, exact = false) => {
    const active = exact ? path === href : path.startsWith(href);
    return (
      <Link
        href={href}
        className={`relative isolate flex items-center justify-between rounded-[6px] px-2 py-[5px] transition-colors ${
          active ? "font-medium text-ink" : "hover:bg-[#efefed]"
        }`}
      >
        {active && <ActivePill />}
        {label}
        {extra}
      </Link>
    );
  };

  return (
    <>
      {item("/", "Home", null, true)}
      {item("/projects", "Projects")}
      {item("/reviews", "Reviews", reviewCount ? <span className="text-[11px] text-muted">{reviewCount}</span> : null)}
      {item("/activity", "Activity")}
      <div className="px-2 pt-4 pb-1 text-[11px] text-[#8b8d92]">Projects</div>
      {projects.map((p) => {
        const open = path.startsWith(`/p/${p.id}`);
        // Changes that need someone stay visible even when the project is closed.
        const shown = open ? p.activeChanges : p.activeChanges.filter((c) => c.state);
        return (
          <div key={p.id}>
            <Link
              href={`/p/${p.id}`}
              className={`relative isolate flex items-center gap-2 rounded-[6px] px-2 py-[5px] transition-colors ${
                open ? "font-medium text-ink" : "hover:bg-[#efefed]"
              }`}
            >
              {open && <ActivePill />}
              <ProjectSwatch id={p.id} />
              <span className="truncate">{p.name}</span>
            </Link>
            <AnimatePresence initial={false}>
              {shown.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  {shown.map((c) => (
                    <Link
                      key={c.id}
                      href={`/p/${p.id}/c/${c.id}`}
                      className="ml-[18px] block border-l-[1.5px] border-[#cfd0cd] py-1 pl-2.5 text-[12px] text-muted transition-colors hover:text-ink"
                    >
                      <span className="block truncate">{c.title}</span>
                      {c.state && (
                        <span
                          className={`flex items-center gap-1 truncate text-[11px] ${
                            c.state.tone === "attention" ? "text-danger" : "text-note-ink"
                          }`}
                        >
                          <span className="h-[5px] w-[5px] flex-none rounded-full bg-current" />
                          {c.state.text}
                        </span>
                      )}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      {projects.length === 0 && <div className="px-2 py-1 text-[12px] text-faint">No projects yet</div>}
    </>
  );
}
