import { describe, expect, it } from "vitest";
import { componentName, componentNames, diffFiles, isEditable, toRepoPath, toSandpackPath } from "@/lib/files";
import { TEMPLATES, templateFiles } from "@/templates";

describe("paths", () => {
  it("converts between Sandpack and repo paths", () => {
    expect(toRepoPath("/components/Card.tsx")).toBe("components/Card.tsx");
    expect(toSandpackPath("components/Card.tsx")).toBe("/components/Card.tsx");
    expect(toSandpackPath("/App.tsx")).toBe("/App.tsx");
  });

  it("only treats text files as editable", () => {
    expect(isEditable("App.tsx")).toBe(true);
    expect(isEditable("logo.png")).toBe(false);
  });
});

describe("componentName", () => {
  it("names files the way designers think about them", () => {
    expect(componentName("/components/CartSummary.tsx")).toBe("CartSummary");
    expect(componentName("src/components/ui/Chip.jsx")).toBe("Chip");
    expect(componentName("/about.html")).toBe("about page");
    expect(componentName("/App.tsx")).toBe("Main screen");
    expect(componentName("/styles.css")).toBe("styles.css");
    expect(componentNames(["/components/A.tsx", "components/A.tsx", "/styles.css"])).toEqual(["A", "styles.css"]);
  });
});

describe("diffFiles", () => {
  it("returns only new or edited files", () => {
    expect(diffFiles({ "/a": "1", "/b": "2" }, { "/a": "1", "/b": "3", "/c": "4" })).toEqual({ "/b": "3", "/c": "4" });
  });
});

describe("templates", () => {
  it("every template has Sandpack paths and a README", () => {
    for (const type of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      const files = templateFiles(type, "Fieldnotes");
      expect(Object.keys(files).every((p) => p.startsWith("/"))).toBe(true);
      expect(files["/README.md"]).toContain("# Fieldnotes");
    }
  });
});
