import Link from "next/link";
import { Avatar } from "@/components/ui";
import type { Profile } from "@/lib/types";
import { Nav } from "./nav";
import { HintsToggle } from "./hints-toggle";

type Props = React.ComponentProps<typeof Nav> & { me: Profile };

export function Sidebar({ me, ...nav }: Props) {
  return (
    <aside className="flex w-[200px] flex-none flex-col gap-px border-r border-[#e8e8e6] bg-sidebar px-2 py-3 text-[12.5px] text-ink-2">
      <Link href="/" className="flex items-center gap-2 px-2 pt-0.5 pb-3">
        <span className="h-[18px] w-[18px] rounded-[5px] bg-ink" />
        <b className="font-semibold text-ink">G-ui-t</b>
      </Link>
      <Nav {...nav} />
      <div className="mt-auto flex flex-col gap-1 pt-4">
        <HintsToggle />
        <form action="/auth/signout" method="post" className="flex items-center gap-2 px-2 py-1.5">
          <Avatar profile={me} />
          <span className="flex-1 truncate">{me.name ?? me.github_login}</span>
          <button className="text-[11px] text-faint hover:text-ink" title="Sign out">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
