/**
 * OG image for the landing page (/).
 *
 * Unlike docs pages (which use /og/[...slug].png keyed by content collection
 * slug), the landing page is a standalone Astro page — not part of the docs
 * collection. This route generates a dedicated 1200×630 PNG with the Kilat
 * tagline and branding.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

const SITE_URL = process.env.SITE_URL ?? "https://kilatjs.pages.dev";
const BRAND_URL = new URL(SITE_URL).hostname.replace(/^www\./, "");
const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: "#0a0a0a",
  accent: "#059669",
  accentBright: "#34d399",
  text: "#fafafa",
  textMuted: "#a1a1aa",
};

let logoCache: string | null = null;

async function loadLogo(): Promise<string> {
  if (logoCache) return logoCache;
  const buf = await readFile(join(ROOT, "src/assets/logo.svg"));
  logoCache = `data:image/svg+xml;base64,${buf.toString("base64")}`;
  return logoCache;
}

let fontCache: Buffer | null = null;

async function loadFont(): Promise<Buffer> {
  if (fontCache) return fontCache;
  const candidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const p of candidates) {
    try {
      fontCache = await readFile(p);
      return fontCache;
    } catch {}
  }
  throw new Error(
    "No suitable font found for OG image generation. Install Arial or DejaVu Sans.",
  );
}

export async function GET() {
  const logo = await loadLogo();
  const font = await loadFont();

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLORS.bg,
          backgroundImage: `radial-gradient(circle at 85% 15%, ${COLORS.accent}22 0%, transparent 50%)`,
          padding: "80px",
          fontFamily: "Arial",
        },
        children: [
          // Logo + brand name
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "auto",
              },
              children: [
                {
                  type: "img",
                  props: { src: logo, width: 48, height: 48 },
                },
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: 28,
                      fontWeight: 700,
                      color: COLORS.text,
                    },
                    children: "Kilat",
                  },
                },
              ],
            },
          },
          // Main tagline
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 64,
                      fontWeight: 700,
                      color: COLORS.text,
                      lineHeight: 1.15,
                      maxWidth: "950px",
                    },
                    children: "Edge-native full-stack starter",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 30,
                      color: COLORS.accentBright,
                      fontWeight: 600,
                      lineHeight: 1.3,
                    },
                    children:
                      "Cloudflare Workers + Hono + D1 + Inertia v3",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 26,
                      color: COLORS.textMuted,
                      lineHeight: 1.4,
                      maxWidth: "880px",
                    },
                    children:
                      "Auth, migrations, tests — wired end to end. Deploy to 300+ edge locations.",
                  },
                },
              ],
            },
          },
          // Brand URL footer
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "auto",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      width: 40,
                      height: 4,
                      backgroundColor: COLORS.accent,
                      borderRadius: 2,
                    },
                  },
                },
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: 22,
                      color: COLORS.accentBright,
                      fontWeight: 600,
                    },
                    children: BRAND_URL,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: "Arial", data: font, weight: 700, style: "normal" }],
    },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
  const png = resvg.render().asPng();

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
