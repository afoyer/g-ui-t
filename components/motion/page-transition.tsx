"use client";

import { motion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";

const VARIANTS = {
  // Sidebar screens: a quiet rise.
  page: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } },
  // 1b focus screens: a touch more depth, to signal a change of context.
  focus: { initial: { opacity: 0, scale: 0.985 }, animate: { opacity: 1, scale: 1 } },
  // Project tabs: content crossfade only, the header stays put.
  tab: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
} as const;

export function PageTransition({
  variant = "page",
  className,
  children,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: React.ReactNode;
}) {
  const v = VARIANTS[variant];
  return (
    <motion.div
      className={className}
      initial={v.initial}
      animate={v.animate}
      transition={{ duration: variant === "focus" ? DURATION.slow : DURATION.base, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
