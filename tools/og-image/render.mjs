#!/usr/bin/env node
/**
 * Social preview image (Open Graph / Twitter card) generator.
 *
 * Renders a 1200x630 PNG from data.json with Satori (layout -> SVG) and
 * resvg (SVG -> PNG). No browser involved.
 *
 *   node render.mjs render [data.json] [out.png]   write the PNG (used by CI)
 *   node render.mjs serve  [data.json]             live preview at http://127.0.0.1:8090
 *
 * Paths default to the repository root (../../data.json, ../../images/preview.png).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const WIDTH = 1200;
const HEIGHT = 630;
const SITE = "longhvx.github.io";
const MAX_SKILLS = 9;

const COLORS = {
  bg: "#f4f5f7",
  paper: "#ffffff",
  ink: "#1f2a37",
  muted: "#6b7280",
  rule: "#e5e7eb",
  accent: "#0f766e",
  accentSoft: "#eef6f5",
  accentBorder: "#cfe5e2",
};

const fontFile = (weight) =>
  readFileSync(resolve(HERE, `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
const FONTS = [400, 500, 600, 800].map((weight) => ({
  name: "Inter",
  data: fontFile(weight),
  weight,
  style: "normal",
}));

const ICONS = {
  email:
    "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M3 7l9 6 9-6'/>",
  location:
    "<path d='M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z'/><circle cx='12' cy='10' r='2.5'/>",
};
const iconSrc = (key) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${COLORS.muted}' stroke-width='2'>${ICONS[key]}</svg>`
  );

// ---------------------------------------------------------------------------
// data.json -> card content
// ---------------------------------------------------------------------------
const MARKUP = /\{\{(?:bold|underline)\('([^']+)'\)\}\}/g;
const text = (v) => (v == null ? "" : typeof v === "string" ? v : (v.en ?? ""));
const plain = (v) => text(v).replace(MARKUP, "$1");

export function cardContent(data) {
  const header = data.blocks.find((b) => b.type === "header") ?? {};
  const skillsSection = data.blocks.find(
    (b) => b.type === "section" && plain(b.title).toLowerCase() === "skills"
  );

  // Highlighted (bold) entries of each skills group, excluding the group label.
  const skills = [];
  for (const list of skillsSection?.blocks ?? []) {
    for (const item of list.items ?? []) {
      skills.push(...[...text(item).matchAll(MARKUP)].map((m) => m[1]).slice(1));
    }
  }

  return {
    name: plain(header.name),
    title: plain(header.title),
    skills: [...new Set(skills)].slice(0, MAX_SKILLS),
    contact: ["email", "location"]
      .map((key) => ({ key, value: plain(header.contact?.[key]) }))
      .filter((c) => c.value),
  };
}

// ---------------------------------------------------------------------------
// Layout (Satori element tree; every multi-child box needs display:flex)
// ---------------------------------------------------------------------------
const h = (type, style, ...children) => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

function card({ name, title, skills, contact }) {
  return h(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      padding: 40,
      background: COLORS.bg,
      fontFamily: "Inter",
    },
    h(
      "div",
      {
        width: WIDTH - 80,
        height: HEIGHT - 80,
        display: "flex",
        position: "relative",
        background: COLORS.paper,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(17, 24, 39, 0.08)",
      },
      h("div", { width: 10, background: COLORS.accent }),
      h(
        "div",
        {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "64px 72px 52px 62px",
        },
        h(
          "div",
          {
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: COLORS.ink,
          },
          name
        ),
        h(
          "div",
          { marginTop: 18, fontSize: 34, fontWeight: 500, color: COLORS.accent },
          title
        ),
        h(
          "div",
          { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 44 },
          ...skills.map((s) =>
            h(
              "div",
              {
                padding: "10px 20px",
                fontSize: 22,
                fontWeight: 600,
                color: COLORS.ink,
                background: COLORS.accentSoft,
                border: `1px solid ${COLORS.accentBorder}`,
                borderRadius: 999,
              },
              s
            )
          )
        ),
        h(
          "div",
          {
            marginTop: "auto",
            paddingTop: 28,
            borderTop: `1px solid ${COLORS.rule}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: COLORS.muted,
          },
          h(
            "div",
            { display: "flex", gap: 32 },
            ...contact.map(({ key, value }) =>
              h(
                "div",
                { display: "flex", alignItems: "center", gap: 10 },
                { type: "img", props: { src: iconSrc(key), width: 22, height: 22 } },
                value
              )
            )
          ),
          h("div", { fontWeight: 600, color: COLORS.ink }, SITE)
        )
      )
    )
  );
}

export async function renderPng(data) {
  const svg = await satori(card(cardContent(data)), {
    width: WIDTH,
    height: HEIGHT,
    fonts: FONTS,
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const readData = (path) => JSON.parse(readFileSync(path, "utf8"));
const [mode = "render", dataArg, outArg] = process.argv.slice(2);
const dataPath = resolve(dataArg ?? resolve(ROOT, "data.json"));

if (mode === "render") {
  const outPath = resolve(outArg ?? resolve(ROOT, "images/preview.png"));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, await renderPng(readData(dataPath)));
  console.log(`og-image: wrote ${outPath} (${WIDTH}x${HEIGHT})`);
} else if (mode === "serve") {
  const port = Number(process.env.PORT ?? 8090);
  const { name, title } = cardContent(readData(dataPath));
  const page = `<!doctype html><meta charset="utf-8"><title>Social preview</title>
<style>body{margin:0;padding:32px;background:#e5e7eb;font:15px system-ui,sans-serif;color:#1f2a37}
h1{font-size:16px;margin:0 0 16px}img{display:block;max-width:100%;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12)}
.link{margin-top:32px;max-width:520px;background:#fff;border:1px solid #d1d5db;border-radius:12px;overflow:hidden}
.link div{padding:12px 16px}.link small{color:#6b7280}</style>
<h1>Social preview card · 1200×630 · re-rendered from data.json on every refresh</h1>
<img src="/preview.png" alt="Social preview card">
<p><small>As it might appear in a shared link:</small></p>
<div class="link"><img src="/preview.png" alt=""><div><small>${SITE}</small><br><b>${name} · ${title}</b></div></div>`;
  createServer(async (req, res) => {
    try {
      if (req.url.startsWith("/preview.png")) {
        const png = await renderPng(readData(dataPath));
        res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
        res.end(png);
      } else {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(page);
      }
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(err?.stack ?? err));
    }
  }).listen(port, "127.0.0.1", () =>
    console.log(`og-image: preview at http://127.0.0.1:${port} (data: ${dataPath})`)
  );
} else {
  console.error(`og-image: unknown mode "${mode}" (use render or serve)`);
  process.exit(1);
}
