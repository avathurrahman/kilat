/**
 * In-process SSR renderer. Runs inside the Hono process (no separate
 * SSR server): renders the page component tree to HTML with svelte/server.
 *
 * This file is pre-built to dist/ssr.js by buildClientAssets() because
 * @inertiajs/svelte only exports under the `svelte` condition, which
 * Bun.build can resolve via `conditions: ['svelte']` but the Bun runtime
 * cannot. The Svelte compiler (generate: 'server') is applied via the
 * svelte plugin during the build.
 */
import { createInertiaApp } from "@inertiajs/svelte";
import { render } from "svelte/server";
import type { Page } from "@inertiajs/core";
import { notFoundPage, pages } from "./pages";

// Lazy-init: top-level await in a pre-built ESM bundle can fail to resolve
// in some runtimes (e.g. bun test). Initialize on first renderPage call instead.
let renderFn: ((page: Page, render: typeof render) => Promise<{
	body: string;
	head: string[];
}>) | null = null;

async function ensureRenderFn() {
	if (!renderFn) {
		renderFn = await createInertiaApp({
			resolve: (name: string) =>
				pages[`./pages/${name}.svelte`] ?? notFoundPage,
		});
	}
	return renderFn;
}

export async function renderPage(page: Page) {
	const fn = await ensureRenderFn();
	if (typeof fn !== "function") {
		throw new Error("SSR render function not initialized");
	}
	return fn(page as unknown as Parameters<typeof fn>[0], render);
}
