---
type: source
title: "Kilat test harness fixed: D1 mock + Svelte SSR lazy-init"
slug: kilat-test-harness-fixed-d1-mock-svelte-ssr-lazy-init
status: insight
created: 2026-08-10
updated: 2026-08-10
---
# Kilat test harness fixed: D1 mock + Svelte SSR lazy-init
Kilat test harness was broken across all 6 branches (main + 5 templates) — 18/26 tests failed because tests were written for the bun:sqlite era (`process.env.DATABASE_PATH`, `db.close()`, `createUserWithRole.get()`) but the project migrated to D1 bindings (`initDb(env.DB)`, async `prepare/bind/first/all/run`). Fixed by creating `tests/d1-mock.ts` that wraps `bun:sqlite` with a D1-compatible API (see [[concepts/d1-mock-pattern]]).

Also found Svelte SSR bug: top-level `await createInertiaApp()` in pre-built `dist/ssr.js` returns `undefined` in `bun test` — fixed with lazy-init pattern (see [[concepts/svelte-ssr-lazy-init]]).

All 6 branches now pass: 24 pass, 1 skip, 0 fail. Browser testing confirmed: register, login, logout all work with 0 console errors/warnings.

## Key lessons

- When migrating from `bun:sqlite` to D1, test harness must be updated: `initDb()` call, async query patterns, no `db.close()`
- Top-level `await` in pre-built ESM bundles may not resolve correctly in `bun test` — prefer lazy initialization
- `createUserWithRole.get()` was a `bun:sqlite` Prepared object pattern; D1 returns a Promise — must `await`
- Workers Static Assets binding (`env.ASSETS`) cannot be tested via `app.request()` — skip those tests
- Email validation message text must match `VALIDATION_MESSAGES` in `auth.routes.ts`
---
*Captured: 2026-08-10*
## Related
_Add links to related pages._