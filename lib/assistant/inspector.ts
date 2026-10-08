import type { FileMap } from "@/lib/types";

/**
 * A small script that runs inside the preview so designers can click an
 * element to point the assistant at it. It lives only in Sandpack's copy of the
 * files: `withInspector` adds it on load, `withoutInspector` strips it before
 * anything is saved to GitHub or written to a linked folder.
 */

export const INSPECTOR_PATH = "/__gui-inspector.js";
const IMPORT_LINE = `import "./__gui-inspector.js";\n`;
const SCRIPT_TAG = `<script src="/__gui-inspector.js"></script>`;

// Sandpack's own react-ts entry, plus our import.
const REACT_ENTRY = `${IMPORT_LINE}import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App";
import React from "react";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

export type PickMessage = { type: "gui-pick"; on: boolean };
export type PickedMessage = {
  type: "gui-picked";
  tag: string;
  text: string;
  classes: string[];
  component?: string;
};

const SOURCE = `(function () {
  if (window.__guiInspector) return;
  window.__guiInspector = true;
  var on = false;
  var box = document.createElement("div");
  var tag = document.createElement("span");
  box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #4f46e5;background:rgba(79,70,229,.08);border-radius:4px;display:none;transition:all .06s ease-out";
  tag.style.cssText = "position:absolute;left:-2px;top:-22px;background:#4f46e5;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:4px 6px;border-radius:4px;white-space:nowrap";
  box.appendChild(tag);

  function componentOf(el) {
    var key = Object.keys(el).find(function (k) { return k.indexOf("__reactFiber$") === 0; });
    var f = key ? el[key] : null;
    while (f) {
      if (typeof f.type === "function" && f.type.name) return f.type.name;
      f = f.return;
    }
  }
  function firstLine(el) {
    var t = (el.innerText || el.textContent || "").trim();
    return t.split("\\n")[0].trim().slice(0, 120);
  }
  function pickable(el) {
    return el && el.nodeType === 1 && el !== document.body && el !== document.documentElement && el !== box && !box.contains(el);
  }
  function describe(el) {
    var c = componentOf(el);
    var name = c && c !== "App" ? c : el.tagName.toLowerCase();
    var t = firstLine(el);
    return t ? name + " · " + (t.length > 24 ? t.slice(0, 23) + "…" : t) : name;
  }
  function show(el) {
    if (!box.isConnected) document.body.appendChild(box);
    var r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = r.left + "px";
    box.style.top = r.top + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
    tag.style.top = r.top < 24 ? "auto" : "-22px";
    tag.style.bottom = r.top < 24 ? "-22px" : "auto";
    tag.textContent = describe(el);
  }
  function setOn(v) {
    on = v;
    document.documentElement.style.cursor = v ? "crosshair" : "";
    if (!v) box.style.display = "none";
  }
  document.addEventListener("mouseover", function (e) {
    if (on && pickable(e.target)) show(e.target);
  }, true);
  document.addEventListener("click", function (e) {
    if (!on || !pickable(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    setOn(false);
    window.parent.postMessage({
      type: "gui-picked",
      tag: el.tagName.toLowerCase(),
      text: firstLine(el),
      classes: Array.prototype.slice.call(el.classList),
      component: componentOf(el)
    }, "*");
  }, true);
  document.addEventListener("keydown", function (e) {
    if (on && e.key === "Escape") {
      setOn(false);
      window.parent.postMessage({ type: "gui-pick-cancel" }, "*");
    }
  });
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "gui-pick") setOn(!!e.data.on);
  });
})();
`;

/** True for files that exist only to power the preview, never the project. */
export function isInternal(path: string) {
  return path === INSPECTOR_PATH;
}

/** Sandpack's copy of the project: the files plus the inspector wired into the entry point. */
export function withInspector(files: FileMap, template: "react-ts" | "static" | "vanilla"): FileMap {
  const out: FileMap = { ...files, [INSPECTOR_PATH]: SOURCE };
  if (template === "react-ts") {
    out["/index.tsx"] = files["/index.tsx"] ? IMPORT_LINE + files["/index.tsx"] : REACT_ENTRY;
  } else if (template === "vanilla") {
    const entry = files["/index.js"] !== undefined ? "/index.js" : null;
    if (entry) out[entry] = IMPORT_LINE + files[entry];
  } else {
    for (const [p, code] of Object.entries(files)) {
      if (!p.endsWith(".html")) continue;
      out[p] = code.includes("</body>") ? code.replace("</body>", `  ${SCRIPT_TAG}\n  </body>`) : code + SCRIPT_TAG;
    }
  }
  return out;
}

/** Undoes `withInspector`. Files that only Sandpack added are left for the caller to filter. */
export function withoutInspector(files: FileMap): FileMap {
  const out: FileMap = {};
  for (const [p, code] of Object.entries(files)) {
    if (isInternal(p)) continue;
    out[p] = code
      .replace(IMPORT_LINE, "")
      .replace(`  ${SCRIPT_TAG}\n  </body>`, "</body>")
      .replace(SCRIPT_TAG, "");
  }
  return out;
}
