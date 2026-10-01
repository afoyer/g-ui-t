"use client";

import { SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";
import type { FileMap } from "@/lib/types";

/** A live, non-editable preview of one version of a project. */
export function PreviewOnly({ template, files }: { template: "react-ts" | "static" | "vanilla"; files: FileMap }) {
  return (
    <SandpackProvider template={template} files={files} className="!h-full" style={{ height: "100%" }}>
      <SandpackPreview
        showOpenInCodeSandbox={false}
        showRefreshButton
        style={{ height: "100%", flex: 1 }}
      />
    </SandpackProvider>
  );
}
