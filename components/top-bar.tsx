import Link from "next/link";

/** The slim 40px bar used by the 1b focus screens. */
export function TopBar({
  back,
  left,
  center,
  right,
}: {
  back?: { href: string; label: string };
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="relative flex h-10 flex-none items-center gap-2 border-b border-[#e4e4e2] bg-[#f4f4f3] px-3.5 text-[12.5px]">
      <Link href="/" className="flex items-center" title="Home">
        <span className="h-[14px] w-[14px] rounded-[4px] bg-ink" />
      </Link>
      {back && (
        <Link href={back.href} className="ml-2 text-muted hover:text-ink">
          {back.label}
        </Link>
      )}
      {left}
      {center && (
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 [&_*]:pointer-events-auto">
          {center}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}
