import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getCssVar, getRule, setCssVar, upsertRule } from "@/lib/assistant/css";
import { INSPECTOR_PATH, withInspector, withoutInspector } from "@/lib/assistant/inspector";
import { runAssistant, type AssistantResult } from "@/lib/assistant/intents";
import type { Selection } from "@/lib/assistant/selection";
import { TEMPLATES } from "@/templates";
import type { FileMap } from "@/lib/types";

const proto = TEMPLATES.prototype.files;
const site = TEMPLATES.website.files;

function run(prompt: string, files: FileMap = proto, selection: Selection | null = null) {
  return runAssistant(prompt, { files, selection });
}

function ok(r: AssistantResult) {
  if (!r.ok) throw new Error(`Expected an edit, got: ${r.reply}`);
  return r;
}

/** Applies a result and checks every edited TS/TSX file still parses. */
function apply(files: FileMap, r: AssistantResult): FileMap {
  const next = { ...files, ...ok(r).edits };
  for (const [p, code] of Object.entries(ok(r).edits)) {
    if (!/\.tsx?$/.test(p)) continue;
    const out = ts.transpileModule(code, {
      fileName: p,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
    });
    expect(out.diagnostics ?? [], `${p} should parse`).toEqual([]);
  }
  return next;
}

describe("css helpers", () => {
  it("updates one-line rules in place and appends missing ones", () => {
    const css = ".a { color: red; }\n";
    expect(upsertRule(css, ".a", { color: "blue", margin: "0" })).toBe(".a { color: blue; margin: 0; }\n");
    expect(upsertRule(css, ".b", { color: "blue" })).toBe(".a { color: red; }\n.b { color: blue; }\n");
  });

  it("keeps multi-line rules multi-line", () => {
    const next = setCssVar(":root {\n  --accent: red;\n}\n", "--accent", "blue");
    expect(next).toBe(":root {\n  --accent: blue;\n}\n");
  });

  it("does not confuse `.card` with `.card h3`", () => {
    const css = proto["/styles.css"];
    expect(getRule(css, ".card")?.["border-radius"]).toBe("12px");
    expect(getRule(css, ".card h3")?.margin).toBe("12px 0 4px");
  });
});

describe("assistant intents", () => {
  it("recolors the shared accent when nothing is targeted", () => {
    const r = ok(run("make it green"));
    expect(Object.keys(r.edits)).toEqual(["/styles.css"]);
    expect(getCssVar(r.edits["/styles.css"], "--accent")).toBe("#2f9e61");
    expect(r.summary).toBe("Made the accent green");
  });

  it("recolors a named element's background", () => {
    const r = ok(run("Make the button green"));
    expect(getRule(r.edits["/styles.css"], ".button")?.background).toBe("#2f9e61");
  });

  it("treats 'change the colour to red' as a recolor, not a rename", () => {
    const r = ok(run("change the button color to red"));
    expect(getRule(r.edits["/styles.css"], ".button")?.background).toBe("#d64545");
  });

  it("recolors the text of a selected heading", () => {
    const sel: Selection = { tag: "h1", text: "Hello, designer", classes: [], component: "App" };
    const r = ok(run("make it blue", proto, sel));
    expect(getRule(r.edits["/styles.css"], "h1")?.color).toBe("#2f6fdf");
  });

  it("changes the title text", () => {
    const next = apply(proto, run("Change the title to “Where to next?”"));
    expect(next["/App.tsx"]).toContain("<h1>Where to next?</h1>");
  });

  it("changes the text of a selected element", () => {
    const sel: Selection = { tag: "button", text: "Plan a trip", classes: ["button"], component: "Button" };
    const next = apply(proto, run("make it say Book now", proto, sel));
    expect(next["/App.tsx"]).toContain("<Button>Book now</Button>");
  });

  it("adds a card after the last one", () => {
    const next = apply(proto, run("Add a card for Paris"));
    const ls = next["/App.tsx"].split("\n");
    const i = ls.findIndex((l) => l.includes('title="Paris"'));
    expect(ls[i - 1]).toContain('title="Oaxaca"');
  });

  it("removes a selected card", () => {
    const sel: Selection = { tag: "article", text: "Kyoto", classes: ["card"], component: "Card" };
    const next = apply(proto, run("remove it", proto, sel));
    expect(next["/App.tsx"]).not.toContain("Kyoto");
    expect(next["/App.tsx"]).toContain("Lisbon");
  });

  it("makes the button bigger and pill-shaped", () => {
    const bigger = ok(run("make the button bigger"));
    expect(getRule(bigger.edits["/styles.css"], ".button")?.["font-size"]).toBe("19px");
    const pill = ok(run("make the button a pill"));
    expect(getRule(pill.edits["/styles.css"], ".button")?.["border-radius"]).toBe("999px");
  });

  it("switches fonts and spacing", () => {
    const serif = ok(run("use a serif font"));
    expect(getRule(serif.edits["/styles.css"], ":root")?.["font-family"]).toContain("Georgia");
    const sans = ok(run("Use a sans-serif font", site));
    expect(getRule(sans.edits["/styles.css"], "body")?.["font-family"]).toContain("system-ui");
    const roomy = ok(run("give it more breathing room"));
    expect(getRule(roomy.edits["/styles.css"], ".grid")?.gap).toBe("22px");
  });

  it("does dark mode on both templates", () => {
    expect(getCssVar(ok(run("try dark mode")).edits["/styles.css"], "--surface")).toBe("#141518");
    expect(getRule(ok(run("dark mode please", site)).edits["/styles.css"], "body")?.background).toBe("#141518");
  });

  it("reports what it read and edited", () => {
    const r = ok(run("Add a card for Paris"));
    expect(r.steps).toContainEqual({ kind: "read", path: "/components/Card.tsx" });
    expect(r.steps).toContainEqual(expect.objectContaining({ kind: "edit", path: "/App.tsx", removed: [] }));
  });

  it("falls back politely with suggestions", () => {
    const r = run("connect this to Stripe");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.suggestions.length).toBeGreaterThan(0);
  });
});

describe("inspector", () => {
  it("round-trips the react template without leaving traces", () => {
    const wired = withInspector(proto, "react-ts");
    expect(wired[INSPECTOR_PATH]).toBeTruthy();
    expect(wired["/index.tsx"]).toContain("__gui-inspector");
    const back = withoutInspector(wired);
    expect(back[INSPECTOR_PATH]).toBeUndefined();
    for (const p of Object.keys(proto)) expect(back[p]).toBe(proto[p]);
    expect(back["/index.tsx"]).not.toContain("__gui");
  });

  it("round-trips static HTML", () => {
    const wired = withInspector(site, "static");
    expect(wired["/index.html"]).toContain("__gui-inspector.js");
    expect(withoutInspector(wired)).toEqual(site);
  });
});
