/**
 * Profile routes at /profile — page render, profile info and password changes.
 *
 * Avatar upload linking is retained (findUpload in D1), but the tus byte
 * storage is skipped in the CF experiment (no R2 binding yet).
 *
 * All DB/auth calls are async (D1 + Web Crypto).
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import {
  deleteOtherSessionsByToken,
  hashPassword,
  requireAuth,
  setFlash,
  verifyPassword,
} from "../auth";
import {
  findUpload,
  findUserByEmail,
  findUserById,
  updateUserAvatar,
  updateUserPassword,
  updateUserProfile,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import { validateJson } from "../validation";

const avatarBody = t.Object(
  { uploadId: t.String({ minLength: 1 }) },
  { additionalProperties: false },
);
const infoBody = t.Object(
  {
    name: t.String({ minLength: 2, maxLength: 80 }),
    email: t.String({ format: "email" }),
  },
  { additionalProperties: false },
);
const passwordBody = t.Object(
  {
    currentPassword: t.String({ minLength: 1 }),
    password: t.String({ minLength: 8, maxLength: 72 }),
    passwordConfirmation: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

type AvatarBody = Static<typeof avatarBody>;
type InfoBody = Static<typeof infoBody>;
type PasswordBody = Static<typeof passwordBody>;

/** Field messages for the profile forms (merged into VALIDATION_MESSAGES in app.ts). */
export const PROFILE_VALIDATION_MESSAGES: Record<string, string> = {
  "/name": "Name must be at least 2 characters.",
  "/currentPassword": "Enter your current password.",
  "/passwordConfirmation": "Confirm your password.",
};

export const profileRoutes = () => {
  const app = new Hono<AppEnv>();

  app.get("/profile", requireAuth, (c) => c.var.inertia.render("Profile", {}));

  app.post(
    "/profile/avatar",
    requireAuth,
    validateJson(avatarBody),
    async (c) => {
      const user = c.var.user;
      if (!user) return new Response("Unauthorized", { status: 401 });
      const body = c.req.valid("json") as AvatarBody;
      const upload = await findUpload(body.uploadId);
      if (!upload || upload.userId !== user.id) {
        return new Response("Upload not found", { status: 404 });
      }
      if (upload.offset < upload.uploadLength) {
        return new Response("Upload is not complete", { status: 400 });
      }
      let filetype = "";
      try {
        const meta = JSON.parse(upload.metadata) as Record<string, string>;
        filetype = typeof meta.filetype === "string" ? meta.filetype : "";
      } catch {
        /* metadata may be empty or malformed */
      }
      // Raster-only: SVG can carry inline scripts — even with the
      // per-path script-src 'none' on /uploads, keeping avatars raster
      // avoids serving attacker-controlled scripts from our origin.
      const AVATAR_TYPES = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
      ];
      if (!AVATAR_TYPES.includes(filetype)) {
        return new Response("Only image uploads can be used as an avatar", {
          status: 422,
        });
      }
      await updateUserAvatar(`/uploads/${upload.id}`, user.id);
      return new Response(null, { status: 204 });
    },
  );

  app.patch("/profile", requireAuth, validateJson(infoBody), async (c) => {
    const user = c.var.user;
    if (!user) return new Response("Unauthorized", { status: 401 });
    const body = c.req.valid("json") as InfoBody;
    const existing = await findUserByEmail(body.email);
    if (existing && existing.id !== user.id) {
      return c.var.inertia.error("Profile", {
        email: "That email is already registered.",
      });
    }
    await updateUserProfile(body.name, body.email, user.id);
    if (c.var.sessionToken)
      await setFlash(c.var.sessionToken, { success: "Profile updated." });
    return c.var.inertia.redirect("/profile");
  });

  app.post(
    "/profile/password",
    requireAuth,
    validateJson(passwordBody),
    async (c) => {
      const user = c.var.user;
      if (!user) return new Response("Unauthorized", { status: 401 });
      const body = c.req.valid("json") as PasswordBody;
      if (body.password !== body.passwordConfirmation) {
        return c.var.inertia.error("Profile", {
          password: "Password confirmation does not match.",
        });
      }
      const full = await findUserById(user.id);
      if (!full) return new Response("Unauthorized", { status: 401 });
      if (!(await verifyPassword(body.currentPassword, full.passwordHash))) {
        return c.var.inertia.error("Profile", {
          currentPassword: "Your current password is incorrect.",
        });
      }
      const passwordHash = await hashPassword(body.password);
      await updateUserPassword(passwordHash, user.id);
      if (c.var.sessionToken) {
        await deleteOtherSessionsByToken(c.var.sessionToken, user.id);
        await setFlash(c.var.sessionToken, { success: "Password updated." });
      }
      return c.var.inertia.redirect("/profile");
    },
  );

  return app;
};
