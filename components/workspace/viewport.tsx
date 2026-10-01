"use client";

export type Viewport = "desktop" | "tablet" | "mobile";

export const VIEWPORT_WIDTH: Record<Viewport, number | null> = { desktop: null, tablet: 768, mobile: 375 };

export function ViewportToggle({ value, onChange }: { value: Viewport; onChange: (v: Viewport) => void }) {
  return (
    <div className="flex gap-0.5 rounded-[6px] bg-[#e4e4e2] p-0.5 text-[12px]" role="radiogroup" aria-label="Preview size">
      {(Object.keys(VIEWPORT_WIDTH) as Viewport[]).map((v) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[5px] px-2.5 py-[3px] capitalize ${
            value === v ? "bg-white shadow-[0_1px_1px_rgba(0,0,0,.06)]" : "text-[#55575c]"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** Centres the preview at the chosen device width on the grey stage. */
export function ViewportFrame({ viewport, children }: { viewport: Viewport; children: React.ReactNode }) {
  const width = VIEWPORT_WIDTH[viewport];
  return (
    <div className="flex min-h-0 flex-1 justify-center">
      <div
        className={`relative flex h-full min-h-0 flex-col overflow-hidden border border-[#e2e2df] bg-white ${
          viewport === "mobile" ? "rounded-[22px] shadow-[0_8px_24px_rgba(0,0,0,.08)]" : "rounded-[8px]"
        }`}
        style={{ width: width ?? "100%", maxWidth: "100%" }}
      >
        {children}
      </div>
    </div>
  );
}
