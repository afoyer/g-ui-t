import type { FileMap } from "@/lib/types";
import { getRule } from "./css";

/** An element picked in the preview, as the inspector reports it. */
export type Selection = {
  tag: string;
  text: string;
  classes: string[];
  /** The React component that rendered it, when the preview can tell. */
  component?: string;
};

/** "Button · “Plan a trip”" */
export function describeSelection(s: Selection) {
  const name = s.component && s.component !== "App" ? s.component : friendlyTag(s.tag);
  const text = s.text.trim();
  return text ? `${name} · “${text.length > 28 ? text.slice(0, 27) + "…" : text}”` : name;
}

const TAG_NAMES: Record<string, string> = {
  h1: "Heading",
  h2: "Heading",
  h3: "Heading",
  p: "Paragraph",
  a: "Link",
  button: "Button",
  img: "Image",
  nav: "Navigation",
  header: "Header",
  section: "Section",
  article: "Card",
  main: "Page",
};

export function friendlyTag(tag: string) {
  return TAG_NAMES[tag.toLowerCase()] ?? tag.toLowerCase();
}

/** The project's main stylesheet path. */
export function stylesheet(files: FileMap): string | undefined {
  if ("/styles.css" in files) return "/styles.css";
  return Object.keys(files).find((p) => p.endsWith(".css"));
}

/**
 * The CSS selector that styles a picked element: the first of its classes with
 * a rule, else its tag if that has a rule, else its first class (a new rule).
 */
export function selectorFor(s: Selection, css: string): string {
  for (const c of s.classes) if (getRule(css, `.${c}`)) return `.${c}`;
  const tag = s.tag.toLowerCase();
  if (getRule(css, tag)) return tag;
  return s.classes[0] ? `.${s.classes[0]}` : tag;
}

/** Source files (not stylesheets), in a stable order with the entry first. */
export function sourceFiles(files: FileMap): string[] {
  return Object.keys(files)
    .filter((p) => /\.(tsx|jsx|ts|js|html)$/.test(p) && !p.includes("__gui"))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function rank(p: string) {
  if (/^\/(App\.tsx|index\.html|index\.js)$/.test(p)) return 0;
  if (p.startsWith("/components/")) return 2;
  return 1;
}
