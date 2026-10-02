import { LoadingNote, Skeleton, SkeletonRows } from "@/components/motion/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-[22px] px-[30px] py-[26px]">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-[220px]" />
          <Skeleton className="h-3 w-[140px]" />
        </div>
        <LoadingNote>Loading…</LoadingNote>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
        <SkeletonRows count={3} />
        <SkeletonRows count={2} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-[8px]" />
        ))}
      </div>
    </div>
  );
}
