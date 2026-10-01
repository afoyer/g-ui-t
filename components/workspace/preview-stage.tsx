"use client";

import { useState } from "react";
import type { FileMap } from "@/lib/types";
import { PreviewOnly } from "./preview-only";
import { ViewportFrame, ViewportToggle, type Viewport } from "./viewport";

type Template = "react-ts" | "static" | "vanilla";

/** One or more versions shown side by side at the same device size. */
export function PreviewStage({
  template,
  versions,
}: {
  template: Template;
  versions: { label: React.ReactNode; files: FileMap }[];
}) {
  const [viewport, setViewport] = useState<Viewport>(versions.length > 1 ? "mobile" : "desktop");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 bg-stage p-4">
      <ViewportToggle value={viewport} onChange={setViewport} />
      <div className="flex min-h-0 flex-1 gap-4">
        {versions.map((v, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-2">
            {versions.length > 1 && <div className="text-[12px] font-medium text-ink-2">{v.label}</div>}
            <ViewportFrame viewport={viewport}>
              <PreviewOnly template={template} files={v.files} />
            </ViewportFrame>
          </div>
        ))}
      </div>
    </div>
  );
}
