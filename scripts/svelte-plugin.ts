/**
 * esbuild plugin: compile .svelte components and .svelte.js modules.
 *
 * Svelte 5 runes ($state, $props, $derived, $effect) are compiler macros —
 * not valid JS at runtime. @inertiajs/svelte ships .svelte.js files that
 * contain runes (useForm.svelte.js, page.svelte.js). Without this plugin,
 * esbuild errors: "$state is not defined".
 *
 * Two onLoad handlers:
 *  - .svelte       = components (markup + script + style)
 *  - .svelte.js/ts = JS modules with runes
 *
 * Ported from dulak's Bun.build svelte-plugin.ts to esbuild plugin API.
 * Key difference: esbuild onLoad reads files via fs.readFile, Bun uses Bun.file().
 * CSS handling: client build emits scoped CSS via a re-import; server build
 * discards CSS (not needed for SSR HTML — Inertia ships CSS via the client bundle).
 */
import { compile, compileModule } from "svelte/compiler";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "esbuild";

const CSS_CACHE_DIR = resolve(process.cwd(), ".svelte-css-cache");
mkdirSync(CSS_CACHE_DIR, { recursive: true });

export function sveltePlugin(
  generate: "client" | "server" = "client",
): Plugin {
  return {
    name: `svelte-${generate}`,
    setup(build) {
      // Resolve CSS-cache imports — esbuild needs help with absolute paths
      // from onLoad contents. Map to the real on-disk path.
      build.onResolve(
        { filter: /\.svelte-css-cache\/.*\.svelte\.css$/ },
        (args) => ({ path: args.path }),
      );
      build.onLoad(
        { filter: /\.svelte-css-cache\/.*\.svelte\.css$/ },
        (args) => ({
          contents: readFileSync(args.path, "utf8"),
          loader: "css",
        }),
      );
      // .svelte component files
      build.onLoad({ filter: /\.svelte$/ }, async (args) => {
        const source = readFileSync(args.path, "utf8");
        const name = args.path
          .split("/")
          .pop()!
          .replace(/\.svelte$/, "");
        const result = compile(source, {
          generate,
          name,
          css: "external",
        });
        let code = result.js.code;
        // Client build: emit scoped CSS and re-import so esbuild bundles it.
        if (generate === "client" && result.css?.code) {
          const cssPath = `${CSS_CACHE_DIR}/${name}.svelte.css`;
          writeFileSync(cssPath, result.css.code);
          code += `\nimport ${JSON.stringify(cssPath)};\n`;
        }
        return { contents: code, loader: "js" };
      });

      // .svelte.js / .svelte.ts module files (runes in JS — used by @inertiajs/svelte)
      build.onLoad({ filter: /\.svelte\.[jt]s$/ }, async (args) => {
        const source = readFileSync(args.path, "utf8");
        const result = compileModule(source, {
          generate,
          filename: args.path,
        });
        return { contents: result.js.code, loader: "js" };
      });
    },
  };
}
