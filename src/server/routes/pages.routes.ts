/**
 * Page routes: the Inertia app-shell pages (/, /dashboard, /admin).
 * Feature pages get their own `<feature>.routes.ts` — see AGENTS.md
 * "Route conventions".
 *
 * All DB calls are async (D1).
 */
import { Hono } from "hono";
import { requireAuth, requireRole } from "../auth";
import { countUsers, listUsers, recentUsers, toPublicUser } from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { DashboardStats, Paginated, User } from "../../shared/types";

async function dashboardStats(): Promise<DashboardStats> {
  return {
    userCount: (await countUsers())?.n ?? 0,
    recentUsers: (await recentUsers(5)).map(toPublicUser),
  };
}

export const pageRoutes = () => {
  const app = new Hono<AppEnv>();

  app.get("/", (c) =>
    c.var.inertia.redirect(c.var.user ? "/dashboard" : "/login", 302),
  );
  app.get("/dashboard", requireAuth, async (c) =>
    c.var.inertia.render("Dashboard", { stats: await dashboardStats() }),
  );
  app.get("/admin", requireRole("admin"), async (c) => {
    const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(c.req.query("perPage") ?? 10) || 10),
    );
    const total = (await countUsers())?.n ?? 0;
    const users: Paginated<User> = {
      data: (await listUsers(perPage, (page - 1) * perPage)).map(toPublicUser),
      meta: {
        currentPage: page,
        perPage,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
        total,
      },
    };
    return c.var.inertia.render("Admin", { users });
  });

  return app;
};
