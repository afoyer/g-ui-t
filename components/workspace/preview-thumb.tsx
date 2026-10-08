"use client";

import { useEffect, useRef, useState } from "react";
import type { FileMap } from "@/lib/types";
import { PreviewOnly } from "./preview-only";

// Thumbnails render the page at this width, then scale it down to fit.
const PAGE_WIDTH = 1280;

/** A live, scaled-down preview that only starts building once it scrolls into view. */
export function PreviewThumb({
  template,
  files,
  className = "",
}: {
  template: "react-ts" | "static" | "vanilla";
  files: FileMap;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / PAGE_WIDTH));
    io.observe(el);
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`hatch pointer-events-none relative overflow-hidden ${className}`} aria-hidden>
      {visible && scale > 0 && (
        <div
          className="absolute top-0 left-0 origin-top-left bg-white"
          style={{ width: PAGE_WIDTH, height: `${100 / scale}%`, transform: `scale(${scale})` }}
        >
          <PreviewOnly template={template} files={files} thumbnail />
        </div>
      )}
    </div>
  );
}
