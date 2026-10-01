import { getMembers, getProject } from "@/lib/data";
import { Avatar } from "@/components/ui";
import { ProjectTabs } from "./tabs";
import { StartChangeButton } from "./start-change";

export default async function ProjectLayout({ children, params }: LayoutProps<"/p/[id]">) {
  const { id } = await params;
  const [project, members] = await Promise.all([getProject(id), getMembers(id)]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-4 border-b border-line-soft px-[30px] pt-[22px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.01em]">{project.name}</h1>
            <div className="mt-0.5 text-[12.5px] text-muted">
              {project.description || "No description"}{" "}
              <span className="git-hint">
                · {project.repo_owner}/{project.repo_name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {members.slice(0, 6).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-white">
                  <Avatar profile={m} />
                </span>
              ))}
            </div>
            <StartChangeButton projectId={id} />
          </div>
        </div>
        <ProjectTabs projectId={id} />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
