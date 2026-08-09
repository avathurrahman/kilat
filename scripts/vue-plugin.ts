/**
 * esbuild plugin: compile Vue SFCs (`<script setup lang="ts">`) with
 * @vue/compiler-sfc. Render functions are isomorphic, so one plugin serves
 * both the client (browser) and SSR builds.
 *
 * Assembly: compileScript emits `export default _defineComponent({...})`;
 * the compiled template's `export function render` is attached to that
 * component via a rename + `__sfc__.render = render`. `bindingMetadata` from
 * compileScript makes the template resolve script-setup bindings through
 * `$setup`/`$props`.
 *
 * `<style>` / `<style scoped>` blocks are compiled with compileStyle, written
 * to temp `.css` files, and appended as `import "<path>"` statements. esbuild
 * bundles these imports into the single output stylesheet (scoped selectors
 * carry the `data-v-xxxx` attribute id derived from the filename hash).
 *
 * Ported from dulak's Bun.build vue-plugin.ts to esbuild plugin API.
 * Key difference: esbuild onLoad reads files via fs.readFileSync, Bun uses Bun.file().
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { compileScript, compileStyle, compileTemplate, parse } from "@vue/compiler-sfc";
import type { Plugin } from "esbuild";

const CSS_CACHE_DIR = "/tmp/kilat-vue-css";
mkdirSync(CSS_CACHE_DIR, { recursive: true });

export function vuePlugin({ ssr = false }: { ssr?: boolean } = {}): Plugin {
  return {
    name: "vue-plugin",
    setup(build) {
      // Resolve CSS-cache imports — esbuild needs help with absolute paths.
      build.onResolve(
        { filter: /kilat-vue-css\/.*\.vue\.css$/ },
        (args) => ({ path: args.path }),
      );
      build.onLoad(
        { filter: /kilat-vue-css\/.*\.vue\.css$/ },
        (args) => ({
          contents: readFileSync(args.path, "utf8"),
          loader: "css",
        }),
      );

      build.onLoad({ filter: /\.vue$/ }, async (args) => {
        const filename = args.path;
        const source = readFileSync(filename, "utf8");
        const id = `data-v-${createHash("sha256")
          .update(filename)
          .digest("hex")
          .slice(0, 8)}`;
        const { descriptor, errors } = parse(source, { filename });
        if (errors.length > 0)
          throw new Error(errors.map((e) => e.message).join("\n"));
        if (descriptor.script && !descriptor.scriptSetup) {
          throw new Error(
            `Only <script setup> is supported (${filename})`,
          );
        }

        let code = "";
        if (descriptor.scriptSetup) {
          const script = compileScript(descriptor, { id });
          code += `${script.content}\n`;
          if (descriptor.template) {
            const template = compileTemplate({
              source: descriptor.template.content,
              filename,
              id,
              compilerOptions: {
                bindingMetadata: script.bindings,
              },
            });
            if (template.errors.length > 0)
              throw new Error(
                template.errors.map(String).join("\n"),
              );
            code += `${template.code}\n`;
            // Attach the compiled render to the component.
            code = code.replace(
              /export default (?=\/\*@__PURE__\*\/_defineComponent\()/,
              "const __sfc__ = ",
            );
            code += "__sfc__.render = render;\nexport default __sfc__;\n";
          }
        }

        // Compile each <style> block to a temp .css file and import it so
        // esbuild bundles the styles into the client output stylesheet.
        // Skipped for the SSR build (CSS is in the client bundle, loaded via <link>).
        if (!ssr) {
          for (const style of descriptor.styles) {
            const compiled = compileStyle({
              source: style.content,
              filename,
              id,
              scoped: style.scoped,
            });
            if (compiled.errors.length > 0)
              throw new Error(
                compiled.errors.map((e) => String(e)).join("\n"),
              );
            const base = filename.split("/").pop()!.replace(/\.vue$/, "");
            const cssPath = `${CSS_CACHE_DIR}/${base}.vue.css`;
            writeFileSync(cssPath, compiled.code);
            code += `\nimport "${cssPath}";\n`;
          }
        }

        return { contents: code, loader: "ts" };
      });
    },
  };
}
