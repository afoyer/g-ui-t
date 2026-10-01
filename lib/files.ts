import type { FileMap } from "./types";

const TEXT_EXTENSIONS = ["ts", "tsx", "js", "jsx", "css", "html", "json", "md", "svg", "txt"];

export function isEditable(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.includes(ext);
}

/** "/App.tsx" → "App.tsx" (git paths have no leading slash). */
export function toRepoPath(sandpackPath: string) {
  return sandpackPath.replace(/^\/+/, "");
}

/** "App.tsx" → "/App.tsx" */
export function toSandpackPath(repoPath: string) {
  return "/" + toRepoPath(repoPath);
}

/** Files in `next` that are new or differ from `prev`. */
export function diffFiles(prev: FileMap, next: FileMap): FileMap {
  const out: FileMap = {};
  for (const [path, code] of Object.entries(next)) {
    if (prev[path] !== code) out[path] = code;
  }
  return out;
}

/**
 * The design-facing name for a file: components/CartSummary.tsx → "CartSummary",
 * about.html → "about page", styles.css → "styles.css".
 */
export function componentName(path: string) {
  const clean = toRepoPath(path);
  const base = clean.split("/").pop() ?? clean;
  const stem = base.replace(/\.[^.]+$/, "");
  if (/(^|\/)components\//.test(clean)) return stem;
  if (base.endsWith(".html")) return `${stem} page`;
  if (/^App\.(t|j)sx?$/.test(base)) return "App";
  return base;
}

export function componentNames(paths: string[]) {
  return [...new Set(paths.map(componentName))];
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
