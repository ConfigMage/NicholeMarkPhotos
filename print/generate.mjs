#!/usr/bin/env node
/**
 * Render the venue print set to PDF.
 *
 *   node print/generate.mjs
 *   node print/generate.mjs https://our-custom-domain.com
 *   PRINT_URL=https://... node print/generate.mjs
 *
 * Flags:
 *   --out <dir>      where the PDFs go (default: print/out)
 *   --keep-html      leave the intermediate HTML behind, for tweaking by hand
 *   --png            also write a PNG preview of each sheet
 *   --chrome <path>  point at a specific Chrome/Chromium binary
 *
 * No npm install required — the QR encoder is in `qr.mjs` and the fonts are in
 * `fonts/`. The only outside dependency is a Chrome or Chromium binary, which
 * does the HTML-to-PDF step.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { DEFAULT_URL, displayUrl } from "./config.mjs";
import { PIECES, QR_QUIET_ZONE, buildQr } from "./pieces.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------- Arguments */

function parseArgs(argv) {
  const options = { url: null, out: join(here, "out"), keepHtml: false, png: false, chrome: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") options.out = resolve(argv[++i]);
    else if (arg === "--keep-html") options.keepHtml = true;
    else if (arg === "--png") options.png = true;
    else if (arg === "--chrome") options.chrome = argv[++i];
    else if (arg === "--help" || arg === "-h") options.help = true;
    else rest.push(arg);
  }
  options.url = rest[0] ?? process.env.PRINT_URL ?? DEFAULT_URL;
  return options;
}

const USAGE = `Usage: node print/generate.mjs [url] [--out dir] [--keep-html] [--png] [--chrome path]

  url   the address the QR codes point at (default: ${DEFAULT_URL})`;

/* --------------------------------------------------------- Chrome lookup */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.PLAYWRIGHT_BROWSERS_PATH && join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findChrome(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`No browser at ${explicit}`);
    return explicit;
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Could not find Chrome or Chromium. Install Google Chrome, or pass --chrome /path/to/chrome.",
  );
}

/* ------------------------------------------------------------- Rendering */

/** Every sheet is US Letter, which is 816 x 1056 CSS pixels at 96dpi. */
const SHEET_CSS_PX = { width: 816, height: 1056 };

/**
 * Headless Chrome stops painting a little short of the window height, so a
 * screenshot sized exactly to the sheet loses its last inch. Only the preview
 * is affected (--print-to-pdf paginates properly), so ask for a taller window
 * and accept a strip of empty page under each preview.
 */
const PREVIEW_PAD_PX = 140;

const CHROME_FLAGS = [
  "--headless",
  "--disable-gpu",
  "--no-sandbox",
  "--no-pdf-header-footer",
  "--run-all-compositor-stages-before-draw",
  // The fonts are inlined as data URIs, so this is plenty of time to lay out.
  "--virtual-time-budget=8000",
];

function runChrome(chrome, args) {
  try {
    execFileSync(chrome, args, { stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`Chrome failed:\n${detail}`);
  }
}

/** Chrome writes the page box into the PDF; read it back as a sanity check. */
function pdfPageBoxes(path) {
  const raw = readFileSync(path).toString("latin1");
  const boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  return boxes.map((m) => ({
    width: (Number(m[3]) - Number(m[1])) / 72,
    height: (Number(m[4]) - Number(m[2])) / 72,
  }));
}

/* ------------------------------------------------------------------ Main */

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  let parsed;
  try {
    parsed = new URL(options.url);
  } catch {
    throw new Error(`"${options.url}" is not a valid URL. Include the https:// prefix.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Only http(s) URLs can go on a card; got "${parsed.protocol}".`);
  }

  const chrome = findChrome(options.chrome);

  const qr = buildQr(options.url);
  const unitsAcross = qr.size + QR_QUIET_ZONE * 2;

  console.log(`Link      ${options.url}`);
  console.log(`Printed   ${displayUrl(options.url)}`);
  console.log(`QR        version ${qr.version}, ${qr.size}x${qr.size} modules, quartile error correction`);
  console.log(`Browser   ${chrome}`);
  console.log("");

  mkdirSync(options.out, { recursive: true });
  const htmlDir = options.keepHtml
    ? join(options.out, "html")
    : join(tmpdir(), `wedding-print-${process.pid}`);
  mkdirSync(htmlDir, { recursive: true });

  let warnings = 0;

  for (const piece of PIECES) {
    const html = piece.render(qr, options.url);
    const htmlPath = join(htmlDir, `${piece.slug}.html`);
    writeFileSync(htmlPath, html, "utf8");

    const pdfPath = join(options.out, `${piece.slug}.pdf`);
    const pageUrl = pathToFileURL(htmlPath).href;
    runChrome(chrome, [...CHROME_FLAGS, `--print-to-pdf=${pdfPath}`, pageUrl]);

    if (options.png) {
      const pngPath = join(options.out, `${piece.slug}.png`);
      runChrome(chrome, [
        ...CHROME_FLAGS,
        `--window-size=${SHEET_CSS_PX.width},${SHEET_CSS_PX.height + PREVIEW_PAD_PX}`,
        "--force-device-scale-factor=2",
        "--hide-scrollbars",
        `--screenshot=${pngPath}`,
        pageUrl,
      ]);
    }

    // A QR module smaller than about 0.6mm is where phone cameras start to
    // struggle, so say something rather than shipping a code nobody can scan.
    const moduleMm = (piece.qrInches / unitsAcross) * 25.4;
    const boxes = pdfPageBoxes(pdfPath);
    const pageNote =
      boxes.length === 1 && Math.abs(boxes[0].width - 8.5) < 0.02 && Math.abs(boxes[0].height - 11) < 0.02
        ? "US Letter"
        : `${boxes.length} page(s) at ${boxes.map((b) => `${b.width.toFixed(2)}x${b.height.toFixed(2)}in`).join(", ")}`;

    const flag = moduleMm < 0.6 ? "  <-- QR modules are very small, check a test scan" : "";
    if (moduleMm < 0.6) warnings++;

    console.log(
      `${piece.slug}.pdf`.padEnd(30) +
        `${pageNote.padEnd(12)} QR ${piece.qrInches}in (${moduleMm.toFixed(2)}mm per module)${flag}`,
    );
  }

  if (!options.keepHtml) rmSync(htmlDir, { recursive: true, force: true });

  console.log("");
  console.log(`${readdirSync(options.out).filter((f) => f.endsWith(".pdf")).length} PDFs in ${options.out}`);
  if (warnings > 0) {
    console.log(`${warnings} piece(s) have small QR modules — scan-test one before printing a stack.`);
  }
  console.log("Print at 100% / Actual size, not Fit to page.");
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
