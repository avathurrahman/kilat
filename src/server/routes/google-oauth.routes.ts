/**
 * Google OAuth (register-or-login). Zero-dependency: plain fetch against
 * Google's endpoints, with a short-lived state cookie for CSRF protection.
 * Disabled automatically when GOOGLE_CLIENT_ID/SECRET are not configured.
 *
 * Workers-specific changes:
 *  - All DB calls async (D1).
 *  - Avatar storage skipped (no R2 binding yet) — external picture URL
 *    stored directly. CSP img-src 'self' will block it; acceptable for
 *    the experiment phase.
 */
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import {
  clearOAuthStateCookie,
  createSession,
  OAUTH_STATE_COOKIE,
  setOAuthStateCookie,
  setSessionCookie,
} from "../auth";
import { config } from "../config";
import {
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  linkGoogleAccount,
  updateUserAvatar,
  type UserRow,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import { safeUrl } from "../url";

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

async function exchangeCode(code: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId!,
      client_secret: config.google.clientSecret!,
      redirect_uri: `${config.appUrl}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token)
    throw new Error("Google token exchange returned no access token");
  return data.access_token;
}

async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google profile fetch failed (${res.status})`);
  const data = (await res.json()) as {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!data.id || !data.email)
    throw new Error("Google profile is missing id/email");
  return {
    id: data.id,
    email: data.email.toLowerCase(),
    name: data.name?.trim() || data.email.split("@")[0]!,
    picture: data.picture ?? null,
  };
}

/** Find or create a local user for the Google profile (links by email). */
async function findOrCreateGoogleUser(
  profile: GoogleProfile,
): Promise<UserRow> {
  const byGoogle = await findUserByGoogleId(profile.id);
  if (byGoogle) return byGoogle;

  const byEmail = await findUserByEmail(profile.email);
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.id) {
      throw new Error("Email is already linked to a different Google account");
    }
    await linkGoogleAccount(profile.id, byEmail.id);
    return byEmail;
  }

  const created = await createGoogleUser(
    profile.name,
    profile.email,
    profile.id,
    profile.picture ?? "",
  );
  if (!created) throw new Error("Failed to create user from Google profile");
  const user = await findUserByEmail(profile.email);
  if (!user) throw new Error("Failed to fetch created Google user");
  return user;
}

export const googleOauthRoutes = () => {
  const app = new Hono<AppEnv>();

  app.get("/auth/google", (c) => {
    if (!config.google.clientId || !config.google.clientSecret) {
      return new Response("Google OAuth is not configured", { status: 400 });
    }
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setOAuthStateCookie(c, state);
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: `${config.appUrl}/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    return new Response(null, {
      status: 302,
      headers: { location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` },
    });
  });

  app.get("/auth/google/callback", async (c) => {
    const url = safeUrl(c.req.url);
    url.protocol = safeUrl(config.appUrl).protocol;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const stored = getCookie(c, OAUTH_STATE_COOKIE) ?? null;
    clearOAuthStateCookie(c);

    if (
      url.searchParams.get("error") ||
      !code ||
      !state ||
      !stored ||
      state !== stored
    ) {
      return new Response(null, { status: 302, headers: { location: new URL("/login?notice=google_failed", url).toString() } });
    }
    try {
      const accessToken = await exchangeCode(code);
      const profile = await fetchProfile(accessToken);
      const user = await findOrCreateGoogleUser(profile);
      // Avatar storage skipped in CF experiment (no R2). Update avatar
      // URL to the external Google picture if the user has no avatar yet.
      if (profile.picture && !user.avatarUrl) {
        await updateUserAvatar(profile.picture, user.id);
      }
      const session = await createSession(user.id);
      setSessionCookie(c, session.token, session.expiresAt);
      return new Response(null, { status: 303, headers: { location: new URL("/dashboard", url).toString() } });
    } catch (err) {
      console.error("[google-oauth]", err);
      return new Response(null, { status: 302, headers: { location: new URL("/login?notice=google_failed", url).toString() } });
    }
  });

  return app;
};
