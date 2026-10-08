import { LoadingNote, Skeleton, SkeletonRows } from "./skeleton";

/** A titled list page (Projects, Reviews, Activity) while it loads. */
export function ListPageSkeleton({ sections = 1, note }: { sections?: number; note?: string }) {
  return (
    <div className="flex max-w-[960px] flex-col gap-5 px-[30px] py-[26px]">
      <div className="flex items-end justify-between">
        <Skeleton className="h-5 w-[140px]" />
        {note && <LoadingNote>{note}</LoadingNote>}
      </div>
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          {sections > 1 && <Skeleton className="h-3 w-[110px]" />}
          <SkeletonRows count={i === 0 ? 4 : 2} />
        </div>
      ))}
    </div>
  );
}

/** A project tab's body; the project header and tabs stay on screen above it. */
export function TabSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="flex flex-col gap-5 px-[30px] py-6">
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-[110px]" />
          <SkeletonRows count={i === 0 ? 3 : 2} />
        </div>
      ))}
    </div>
  );
}
