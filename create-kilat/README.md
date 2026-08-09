# create-kilat

Scaffold a new [Kilat](https://github.com/maulanashalihin/kilat) project —
Cloudflare Workers + Hono + D1 + Inertia v3 boilerplate with auth, roles,
SSR, migrations, and PBKDF2 password hashing. Edge-native, zero-ops.

## Usage

```sh
bun create kilat@latest my-app
```

Or in the current directory:

```sh
bunx create-kilat@latest .
```

The interactive prompt uses **arrow-key navigation** (↑/↓ to select, Enter to confirm) — just like `npm create vite`:

1. **Select a JavaScript framework** — React 19, Svelte 5, or Vue 3
2. **Select a styling approach** — Vanilla CSS or Tailwind CSS v4

## Templates

| Template          | Stack                              | Branch                    |
| ----------------- | ---------------------------------- | ------------------------- |
| `default`         | React 19 + vanilla CSS             | `main`                    |
| `svelte-vanilla`  | Svelte 5 + scoped `<style>` CSS    | `template/svelte-vanilla` |
| `vue-vanilla`     | Vue 3 + scoped `<style>` CSS       | `template/vue-vanilla`    |
| `react-tailwind`  | React 19 + Tailwind CSS v4         | `template/react-tailwind` |
| `svelte-tailwind` | Svelte 5 + Tailwind CSS v4         | `template/svelte-tailwind`|
| `vue-tailwind`    | Vue 3 + Tailwind CSS v4            | `template/vue-tailwind`   |

Select interactively or via `--template`:

```sh
bun create kilat@latest my-app --template svelte-vanilla
```

## Options

| Flag             | Description                                      |
| ---------------- | ------------------------------------------------ |
| `--help`, `-h`   | Show help                                        |
| `--no-install`   | Skip running `bun install`                       |
| `--template <n>` | Use template directly (skip both prompts)        |

## What it does

1. Prompts for a project name (if not provided).
2. Prompts for a framework (React, Svelte, Vue) — arrow-key selection.
3. Prompts for styling (vanilla CSS, Tailwind) — arrow-key selection.
4. Downloads the selected template branch from GitHub.
5. Strips dev-only files (screenshots, `.env`, etc.).
6. Patches `wrangler.toml`: renames the Worker, resets the D1 `database_id`
   and `APP_URL` so the user configures their own.
7. Renames `package.json` to the project name.
8. Runs `bun install` (unless `--no-install`).

## Next steps after scaffold

```sh
cd my-app
bun run db:migrate    # create local D1 schema
bun run build         # build client assets + SSR bundle
bun dev               # start wrangler dev server (http://localhost:8787)
```

For production deployment, create a D1 database and update `wrangler.toml`:

```sh
wrangler d1 create my-app       # paste the database_id into wrangler.toml
wrangler d1 migrations apply my-app --remote
bun run build
wrangler deploy
```

## License

MIT
