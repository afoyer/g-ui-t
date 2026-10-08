import type { FileMap } from "@/lib/types";
import { componentName } from "@/lib/files";
import { getCssVar, getRule, px, setCssVar, upsertRule } from "./css";
import { describeSelection, selectorFor, sourceFiles, stylesheet, type Selection } from "./selection";

/**
 * A scripted stand-in for Claude. Each intent recognises a kind of request and
 * makes a real, small edit to the project files. Nothing here calls a model.
 */

export type Step =
  | { kind: "read"; path: string }
  | { kind: "edit"; path: string; added: string[]; removed: string[] };

export type AssistantResult =
  | { ok: true; edits: FileMap; steps: Step[]; reply: string; summary: string }
  | { ok: false; reply: string; suggestions: string[] };

export type Context = { files: FileMap; selection: Selection | null };

type Intent = {
  id: string;
  match: (prompt: string, ctx: Context) => boolean;
  run: (prompt: string, ctx: Context) => AssistantResult;
};

// ---- Vocabulary -------------------------------------------------------------

const COLORS: Record<string, string> = {
  red: "#d64545",
  orange: "#e8833a",
  yellow: "#e3b341",
  green: "#2f9e61",
  teal: "#1f9d94",
  blue: "#2f6fdf",
  indigo: "#4f46e5",
  purple: "#7c4ddb",
  violet: "#7c4ddb",
  pink: "#d6458f",
  black: "#1b1c1e",
  gray: "#6b6d72",
  grey: "#6b6d72",
  brown: "#8a5a3b",
  white: "#ffffff",
};

const FONTS: Record<string, string> = {
  serif: `Georgia, "Times New Roman", serif`,
  sans: `system-ui, -apple-system, sans-serif`,
  rounded: `ui-rounded, "SF Pro Rounded", system-ui, sans-serif`,
  mono: `ui-monospace, Menlo, monospace`,
};

function findColor(prompt: string): { name: string; value: string } | null {
  const hex = prompt.match(/#(?:[0-9a-f]{3}){1,2}\b/i);
  if (hex) return { name: hex[0], value: hex[0] };
  for (const [name, value] of Object.entries(COLORS)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(prompt)) return { name, value };
  }
  return null;
}

function quoted(prompt: string): string | null {
  const m = prompt.match(/["“'‘](.+?)["”'’](?:\s*$|[\s.!?])/);
  return m ? m[1] : null;
}

/** The thing the request is about, when it names one instead of a selection. */
function named(prompt: string): "button" | "title" | "card" | "text" | null {
  if (/\bbuttons?\b|\bcta\b/i.test(prompt)) return "button";
  if (/\b(title|heading|headline|header)\b/i.test(prompt)) return "title";
  if (/\bcards?\b/i.test(prompt)) return "card";
  if (/\b(text|paragraph|copy|body)\b/i.test(prompt)) return "text";
  return null;
}

// ---- Helpers ----------------------------------------------------------------

function lines(s: string) {
  return s.split("\n");
}

/** Lines only in `before` and lines only in `after` (multiset difference). */
export function lineDiff(before: string, after: string) {
  const count = new Map<string, number>();
  for (const l of lines(before)) count.set(l, (count.get(l) ?? 0) + 1);
  const added: string[] = [];
  for (const l of lines(after)) {
    const n = count.get(l) ?? 0;
    if (n > 0) count.set(l, n - 1);
    else added.push(l);
  }
  const left = new Map<string, number>();
  for (const l of lines(after)) left.set(l, (left.get(l) ?? 0) + 1);
  const removed: string[] = [];
  for (const l of lines(before)) {
    const n = left.get(l) ?? 0;
    if (n > 0) left.set(l, n - 1);
    else removed.push(l);
  }
  return { added, removed };
}

/** Builds a result from before/after file maps, with a read step for each file looked at. */
function done(ctx: Context, next: FileMap, reply: string, summary: string, read: string[] = []): AssistantResult {
  const edits: FileMap = {};
  const steps: Step[] = [];
  const touched = Object.keys(next).filter((p) => next[p] !== ctx.files[p]);
  for (const p of [...new Set([...read, ...touched])]) steps.push({ kind: "read", path: p });
  for (const p of touched) {
    edits[p] = next[p];
    steps.push({ kind: "edit", path: p, ...lineDiff(ctx.files[p] ?? "", next[p]) });
  }
  if (!touched.length) return nope("That's already how it looks, so I left it alone.", ctx);
  return { ok: true, edits, steps, reply, summary };
}

function nope(reply: string, ctx: Context): AssistantResult {
  return { ok: false, reply, suggestions: suggestionsFor(ctx) };
}

function noStylesheet(ctx: Context) {
  return nope("I couldn't find a stylesheet in this project to change.", ctx);
}

/** Selector for whatever the request points at: the selection, a named thing, or `fallback`. */
function target(prompt: string, ctx: Context, css: string, fallback: string): { selector: string; label: string } {
  if (ctx.selection) return { selector: selectorFor(ctx.selection, css), label: describeSelection(ctx.selection) };
  const n = named(prompt);
  if (n === "button") return { selector: getRule(css, ".button") ? ".button" : "button", label: "the button" };
  if (n === "title") return { selector: "h1", label: "the title" };
  if (n === "card") return { selector: ".card", label: "the cards" };
  if (n === "text") return { selector: getRule(css, ".lede") ? ".lede" : "p", label: "the text" };
  return { selector: fallback, label: "the page" };
}

const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "p", "a", "span", "li", "label", "strong", "em"]);

function scaleLengths(value: string, k: number) {
  return value.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${Math.max(0, Math.round(Number(n) * k))}px`);
}

/** Replaces the first exact occurrence of `from` in the project's source files. */
function replaceText(files: FileMap, from: string, to: string): { path: string; files: FileMap } | null {
  for (const p of sourceFiles(files)) {
    const code = files[p];
    const i = code.indexOf(from);
    if (i >= 0) return { path: p, files: { ...files, [p]: code.slice(0, i) + to + code.slice(i + from.length) } };
  }
  return null;
}

/** The text inside the first matching element across the source files. */
function firstElementText(files: FileMap, tags: string[]): string | null {
  const re = new RegExp(`<(${tags.join("|")})(?:\\s[^>]*)?>([^<{]+)</\\1>`);
  for (const p of sourceFiles(files)) {
    const m = files[p].match(re);
    if (m && m[2].trim()) return m[2].trim();
  }
  return null;
}

function safeText(s: string) {
  return s.replace(/[{}<>]/g, "").trim();
}

// ---- Intents ----------------------------------------------------------------

const darkMode: Intent = {
  id: "dark",
  match: (p) => /\bdark\b|\bnight mode\b/i.test(p),
  run(_, ctx) {
    const path = stylesheet(ctx.files);
    if (!path) return noStylesheet(ctx);
    let css = ctx.files[path];
    if (getCssVar(css, "--surface")) {
      css = setCssVar(css, "--ink", "#f2f1ee");
      css = setCssVar(css, "--muted", "#a2a4a9");
      css = setCssVar(css, "--surface", "#141518");
      if (getRule(css, ".card")) css = upsertRule(css, ".card", { background: "#1f2024" });
    } else {
      css = upsertRule(css, "body", { background: "#141518", color: "#f2f1ee" });
      if (getRule(css, "p")) css = upsertRule(css, "p", { color: "#a2a4a9" });
    }
    return done(
      ctx,
      { ...ctx.files, [path]: css },
      "Switched the page to a dark palette: a near-black background with soft white text. Undo brings the light version back.",
      "Tried dark mode",
    );
  },
};

const removeElement: Intent = {
  id: "remove",
  match: (p, ctx) => /\b(remove|delete|get rid of|drop)\b/i.test(p) && (!!ctx.selection || named(p) === "button"),
  run(prompt, ctx) {
    const text = ctx.selection?.text.trim() || (named(prompt) === "button" ? firstElementText(ctx.files, ["Button", "button"]) : null);
    if (!text) return nope("Select the element you want gone in the preview, then ask again.", ctx);
    for (const p of sourceFiles(ctx.files)) {
      const ls = lines(ctx.files[p]);
      const i = ls.findIndex((l) => l.includes(text) && /^\s*<.*(\/>|<\/\w+>)\s*$/.test(l));
      if (i < 0) continue;
      const next = [...ls.slice(0, i), ...ls.slice(i + 1)].join("\n");
      const label = ctx.selection ? describeSelection(ctx.selection) : `the “${text}” button`;
      return done(ctx, { ...ctx.files, [p]: next }, `Removed ${label} from ${componentName(p)}.`, `Removed ${label}`);
    }
    return nope("I couldn't remove that one cleanly. It's probably built from several pieces. Try selecting its outer box.", ctx);
  },
};

const addCard: Intent = {
  id: "add-card",
  match: (p, ctx) => /\badd\b/i.test(p) && /\b(card|trip|place|destination)\b/i.test(p) && hasCards(ctx.files),
  run(prompt, ctx) {
    const name = safeText(quoted(prompt) ?? prompt.match(/\b(?:for|called|named)\s+([^,.!?]+)/i)?.[1] ?? "New place");
    const title = name.replace(/\b\w/g, (c) => c.toUpperCase());
    for (const p of sourceFiles(ctx.files)) {
      const ls = lines(ctx.files[p]);
      const last = ls.findLastIndex((l) => /^\s*<Card\b.*\/>\s*$/.test(l));
      if (last < 0) continue;
      const indent = ls[last].match(/^\s*/)?.[0] ?? "";
      const line = `${indent}<Card title="${title.replace(/"/g, "")}" detail="2 nights · Jan 4" />`;
      const next = [...ls.slice(0, last + 1), line, ...ls.slice(last + 1)].join("\n");
      return done(
        ctx,
        { ...ctx.files, [p]: next },
        `Added a “${title}” card at the end of the row. It uses placeholder dates, so ask me to change them or select the card and edit its text.`,
        `Added a card for ${title}`,
        ["/components/Card.tsx"].filter((c) => c in ctx.files),
      );
    }
    return nope("I couldn't find a row of cards to add to.", ctx);
  },
};

function hasCards(files: FileMap) {
  return sourceFiles(files).some((p) => /<Card\b/.test(files[p]));
}

const recolor: Intent = {
  id: "recolor",
  match: (p) => !!findColor(p) && !/\b(text|title|heading)\s+(to|say|read)s?\b/i.test(p),
  run(prompt, ctx) {
    const color = findColor(prompt)!;
    const path = stylesheet(ctx.files);
    if (!path) return noStylesheet(ctx);
    let css = ctx.files[path];
    const wantsText = /\b(text|font|words?|letters?)\b/i.test(prompt);
    const wantsBg = /\b(background|bg|fill)\b/i.test(prompt);

    // No target: change the brand colour everywhere it's used.
    if (!ctx.selection && !named(prompt) && !wantsBg) {
      if (getCssVar(css, "--accent")) {
        css = setCssVar(css, "--accent", color.value);
        return done(
          ctx,
          { ...ctx.files, [path]: css },
          `Changed the accent colour to ${color.name}. It's shared, so the button and the small label above the title both picked it up.`,
          `Made the accent ${color.name}`,
        );
      }
      css = upsertRule(css, "h1", { color: color.value });
      return done(ctx, { ...ctx.files, [path]: css }, `Made the headings ${color.name}.`, `Made the headings ${color.name}`);
    }

    if (wantsBg && !ctx.selection && !named(prompt)) {
      css = getCssVar(css, "--surface") ? setCssVar(css, "--surface", color.value) : upsertRule(css, "body", { background: color.value });
      return done(ctx, { ...ctx.files, [path]: css }, `Changed the page background to ${color.name}.`, `Made the background ${color.name}`);
    }

    const t = target(prompt, ctx, css, "body");
    const tag = ctx.selection?.tag.toLowerCase() ?? (named(prompt) === "title" || named(prompt) === "text" ? "p" : "div");
    const prop = wantsText || (!wantsBg && TEXT_TAGS.has(tag)) ? "color" : "background";
    css = upsertRule(css, t.selector, { [prop]: color.value });
    const what = prop === "color" ? "text" : "colour";
    return done(
      ctx,
      { ...ctx.files, [path]: css },
      `Made ${t.label}'s ${what} ${color.name}. Anything else that shares its style changed too.`,
      `Made ${t.label} ${color.name}`,
    );
  },
};

const font: Intent = {
  id: "font",
  match: (p) => /\b(serif|sans|rounded|mono|monospace|typeface|font)\b/i.test(p) && !/\b(bigger|smaller|larger)\b/i.test(p),
  run(prompt, ctx) {
    const path = stylesheet(ctx.files);
    if (!path) return noStylesheet(ctx);
    const kind = /sans/i.test(prompt)
      ? "sans"
      : /serif/i.test(prompt)
        ? "serif"
        : /rounded/i.test(prompt)
          ? "rounded"
          : /mono/i.test(prompt)
            ? "mono"
            : null;
    if (!kind) return nope("Which kind of font? I can do serif, sans-serif, rounded or monospace.", ctx);
    let css = ctx.files[path];
    const where = getRule(css, ":root")?.["font-family"] ? ":root" : "body";
    css = upsertRule(css, where, { "font-family": FONTS[kind] });
    const label = kind === "sans" ? "sans-serif" : kind === "mono" ? "monospace" : kind;
    return done(ctx, { ...ctx.files, [path]: css }, `Switched the whole page to a ${label} font.`, `Switched to a ${label} font`);
  },
};

const changeText: Intent = {
  id: "text",
  match: (p, ctx) => {
    // "change the button colour to red" is a recolor.
    if (!quoted(p) && (/\bcolou?r\b/i.test(p) || findColor(p.match(/\bto\s+(\S+)\s*[.!]?$/i)?.[1] ?? ""))) return false;
    return (
      /\b(say|says|read|reads|rename|retitle|reword)\b/i.test(p) ||
      (/\b(change|set|update|make)\b/i.test(p) && /\bto\b/i.test(p) && (!!ctx.selection || !!named(p) || !!quoted(p)))
    );
  },
  run(prompt, ctx) {
    const raw = quoted(prompt) ?? prompt.match(/\b(?:to|say|says|read|reads)\s*:?\s+(.+?)\s*[.!]?$/i)?.[1];
    const to = raw ? safeText(raw) : "";
    if (!to) return nope("What should it say? Try: change the title to “Where to next?”", ctx);

    const n = named(prompt);
    const from =
      ctx.selection?.text.trim() ||
      (n === "button"
        ? firstElementText(ctx.files, ["Button", "button"])
        : n === "text"
          ? firstElementText(ctx.files, ["p"])
          : firstElementText(ctx.files, ["h1"]));
    if (!from) return nope("Select the text you want to change in the preview, then tell me what it should say.", ctx);

    const hit = replaceText(ctx.files, from, to);
    if (!hit) return nope("I found that text on screen but not in the files. It might be generated. Try selecting a different element.", ctx);
    return done(ctx, hit.files, `Changed “${from}” to “${to}” in ${componentName(hit.path)}.`, `Changed “${from}” to “${to}”`);
  },
};

const spacing: Intent = {
  id: "spacing",
  match: (p) => /\b(space|spacing|spacious|breathing|roomy|airy|airier|tighter|tight|compact|denser|cramped|padding|gap)\b/i.test(p),
  run(prompt, ctx) {
    const path = stylesheet(ctx.files);
    if (!path) return noStylesheet(ctx);
    const less = /\b(tighter|tight|compact|denser|less|smaller|reduce)\b/i.test(prompt);
    const k = less ? 0.7 : 1.4;
    let css = ctx.files[path];
    let changed = false;
    const pairs: [string, string][] = [
      [".page", "padding"],
      ["main", "margin"],
      [".grid", "gap"],
      ["nav", "padding"],
    ];
    for (const [sel, prop] of pairs) {
      const v = getRule(css, sel)?.[prop];
      if (!v) continue;
      css = upsertRule(css, sel, { [prop]: scaleLengths(v, k) });
      changed = true;
    }
    if (!changed) css = upsertRule(css, "body", { padding: less ? "16px" : "48px" });
    return done(
      ctx,
      { ...ctx.files, [path]: css },
      less ? "Tightened the spacing around the page and between items." : "Opened up the spacing around the page and between items.",
      less ? "Tightened the spacing" : "Added more breathing room",
    );
  },
};

const size: Intent = {
  id: "size",
  match: (p) => /\b(bigger|larger|smaller|tinier|huge|rounder|round|rounded corners|pill|square|sharper|sharp corners)\b/i.test(p),
  run(prompt, ctx) {
    const path = stylesheet(ctx.files);
    if (!path) return noStylesheet(ctx);
    let css = ctx.files[path];
    const t = target(prompt, ctx, css, "h1");
    const rule = getRule(css, t.selector) ?? {};
    const decls: Record<string, string> = {};
    let what = "";

    if (/\b(rounder|round|rounded corners|pill)\b/i.test(prompt)) {
      decls["border-radius"] = /pill/i.test(prompt) ? "999px" : `${px(rule["border-radius"], 4) * 2 + 4}px`;
      what = /pill/i.test(prompt) ? "pill-shaped" : "rounder";
    } else if (/\b(square|sharper|sharp corners)\b/i.test(prompt)) {
      decls["border-radius"] = "2px";
      what = "squarer";
    } else {
      const up = !/\b(smaller|tinier)\b/i.test(prompt);
      const k = up ? 1.25 : 0.8;
      decls["font-size"] = `${Math.round(px(rule["font-size"], t.selector === "h1" ? 40 : 16) * k)}px`;
      if (rule.padding) decls.padding = scaleLengths(rule.padding, k);
      what = up ? "bigger" : "smaller";
    }
    css = upsertRule(css, t.selector, decls);
    return done(ctx, { ...ctx.files, [path]: css }, `Made ${t.label} ${what}.`, `Made ${t.label} ${what}`);
  },
};

const INTENTS: Intent[] = [darkMode, removeElement, addCard, font, changeText, recolor, spacing, size];

/** Runs the first intent that recognises the request. Quoted text always means "change the words". */
export function runAssistant(prompt: string, ctx: Context): AssistantResult {
  const text = prompt.trim();
  if (!text) return nope("Tell me what you'd like to change.", ctx);
  const order = quoted(text) && !/\badd\b/i.test(text) ? [changeText, ...INTENTS] : INTENTS;
  const intent = order.find((i) => i.match(text, ctx));
  if (!intent) {
    return nope(
      "I can't do that in this demo yet. I'm good at colours, wording, sizes, spacing, fonts and dark mode. Click an element in the preview first to point me at it.",
      ctx,
    );
  }
  return intent.run(text, ctx);
}

/** Starter prompts that work for this project, or for the picked element. */
export function suggestionsFor(ctx: Context): string[] {
  if (ctx.selection) {
    const tag = ctx.selection.tag.toLowerCase();
    return [
      TEXT_TAGS.has(tag) || tag === "button" ? "Change the text to “…”" : "Make it rounder",
      "Make it bigger",
      "Make it green",
      "Remove it",
    ];
  }
  if (hasCards(ctx.files)) {
    return ["Make the button green", "Change the title to “Where to next?”", "Add a card for Paris", "Try dark mode"];
  }
  return ["Make the headings blue", "Use a sans-serif font", "Give it more breathing room", "Try dark mode"];
}
