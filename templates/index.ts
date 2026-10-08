import type { FileMap, ProjectType } from "@/lib/types";

/**
 * Starter files for each project type, keyed exactly as Sandpack expects.
 * Anything Sandpack's own template provides (index.tsx, package.json, …)
 * is left out so the repo stays small and readable for designers.
 */
export type Template = {
  label: string;
  blurb: string;
  sandpack: "react-ts" | "static" | "vanilla";
  stack: string;
  files: FileMap;
};

const readme = (name: string) => `# ${name}

Made with G-ui-t. Edit in the app, or clone this repo and work locally.
`;

const prototypeFiles: FileMap = {
  "/App.tsx": `import Button from "./components/Button";
import Card from "./components/Card";
import "./styles.css";

export default function App() {
  return (
    <main className="page">
      <header>
        <p className="eyebrow">Prototype</p>
        <h1>Hello, designer</h1>
        <p className="lede">Ask Claude on the left to change anything. Every change is saved.</p>
      </header>
      <section className="grid">
        <Card title="Lisbon" detail="3 nights · Oct 12" />
        <Card title="Kyoto" detail="5 nights · Nov 2" />
        <Card title="Oaxaca" detail="4 nights · Dec 8" />
      </section>
      <Button>Plan a trip</Button>
    </main>
  );
}
`,
  "/components/Button.tsx": `type Props = { children: React.ReactNode; onClick?: () => void };

export default function Button({ children, onClick }: Props) {
  return (
    <button className="button" onClick={onClick}>
      {children}
    </button>
  );
}
`,
  "/components/Card.tsx": `type Props = { title: string; detail: string };

export default function Card({ title, detail }: Props) {
  return (
    <article className="card">
      <div className="card-image" />
      <h3>{title}</h3>
      <p>{detail}</p>
    </article>
  );
}
`,
  "/styles.css": `:root {
  --ink: #1b1c1e;
  --muted: #6b6d72;
  --accent: oklch(0.48 0.13 265);
  --surface: #f6f5f2;
  font-family: system-ui, sans-serif;
  color: var(--ink);
}
body { margin: 0; background: var(--surface); }
.page { max-width: 880px; margin: 0 auto; padding: 48px 24px; }
.eyebrow { font: 600 12px/1 ui-monospace, monospace; color: var(--accent); text-transform: uppercase; letter-spacing: .08em; }
h1 { font-size: 40px; margin: 8px 0; letter-spacing: -0.02em; }
.lede { color: var(--muted); margin: 0 0 32px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.card { background: white; border-radius: 12px; padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.card-image { height: 110px; border-radius: 8px; background: linear-gradient(135deg, #d9d6f5, #f3d9c8); }
.card h3 { margin: 12px 0 4px; font-size: 16px; }
.card p { margin: 0; color: var(--muted); font-size: 14px; }
.button { background: var(--accent); color: white; border: 0; border-radius: 8px; padding: 10px 18px; font-size: 15px; cursor: pointer; }
`,
};

const websiteFiles: FileMap = {
  "/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My site</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <nav><strong>Studio</strong><a href="about.html">About</a></nav>
    <main>
      <h1>We make calm, useful things.</h1>
      <p>A small website, published from G-ui-t.</p>
    </main>
  </body>
</html>
`,
  "/about.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>About</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <nav><a href="index.html"><strong>Studio</strong></a></nav>
    <main>
      <h1>About us</h1>
      <p>Three designers and a lot of tea.</p>
    </main>
  </body>
</html>
`,
  "/styles.css": `body { margin: 0; font-family: Georgia, serif; color: #1b1c1e; background: #fbfaf7; }
nav { display: flex; justify-content: space-between; padding: 20px 32px; font-family: system-ui, sans-serif; }
nav a { color: inherit; }
main { max-width: 640px; margin: 80px auto; padding: 0 24px; }
h1 { font-size: 44px; line-height: 1.1; margin: 0 0 16px; }
p { font-size: 19px; color: #55575c; }
`,
};

const blankFiles: FileMap = {
  "/index.js": `import "./styles.css";

document.getElementById("app").innerHTML = \`
  <h1>Blank project</h1>
  <p>No framework. Start anywhere.</p>
\`;
`,
  "/styles.css": `body { font-family: system-ui, sans-serif; padding: 32px; }
`,
};

export const TEMPLATES: Record<ProjectType, Template> = {
  prototype: {
    label: "Prototype",
    blurb: "Quick to start, made for trying ideas",
    sandpack: "react-ts",
    stack: "React and TypeScript",
    files: prototypeFiles,
  },
  website: {
    label: "Website",
    blurb: "Mostly content, fast to publish",
    sandpack: "static",
    stack: "Plain HTML and CSS",
    files: websiteFiles,
  },
  blank: {
    label: "Blank",
    blurb: "No framework, set it up yourself",
    sandpack: "vanilla",
    stack: "Vanilla JavaScript",
    files: blankFiles,
  },
};

/** Types shown in the picker but not yet supported (Sandpack can't run them). */
export const COMING_SOON = [
  { label: "Web app", blurb: "Multiple pages, routing, data" },
  { label: "Component library", blurb: "Includes Storybook for previews" },
];

export function templateFiles(type: ProjectType, name: string): FileMap {
  return { ...TEMPLATES[type].files, "/README.md": readme(name) };
}
