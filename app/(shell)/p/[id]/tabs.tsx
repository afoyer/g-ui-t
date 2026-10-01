"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
            className={`border-b-2 pb-2.5 ${active ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
