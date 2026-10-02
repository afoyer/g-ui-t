import { LoadingNote, Skeleton } from "./skeleton";

/** Skeleton for the 1b screens: top bar, grey stage, optional side panel. */
export function FocusLoading({ note, sidePanel = true, code = false }: { note: string; sidePanel?: boolean; code?: boolean }) {
  return (
    <>
      <div className="flex h-10 flex-none items-center gap-3 border-b border-[#e4e4e2] bg-[#f4f4f3] px-3.5">
        <span className="h-[14px] w-[14px] rounded-[4px] bg-ink" />
        <Skeleton className="h-3 w-[180px]" />
      </div>
      <div className="flex min-h-0 flex-1">
        {code && (
          <div className="flex w-[44%] min-w-[360px] max-w-[640px] flex-none flex-col gap-2.5 border-r border-line p-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-2.5" style={{ width: `${30 + ((i * 37) % 60)}%` }} />
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3 bg-stage p-4">
          <Skeleton className="h-[26px] w-[200px]" />
          <div className="flex flex-1 items-center justify-center rounded-[8px] border border-[#e2e2df] bg-white">
            <LoadingNote>{note}</LoadingNote>
          </div>
        </div>
        {sidePanel && (
          <div className="flex w-[300px] flex-none flex-col gap-4 border-l border-[#ececea] p-[18px]">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="h-[52px] rounded-[8px]" />
            <Skeleton className="h-3 w-[40%]" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-[72px]" />
              <Skeleton className="h-5 w-[88px]" />
            </div>
            <Skeleton className="mt-auto h-[34px] rounded-[7px]" />
          </div>
        )}
      </div>
    </>
  );
}
