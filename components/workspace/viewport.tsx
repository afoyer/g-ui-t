"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { EASE_OUT, SPRING } from "@/lib/motion";

export type Viewport = "desktop" | "tablet" | "mobile";

export const VIEWPORT_WIDTH: Record<Viewport, number | null> = { desktop: null, tablet: 768, mobile: 375 };

/** A segmented control whose white thumb glides to the selected option. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex gap-0.5 rounded-[6px] bg-[#e4e4e2] p-0.5 text-[12px]" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative rounded-[5px] px-2.5 py-[3px] transition-colors ${value === o.value ? "text-ink" : "text-[#55575c] hover:text-ink"}`}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-[5px] bg-white shadow-[0_1px_1px_rgba(0,0,0,.06)]"
              transition={SPRING}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ViewportToggle({ value, onChange }: { value: Viewport; onChange: (v: Viewport) => void }) {
  return (
    <Segmented
      label="Preview size"
      value={value}
      onChange={onChange}
      options={[
        { value: "desktop", label: "Desktop" },
        { value: "tablet", label: "Tablet" },
        { value: "mobile", label: "Mobile" },
      ]}
    />
  );
}

/** Centres the preview at the chosen device width; the frame glides between sizes. */
export function ViewportFrame({ viewport, children }: { viewport: Viewport; children: React.ReactNode }) {
  const width = VIEWPORT_WIDTH[viewport];
  return (
    <div className="flex min-h-0 flex-1 justify-center">
      <motion.div
        className="relative flex h-full min-h-0 max-w-full flex-col overflow-hidden border border-[#e2e2df] bg-white"
        initial={false}
        animate={{
          width: width ?? "100%",
          borderRadius: viewport === "mobile" ? 22 : 8,
          boxShadow: viewport === "mobile" ? "0 8px 24px rgba(0,0,0,.08)" : "0 0 0 rgba(0,0,0,0)",
        }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </div>
  );
}
