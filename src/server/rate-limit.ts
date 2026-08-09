/**
 * Rate limiter — no-op stub for the Cloudflare Workers experiment.
 *
 * The in-memory Map limiter from the Bun version doesn't work on Workers
 * (stateless, per-isolate). Rate limiting will be handled by Cloudflare's
 * built-in DDoS protection + a KV/Durable Objects layer in production.
 * For the experiment phase, this passes all requests through.
 */
import type { Context, Next } from "hono";
import type { AppEnv } from "./inertia-middleware";

export interface RateLimitOptions {
  max: number;
  windowSeconds: number;
}

export function rateLimit(_opts: RateLimitOptions) {
  return async (_c: Context<AppEnv>, next: Next) => next();
}
