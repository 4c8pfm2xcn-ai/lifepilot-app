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

writeFileSync(path.join(dist, "app.js"), result.outputFiles[0].text);
const html = `<title>DAYZERO</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">
<style>
:root{color-scheme:dark;--font-geist-sans:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--font-geist-mono:"Geist Mono",ui-monospace,monospace}
html,body{background:#0B0D0C;color:#F4F6F3;min-height:100%;margin:0}
#dz-boot{min-height:80vh;display:grid;place-items:center;font:500 14px/1.5 var(--font-geist-sans);color:#9BA49D;padding-inline:16px;text-align:center}
#dz-boot b{display:block;color:#F4F6F3;font-size:18px;letter-spacing:.08em;margin-bottom:6px}
#dz-boot .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#B7F36B;margin-right:8px;animation:p 1.2s ease-in-out infinite}
@keyframes p{50%{opacity:.3}}
</style>
<link rel="stylesheet" href="app.css">
<div id="dayzero-root"><div id="dz-boot"><div><b>DAYZERO</b><span class="dot"></span><span id="dz-boot-msg">Loading the app…</span></div></div></div>
<script>
window.addEventListener("error", function (e) {
  var m = document.getElementById("dz-boot-msg");
  if (m) m.textContent = "The app couldn't start: " + (e.message || "script failed to load") + ". Try reopening the page.";
}, true);
setTimeout(function () {
  var m = document.getElementById("dz-boot-msg");
  if (m) m.textContent = "Still loading… if this doesn't change, reopen the page.";
}, 15000);
</script>
<script src="app.js"></script>
`;
writeFileSync(path.join(dist, "index.html"), html);
console.log(`index.html ${(html.length / 1024).toFixed(1)} KB, app.js ${(result.outputFiles[0].text.length / 1024).toFixed(0)} KB, app.css ${(readFileSync(path.join(dist, "app.css")).length / 1024).toFixed(0)} KB`);
