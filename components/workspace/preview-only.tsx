"use client";

import { SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";
import type { FileMap } from "@/lib/types";
import { PreviewLoading } from "./preview-loading";

/** A live, non-editable preview of one version of a project. */
export function PreviewOnly({
  template,
  files,
  thumbnail = false,
}: {
  template: "react-ts" | "static" | "vanilla";
  files: FileMap;
  /** No refresh button or loading words. */
  thumbnail?: boolean;
}) {
  return (
    <SandpackProvider template={template} files={files} className="!h-full" style={{ height: "100%" }}>
      <div className="relative flex h-full flex-col">
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={!thumbnail}
          style={{ height: "100%", flex: 1 }}
        />
        <PreviewLoading quiet={thumbnail} />
      </div>
    </SandpackProvider>
  );
}
