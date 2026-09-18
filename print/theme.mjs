/**
 * The print set's design system — the same palette and typography as the site
 * (`tailwind.config.ts` + `src/app/layout.tsx`), re-expressed for paper.
 *
 * Fonts are embedded as base64 so a rendered sheet is self-contained: no
 * network, no Google Fonts request, identical output on any machine.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), "fonts");

/** Straight from `tailwind.config.ts`. Keep these in sync with the site. */
export const PALETTE = {
  cream: "#FAF6F1",
  surface: "#FFFFFF",
  rose: "#C9A0A4",
  roseDeep: "#B07E84",
  sage: "#9CAF94",
  sageDeep: "#84997B",
  blush: "#F3DCDC",
  paleSage: "#DCE6D5",
  charcoal: "#403A38",
  warmGray: "#8A817C",
};

function dataUri(file) {
  return `data:font/woff2;base64,${readFileSync(join(fontsDir, file)).toString("base64")}`;
}

/** @font-face rules with the woff2 payloads inlined. */
export function fontFaces() {
  const serif = dataUri("CormorantGaramond-latin.woff2");
  const serifItalic = dataUri("CormorantGaramond-Italic-latin.woff2");
  const sans = dataUri("Inter-latin.woff2");
  return `
@font-face {
  font-family: "Cormorant Garamond";
  font-style: normal;
  font-weight: 300 700;
  src: url(${serif}) format("woff2");
}
@font-face {
  font-family: "Cormorant Garamond";
  font-style: italic;
  font-weight: 300 700;
  src: url(${serifItalic}) format("woff2");
}
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;
  src: url(${sans}) format("woff2");
}`;
}

/** Escape a value that came from outside this file (e.g. the couple's names). */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Shared stylesheet. Every piece is laid out in real inches so what renders is
 * exactly what comes out of the printer, at any scale setting.
 */
export const BASE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  /* Without this, browsers helpfully strip the backgrounds when printing. */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  background: ${PALETTE.cream};
}

body {
  font-family: "Inter", system-ui, sans-serif;
  color: ${PALETTE.charcoal};
  -webkit-font-smoothing: antialiased;
}

.sheet {
  position: relative;
  overflow: hidden;
  background: ${PALETTE.cream};
  page-break-after: always;
}
.sheet:last-child { page-break-after: auto; }

/* ---- Shared type ---- */

.kicker {
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.32em;
  color: ${PALETTE.warmGray};
  /* Tracking adds space after the last letter; nudge back to stay centred. */
  text-indent: 0.32em;
}

.names {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-weight: 500;
  line-height: 1.05;
  color: ${PALETTE.charcoal};
}

.date {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-style: italic;
  color: ${PALETTE.roseDeep};
}

.headline {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-weight: 500;
  line-height: 1.15;
  color: ${PALETTE.charcoal};
}

.body-copy { color: ${PALETTE.warmGray}; line-height: 1.55; }

em { font-style: normal; font-weight: 600; color: ${PALETTE.roseDeep}; }
strong { font-weight: 600; color: ${PALETTE.charcoal}; }

/* ---- Hairline divider with the sage diamond, straight from Header.tsx ---- */

.rule { display: flex; align-items: center; justify-content: center; }
.rule .line { height: 1px; flex: 1; background: ${PALETTE.rose}66; }
.rule .diamond {
  width: 0.05in; height: 0.05in;
  margin: 0 0.07in;
  transform: rotate(45deg);
  background: ${PALETTE.sage};
}

/* ---- QR panel: white card, dashed rose frame (an echo of the drop zone) ---- */

.qr-panel {
  background: ${PALETTE.surface};
  border: 1.5px dashed ${PALETTE.rose}99;
  border-radius: 0.14in;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* The code itself stays pure black on white — nothing tinted, nothing clever. */
.qr-panel svg { display: block; width: 100%; height: 100%; }

.url {
  font-weight: 600;
  letter-spacing: 0.01em;
  color: ${PALETTE.charcoal};
  white-space: nowrap;
}
.url .scheme { color: ${PALETTE.warmGray}; font-weight: 400; }

/* ---- Cut and fold guides ---- */

.cut-line { position: absolute; background: ${PALETTE.rose}59; }
.cut-line.h { left: 0; right: 0; height: 0.5px; }
.cut-line.v { top: 0; bottom: 0; width: 0.5px; }

.fold-tick {
  position: absolute;
  font-family: "Inter", sans-serif;
  font-size: 5pt;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${PALETTE.rose};
}
`;

/**
 * Wrap body markup in a complete, self-contained print document.
 *
 * @param {{ title: string, width: string, height: string, css?: string, body: string }} options
 */
export function page({ title, width, height, css = "", body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
${fontFaces()}
@page { size: ${width} ${height}; margin: 0; }
${BASE_CSS}
.sheet { width: ${width}; height: ${height}; }
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
