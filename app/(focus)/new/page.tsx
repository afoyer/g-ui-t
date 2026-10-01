import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { requireUser } from "@/lib/session";
import { CreateForm } from "./create-form";

export default async function NewProjectPage() {
  const me = await requireUser();
  return (
    <>
      <TopBar
        left={<span className="ml-2 font-semibold">New Project</span>}
        right={
          <Link href="/" className="text-muted hover:text-ink">
            Cancel
          </Link>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CreateForm githubLogin={me.github_login} />
      </div>
    </>
  );
}
