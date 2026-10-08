/**
 * Tiny, forgiving CSS edits for the assistant. They work on flat stylesheets
 * like the templates' (one rule per selector, no nesting); anything they can't
 * find gets appended rather than guessed at.
 */

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ruleRegex(selector: string) {
  // Selector at the start of a line (or file), then its block.
  return new RegExp(`(^|\\n)(${escape(selector)})\\s*\\{([^}]*)\\}`);
}

/** The declarations of `selector`, or null when there's no such rule. */
export function getRule(css: string, selector: string): Record<string, string> | null {
  const m = css.match(ruleRegex(selector));
  if (!m) return null;
  return parseDecls(m[3]);
}

function parseDecls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const prop = part.slice(0, i).trim();
    if (prop) out[prop] = part.slice(i + 1).trim();
  }
  return out;
}

function formatDecls(decls: Record<string, string>, multiline: boolean) {
  const entries = Object.entries(decls);
  if (multiline) return `{\n${entries.map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}`;
  return `{ ${entries.map(([p, v]) => `${p}: ${v};`).join(" ")} }`;
}

/** Sets (or adds) declarations on `selector`, keeping the rule's one-line or multi-line style. */
export function upsertRule(css: string, selector: string, decls: Record<string, string>): string {
  const re = ruleRegex(selector);
  const m = css.match(re);
  if (!m) {
    const sep = css.endsWith("\n") || css === "" ? "" : "\n";
    return `${css}${sep}${selector} ${formatDecls(decls, false)}\n`;
  }
  const merged = { ...parseDecls(m[3]), ...decls };
  const multiline = m[3].includes("\n");
  return css.replace(re, `${m[1]}${m[2]} ${formatDecls(merged, multiline)}`);
}

/** Removes declarations from `selector`, if present. */
export function removeDecls(css: string, selector: string, props: string[]): string {
  const re = ruleRegex(selector);
  const m = css.match(re);
  if (!m) return css;
  const decls = parseDecls(m[3]);
  for (const p of props) delete decls[p];
  return css.replace(re, `${m[1]}${m[2]} ${formatDecls(decls, m[3].includes("\n"))}`);
}

/** Sets a custom property on :root, creating the rule when needed. */
export function setCssVar(css: string, name: string, value: string): string {
  return upsertRule(css, ":root", { [name.startsWith("--") ? name : `--${name}`]: value });
}

export function getCssVar(css: string, name: string): string | undefined {
  return getRule(css, ":root")?.[name.startsWith("--") ? name : `--${name}`];
}

/** "18px" → 18. Takes the first length in a shorthand like "10px 18px". */
export function px(value: string | undefined, fallback: number): number {
  const m = value?.match(/(-?\d+(?:\.\d+)?)px/);
  return m ? Number(m[1]) : fallback;
}
