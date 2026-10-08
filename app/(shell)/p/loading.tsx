import { Skeleton } from "@/components/motion/skeleton";
import { TabSkeleton } from "@/components/motion/page-skeletons";

// Shown while opening a project. Switching tabs inside one keeps its real header.
export default function Loading() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-4 border-b border-line-soft px-[30px] pt-[22px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-[180px]" />
            <Skeleton className="h-3 w-[240px]" />
          </div>
          <Skeleton className="h-7 w-[110px]" />
        </div>
        <div className="flex gap-5 pb-2.5">
          {[64, 64, 52, 56].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
      </div>
      <TabSkeleton />
    </div>
  );
}
