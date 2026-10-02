// Builds DAYZERO's demo mode into one self-contained HTML file (preview/dist/dayzero.html)
// for hosting without a server. Next.js routing/links/dynamic are swapped for small shims
// and the AI routes run in-browser via src/lib/local-api.ts.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dist = path.join(here, "dist");
mkdirSync(dist, { recursive: true });

execSync(`npx tailwindcss -c tailwind.config.ts -i src/app/globals.css -o ${path.join(dist, "app.css")} --minify`, { cwd: root, stdio: "inherit" });

const shim = (f) => path.join(here, "shims", f);
const result = await build({
  entryPoints: [path.join(here, "entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  logLevel: "warning",
  tsconfig: path.join(root, "tsconfig.json"),
  alias: {
    "next/link": shim("link.tsx"),
    "next/navigation": shim("navigation.ts"),
    "next/dynamic": shim("dynamic.tsx"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_STATIC_PREVIEW": '"1"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
    "process.env.NEXT_PUBLIC_SITE_URL": '""',
  },
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(path.join(dist, "app.css"), "utf8");
const html = `<title>DAYZERO</title>
<meta name="description" content="Everything, organized.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">
<style>:root{--font-geist-sans:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--font-geist-mono:"Geist Mono",ui-monospace,monospace}html,body{background:rgb(var(--bg));min-height:100%}${css}</style>
<div id="dayzero-root"></div>
<script>${js}</script>
`;
writeFileSync(path.join(dist, "dayzero.html"), html);
console.log(`preview/dist/dayzero.html  ${(html.length / 1024).toFixed(0)} KB`);
