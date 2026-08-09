/**
 * Request logging + correlation id.
 *
 * Simplified for Workers: no batched writeSync (Workers has no fd 1) and no
 * process.on('exit') (stateless runtime). Each request logs directly to
 * console — Cloudflare's log pipeline handles batching and aggregation.
 *
 * /health and /assets/* produce no log line (infrastructure noise).
 */
import type { Context, Next } from "hono";
import type { AppEnv } from "./inertia-middleware";
import { safeUrl } from "./url";

const SILENT_PATHS: RegExp[] = [/^\/health$/, /^\/assets\//];

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const requestLogger = async (c: Context<AppEnv>, next: Next) => {
  const requestId = randomId();
  const start = performance.now();
  const { pathname } = safeUrl(c.req.url);
  const method = c.req.method;
  c.set("requestId", requestId);

  const result = await next();

  const durationMs = (performance.now() - start).toFixed(1);
  c.res.headers.set("x-request-id", requestId);
  if (!SILENT_PATHS.some((re) => re.test(pathname))) {
    console.log(
      `[req:${requestId}] ${method} ${pathname} -> ${c.res.status} (${durationMs}ms)`,
    );
  }
  return result;
};

export function logError(c: Context<AppEnv>, error: unknown): void {
  const { pathname } = safeUrl(c.req.url);
  const requestId = c.get("requestId") || "-";
  console.error(
    `[req:${requestId}] ${c.req.method} ${pathname} FAILED:`,
    error,
  );
}
