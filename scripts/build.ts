/**
 * Client asset build for Cloudflare Workers (Svelte template).
 *
 * Two esbuild passes:
 *   1. Client bundle: Svelte compiled for browser (generate: 'client')
 *      → dist/assets/app-[hash].js + CSS
 *   2. SSR bundle: Svelte compiled for server (generate: 'server')
 *      → dist/ssr.js (plain JS, imported by Worker via inertia.ts)
 *
 * The SSR bundle is pre-built because Wrangler's internal esbuild does not
 * support custom plugins — it cannot compile .svelte files. By outputting
 * a plain JS bundle, Wrangler can bundle it without a Svelte plugin.
 *
 * The asset version (content hash) doubles as the Inertia version for
 * cache-busting (409 on mismatch).
 *
 * Run: bun run scripts/build.ts  (or `bun run build`)
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import esbuild from "esbuild";
import { sveltePlugin } from "./svelte-plugin";

const DIST_DIR = "dist";
const ASSETS_DIR = join(DIST_DIR, "assets");
const MANIFEST_PATH = join(DIST_DIR, "manifest.json");

interface Manifest {
  version: string;
  js: string;
  css: string;
}

async function buildClientAssets(): Promise<void> {
  // Clean dist/ — stale hashed files would accumulate otherwise.
  if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true });
  mkdirSync(ASSETS_DIR, { recursive: true });

  // 1. Client bundle: Svelte compiled for browser.
  const clientResult = await esbuild.build({
    entryPoints: ["src/client/app.ts"],
    outdir: ASSETS_DIR,
    bundle: true,
    minify: true,
    sourcemap: false,
    splitting: false,
    format: "esm",
    target: "es2022",
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [sveltePlugin("client")],
    conditions: ["svelte"],
    loader: { ".css": "css" },
  });

  const jsFile = clientResult.outputFiles.find((f) => f.path.endsWith(".js"));
  if (!jsFile) throw new Error("esbuild produced no JS output for client bundle");

  const cssFile = clientResult.outputFiles.find((f) => f.path.endsWith(".css"));

  // Content-hash the JS for cache busting.
  const jsHash = createHash("sha256")
    .update(jsFile.contents)
    .digest("hex")
    .slice(0, 16);
  const jsName = `app-${jsHash}.js`;
  writeFileSync(join(ASSETS_DIR, jsName), jsFile.contents);

  let cssName = "";
  if (cssFile) {
    const cssHash = createHash("sha256")
      .update(cssFile.contents)
      .digest("hex")
      .slice(0, 16);
    cssName = `app-${cssHash}.css`;
    writeFileSync(join(ASSETS_DIR, cssName), cssFile.contents);
  }

  // 2. SSR bundle: Svelte compiled for server-side rendering.
  // Output as plain JS (dist/ssr.js) so Wrangler can bundle it without
  // needing a Svelte plugin.
  await esbuild.build({
    entryPoints: ["src/client/ssr.ts"],
    outfile: join(DIST_DIR, "ssr.js"),
    bundle: true,
    minify: true,
    sourcemap: false,
    splitting: false,
    format: "esm",
    target: "es2022",
    platform: "neutral",
    write: true,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [sveltePlugin("server")],
    conditions: ["svelte"],
  });

  // The version is the JS hash — Inertia uses it for 409 reload negotiation.
  const manifest: Manifest = {
    version: jsHash,
    js: jsName,
    css: cssName,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Built client assets → dist/ (version ${manifest.version})`);
  console.log(`Built SSR bundle → dist/ssr.js`);
}

await buildClientAssets();
