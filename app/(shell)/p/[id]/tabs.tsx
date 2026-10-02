"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { SPRING } from "@/lib/motion";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const path = usePathname();
  const base = `/p/${projectId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/changes`, label: "Changes" },
    { href: `${base}/people`, label: "People" },
    { href: `${base}/history`, label: "History" },
  ];
  return (
    <nav className="-mb-px flex gap-5 text-[12.5px]">
      {tabs.map((t) => {
        const active = t.href === base ? path === base : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative pb-2.5 transition-colors ${active ? "font-medium text-ink" : "text-muted hover:text-ink"}`}
          >
            {t.label}
            {active && (
              <motion.span layoutId={`tab-underline-${projectId}`} className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ink" transition={SPRING} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
