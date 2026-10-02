"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useFeedback } from "./feedback-provider";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Children that are <Row>/<StaggerItem> fade up one after another on first paint. */
export function Stagger({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

const MotionLink = motion.create(Link);

/**
 * A list row that staggers in with its siblings and flashes softly when a
 * teammate changes the thing it represents (pass that thing's `id`).
 */
export function Row({
  id,
  href,
  className = "row",
  children,
}: {
  id?: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { flashed } = useFeedback();
  const on = Boolean(id && flashed.has(id));
  const props = { className: `relative isolate ${className}`, variants: item };
  // Its own layer, so the flash never slows the row's hover or fights the stagger.
  const glow = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-note transition-opacity ease-out"
      style={{ opacity: on ? 1 : 0, transitionDuration: on ? "150ms" : "1200ms" }}
    />
  );
  return href ? (
    <MotionLink href={href} {...props}>
      {glow}
      {children}
    </MotionLink>
  ) : (
    <motion.div {...props}>
      {glow}
      {children}
    </motion.div>
  );
}
