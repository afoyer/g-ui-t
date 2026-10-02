import { LoadingNote, Skeleton, SkeletonRows } from "@/components/motion/skeleton";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6 px-[30px] py-6 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[132px] rounded-[8px]" />
        <SkeletonRows count={2} />
        <SkeletonRows count={3} />
      </div>
      <div className="flex flex-col gap-3">
        <LoadingNote>Checking what the team is up to…</LoadingNote>
        <Skeleton className="h-[96px] rounded-[8px]" />
      </div>
    </div>
  );
}
