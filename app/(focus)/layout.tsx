import { requireUser } from "@/lib/session";

/** Full-window screens from direction 1b: one task at a time, no sidebar. */
export default async function FocusLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return <div className="flex h-full flex-col">{children}</div>;
}
