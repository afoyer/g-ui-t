"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectSwatch } from "@/components/ui";

type Props = {
  reviewCount: number;
  projects: { id: string; name: string; activeChanges: { id: string; title: string }[] }[];
};

export function Nav({ reviewCount, projects }: Props) {
  const path = usePathname();
  const item = (href: string, label: string, extra?: React.ReactNode, exact = false) => {
    const active = exact ? path === href : path.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center justify-between rounded-[6px] px-2 py-[5px] ${
          active ? "bg-sidebar-active font-medium text-ink" : "hover:bg-[#efefed]"
        }`}
      >
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
        return (
          <div key={p.id}>
            <Link
              href={`/p/${p.id}`}
              className={`flex items-center gap-2 rounded-[6px] px-2 py-[5px] ${
                open ? "bg-sidebar-active font-medium text-ink" : "hover:bg-[#efefed]"
              }`}
            >
              <ProjectSwatch id={p.id} />
              <span className="truncate">{p.name}</span>
            </Link>
            {open &&
              p.activeChanges.map((c) => (
                <Link
                  key={c.id}
                  href={`/p/${p.id}/c/${c.id}`}
                  className="ml-[18px] block truncate border-l-[1.5px] border-[#cfd0cd] py-1 pl-2.5 text-[12px] text-muted hover:text-ink"
                >
                  {c.title}
                </Link>
              ))}
          </div>
        );
      })}
      {projects.length === 0 && <div className="px-2 py-1 text-[12px] text-faint">No projects yet</div>}
    </>
  );
}
