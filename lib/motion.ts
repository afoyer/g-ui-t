/**
 * One motion language for the whole app: quick, quiet, ease-out.
 * Durations stay under ~250ms so nothing feels like it's waiting on animation.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const; // sleek ease-out (quint-like)
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = { fast: 0.15, base: 0.2, slow: 0.26 } as const;

export const SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 380, damping: 32 } as const;

export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DURATION.base, ease: EASE_OUT },
} as const;
