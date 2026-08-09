/**
 * Client asset pipeline for Cloudflare Workers.
 *
 * Replaces Bun.build: client assets are built by esbuild (see
 * scripts/build.ts) into dist/assets/* with content-hashed names, and a
 * dist/manifest.json with { version, js, css }. The asset version doubles
 * as the Inertia version for cache busting.
 *
 * Serving: Workers Static Assets binding (env.ASSETS) serves /assets/*
 * directly — configured in wrangler.toml with `run_worker_first = ["/*",
 * "!/assets/*"]` so asset requests never enter the Worker.
 */
import type { InertiaAssets } from "./inertia";

export type { InertiaAssets };
