"use client";

import { motion } from "motion/react";
import { Spinner } from "./spinner";

/** A placeholder block with a slow, soft shimmer. */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton rounded-[6px] ${className}`} style={style} aria-hidden />;
}

/** Plain-language status for slow loads ("Loading files from GitHub…"). */
export function LoadingNote({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={`flex items-center gap-2 text-[12px] text-muted ${className}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      role="status"
    >
      <Spinner />
      {children}
    </motion.div>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="panel">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="row">
          <Skeleton className="h-[22px] w-[22px] rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3" style={{ width: `${55 - i * 8}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${35 - i * 4}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
