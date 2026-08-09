# Kilat site

The Kilat landing page + documentation, built with **Astro + Starlight**
(fully static — no server adapter).

## Develop

```bash
cd site
npm install
npm run dev        # http://localhost:4321
```

## Build

```bash
npm run build      # static output → site/dist
```

## Deploy (Cloudflare Pages)

- **Dashboard**: root directory `site`, build `npm run build`, output `dist`.
- **CLI**: `npx wrangler pages deploy dist --project-name kilat-site`
  (`site/wrangler.toml` pins the config).

Set the production domain in `astro.config.mjs` (`site`) before going live.

## Content

- Landing page: `src/pages/index.astro` (custom landing with
  sections via `src/components/*.astro`).
- Docs: `src/content/docs/**/*.mdx` — sidebar configured in
  `astro.config.mjs`.
- Theme overrides: `src/styles/custom.css`.

Keep docs in sync with code changes in the same PR.
