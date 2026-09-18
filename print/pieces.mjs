/**
 * The printed pieces. Each export returns a complete, self-contained HTML
 * document sized in real inches, ready for `generate.mjs` to render to PDF.
 *
 * Everything targets US Letter (8.5in x 11in) so the whole set prints on a
 * normal home or office printer with no special stock.
 */

import { COPY, SITE, displayUrl } from "./config.mjs";
import { PALETTE, escapeHtml, page } from "./theme.mjs";
import { encodeQr, qrToSvg, ECC } from "./qr.mjs";

const NAMES = escapeHtml(SITE.coupleNames);
const KICKER = escapeHtml(SITE.kicker);
const DATE = escapeHtml(SITE.date);

/**
 * Quartile error correction: a QR stays readable with a quarter of it damaged,
 * which is the right trade for cards that spend an evening on a dinner table.
 * It also keeps the symbol at 33 modules for a URL this length, so the printed
 * squares stay comfortably large.
 */
const QR_ECC = ECC.QUARTILE;

/** Encode once per run; every piece reuses the same matrix. */
export function buildQr(url) {
  return encodeQr(url, { ecc: QR_ECC });
}

function qrMarkup(qr) {
  return qrToSvg(qr, { margin: 4, dark: "#000000", light: "#FFFFFF" });
}

/** The typed-out address, with the scheme de-emphasised. */
function urlMarkup(url) {
  return `<span class="scheme">https://</span>${escapeHtml(displayUrl(url))}`;
}

function ruleMarkup(width) {
  return `<div class="rule" style="width:${width}"><span class="line"></span><span class="diamond"></span><span class="line"></span></div>`;
}

function dateMarkup(fontSize) {
  return DATE ? `<p class="date" style="font-size:${fontSize}">${DATE}</p>` : "";
}

/* ------------------------------------------------------------------------ *
 * Shared styling for the five QR pieces.
 *
 * Each piece sets `--u`, a single scale knob; every size below is derived from
 * it, so one block of CSS dresses everything from a 2.75in tag to a full sign.
 * ------------------------------------------------------------------------ */

const PIECE_CSS = `
.piece {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: ${PALETTE.cream};
  overflow: hidden;
}

/* Inset hairline frame — sits far enough in to survive an imprecise cut. */
.frame {
  position: absolute;
  inset: calc(0.16in * var(--u));
  border: 1px solid ${PALETTE.rose}66;
  border-radius: calc(0.1in * var(--u));
  pointer-events: none;
}

.piece .kicker { font-size: calc(6.2pt * var(--u)); }
.piece .names { font-size: calc(27pt * var(--u)); margin-top: calc(0.09in * var(--u)); }
.piece .date { font-size: calc(10pt * var(--u)); margin-top: calc(0.04in * var(--u)); }
.piece .rule { margin: calc(0.12in * var(--u)) 0; }
.piece .headline { font-size: calc(15.5pt * var(--u)); }
.piece .subhead {
  font-size: calc(7.6pt * var(--u));
  color: ${PALETTE.warmGray};
  margin-top: calc(0.05in * var(--u));
}

.piece .qr-panel {
  width: calc(var(--qr) + 0.3in * var(--u));
  height: calc(var(--qr) + 0.3in * var(--u));
  margin-top: calc(0.17in * var(--u));
  padding: calc(0.05in * var(--u));
}
.piece .url {
  font-size: calc(8.2pt * var(--u));
  margin-top: calc(0.12in * var(--u));
}
.piece .footnote {
  font-size: calc(6.6pt * var(--u));
  color: ${PALETTE.warmGray};
  margin-top: calc(0.07in * var(--u));
  letter-spacing: 0.04em;
}
`;

/**
 * The stacked lockup every card shares: names, divider, headline, QR, address.
 *
 * @param {object} qr        matrix from buildQr()
 * @param {string} url
 * @param {object} [options] per-piece trims
 */
function lockup(qr, url, options = {}) {
  const {
    showKicker = true,
    showSubhead = true,
    showFootnote = true,
    headline = COPY.headlineLong,
    ruleWidth = "1.5in",
  } = options;

  return `
${showKicker ? `<p class="kicker">${KICKER}</p>` : ""}
<h1 class="names">${NAMES}</h1>
${dateMarkup("calc(10pt * var(--u))")}
${ruleMarkup(ruleWidth)}
<h2 class="headline">${headline}</h2>
${showSubhead ? `<p class="subhead">${COPY.subhead}</p>` : ""}
<div class="qr-panel">${qrMarkup(qr)}</div>
<p class="url">${urlMarkup(url)}</p>
${showFootnote ? `<p class="footnote">${COPY.reassurance}</p>` : ""}`;
}

/* ------------------------------------------------------------------ 1. Sign */

/** Full-page 8.5in x 11in sign for an easel, a frame, or the welcome table. */
export function signSheet(qr, url) {
  const steps = COPY.steps
    .map(
      (step, i) => `
    <li class="step">
      <span class="step-num">${i + 1}</span>
      <p class="step-title">${step.title}</p>
      <p class="step-body">${step.body}</p>
    </li>`,
    )
    .join("");

  const css = `
.piece { --u: 2.05; --qr: 2.55in; width: 8.5in; height: 11in; justify-content: flex-start; padding: 1.05in 0.9in 0.8in; }
.piece .names { font-size: 52pt; }
.piece .headline { font-size: 25pt; margin-top: 0.06in; }
.piece .subhead { font-size: 10.5pt; }
.piece .url { font-size: 12pt; }
.piece .footnote { font-size: 8.4pt; }

.steps {
  display: flex;
  gap: 0.34in;
  margin-top: 0.62in;
  list-style: none;
  width: 100%;
}
.step { flex: 1; text-align: center; }
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.34in;
  height: 0.34in;
  border-radius: 50%;
  background: ${PALETTE.paleSage};
  color: ${PALETTE.sageDeep};
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: 15pt;
  font-weight: 600;
  /* Cormorant defaults to old-style figures, which sit oddly inside a circle. */
  font-variant-numeric: lining-nums;
  font-feature-settings: "lnum" 1;
  margin-bottom: 0.1in;
}
.step-title { font-size: 9.6pt; font-weight: 600; color: ${PALETTE.charcoal}; }
.step-body { font-size: 8.6pt; line-height: 1.5; color: ${PALETTE.warmGray}; margin-top: 0.05in; }
`;

  return page({
    title: `${SITE.coupleNames} — venue sign`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet"><div class="piece">
  <div class="frame"></div>
  ${lockup(qr, url, { ruleWidth: "2.3in", showFootnote: false })}
  <ul class="steps">${steps}</ul>
  <p class="footnote" style="margin-top:0.5in">${COPY.reassurance}</p>
</div></div>`,
  });
}

/* ------------------------------------------------------------ 2. Table tent */

/**
 * Fold-in-half table tent. The upper panel prints upside down so that, once
 * folded along the middle, both sides of the finished tent read correctly.
 * No cutting — one fold and it stands up.
 */
export function tableTentSheet(qr, url) {
  const panel = `<div class="piece">
  <div class="frame"></div>
  ${lockup(qr, url, { ruleWidth: "1.7in" })}
</div>`;

  const css = `
.piece { --u: 1.45; --qr: 1.75in; width: 8.5in; height: 5.5in; }
.panel { position: absolute; left: 0; width: 8.5in; height: 5.5in; }
.panel.top { top: 0; transform: rotate(180deg); }
.panel.bottom { top: 5.5in; }

/* Fold guide: ticks in the outer margin only, so nothing crosses the ridge. */
.fold { position: absolute; top: 5.5in; width: 100%; }
.fold .tick { position: absolute; top: 0; width: 0.3in; height: 0.5px; background: ${PALETTE.rose}80; }
.fold .tick.left { left: 0; }
.fold .tick.right { right: 0; }
.fold .label {
  position: absolute;
  top: -0.055in;
  left: 50%;
  transform: translateX(-50%);
  font-size: 5pt;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${PALETTE.rose};
  background: ${PALETTE.cream};
  padding: 0 0.06in;
}
`;

  return page({
    title: `${SITE.coupleNames} — table tent`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet">
  <div class="panel top">${panel}</div>
  <div class="panel bottom">${panel}</div>
  <div class="fold">
    <span class="tick left"></span>
    <span class="label">fold here</span>
    <span class="tick right"></span>
  </div>
</div>`,
  });
}

/* ----------------------------------------------------- 3. Half-page cards */

/** Two 8.5in x 5.5in cards per sheet. Cut once across the middle. */
export function halfPageSheet(qr, url) {
  const card = `<div class="piece">
  <div class="frame"></div>
  <div class="col-text">
    <p class="kicker">${KICKER}</p>
    <h1 class="names">${NAMES}</h1>
    ${dateMarkup("11pt")}
    ${ruleMarkup("2in")}
    <h2 class="headline">${COPY.headlineLong}</h2>
    <p class="subhead">${COPY.subhead}</p>
    <p class="footnote">${COPY.reassurance}</p>
  </div>
  <div class="col-qr">
    <div class="qr-panel">${qrMarkup(qr)}</div>
    <p class="url">${urlMarkup(url)}</p>
  </div>
</div>`;

  const css = `
.piece {
  --u: 1.3; --qr: 2.5in;
  width: 8.5in; height: 5.5in;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 0.4in;
  padding: 0 0.45in;
}
.col-text { display: flex; flex-direction: column; align-items: center; }
.col-qr { display: flex; flex-direction: column; align-items: center; }
.piece .qr-panel { margin-top: 0; }
.piece .names { font-size: 44pt; }
.piece .headline { font-size: 22pt; margin-top: 0.05in; }
.piece .subhead { font-size: 11pt; }
.piece .url { font-size: 9.5pt; }
.piece .footnote { font-size: 9pt; margin-top: 0.18in; }

.card-slot { position: absolute; left: 0; width: 8.5in; height: 5.5in; }
.card-slot.a { top: 0; }
.card-slot.b { top: 5.5in; }
`;

  return page({
    title: `${SITE.coupleNames} — half-page cards`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet">
  <div class="card-slot a">${card}</div>
  <div class="card-slot b">${card}</div>
  <div class="cut-line h" style="top:5.5in"></div>
</div>`,
  });
}

/* -------------------------------------------------- 4. Quarter-page cards */

/** Four 4.25in x 5.5in cards per sheet — the table-and-bar workhorse. */
export function quarterPageSheet(qr, url) {
  const card = `<div class="piece">
  <div class="frame"></div>
  ${lockup(qr, url, { ruleWidth: "1.5in", headline: COPY.headlineLong })}
</div>`;

  const css = `
.piece { --u: 1.25; --qr: 1.75in; width: 4.25in; height: 5.5in; padding: 0 0.3in; }
.piece .names { font-size: 29pt; }
.piece .headline { font-size: 16pt; }
.piece .subhead { font-size: 8.6pt; }
.piece .url { font-size: 9pt; }
.piece .footnote { font-size: 7.4pt; }

.slot { position: absolute; width: 4.25in; height: 5.5in; }
`;

  const slots = [
    { top: "0", left: "0" },
    { top: "0", left: "4.25in" },
    { top: "5.5in", left: "0" },
    { top: "5.5in", left: "4.25in" },
  ]
    .map((s) => `<div class="slot" style="top:${s.top};left:${s.left}">${card}</div>`)
    .join("");

  return page({
    title: `${SITE.coupleNames} — quarter-page cards`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet">
  ${slots}
  <div class="cut-line h" style="top:5.5in"></div>
  <div class="cut-line v" style="left:4.25in"></div>
</div>`,
  });
}

/* -------------------------------------------------------- 5. Mini QR tags */

/**
 * Eight 4.25in x 2.75in tags per sheet, laid out sideways so the code sits
 * beside the words. Small enough to tuck into favours, prop on the bar, or
 * leave in the restroom basket.
 */
export function miniTagSheet(qr, url) {
  const tag = `<div class="piece">
  <div class="frame"></div>
  <div class="qr-panel">${qrMarkup(qr)}</div>
  <div class="tag-text">
    <p class="kicker">${KICKER}</p>
    <h2 class="headline">${COPY.headline}</h2>
    ${ruleMarkup("0.95in")}
    <p class="url">${urlMarkup(url)}</p>
    <p class="tag-names">${NAMES}</p>
  </div>
</div>`;

  const css = `
.piece {
  --u: 0.82; --qr: 1.4in;
  width: 4.25in; height: 2.75in;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0.16in;
  padding: 0 0.22in;
}
.piece .qr-panel { margin-top: 0; flex: none; }
.tag-text { flex: 1; display: flex; flex-direction: column; align-items: center; }
.piece .kicker { font-size: 5pt; }
.piece .headline { font-size: 15pt; margin-top: 0.05in; line-height: 1.1; }
.piece .rule { margin: 0.08in 0; }
.piece .url { font-size: 7pt; margin-top: 0; }
.tag-names {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: 13pt;
  color: ${PALETTE.roseDeep};
  margin-top: 0.08in;
}

.slot { position: absolute; width: 4.25in; height: 2.75in; }
`;

  const slots = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      slots.push(
        `<div class="slot" style="top:${row * 2.75}in;left:${col * 4.25}in">${tag}</div>`,
      );
    }
  }

  const cuts = [2.75, 5.5, 8.25]
    .map((y) => `<div class="cut-line h" style="top:${y}in"></div>`)
    .join("");

  return page({
    title: `${SITE.coupleNames} — mini tags`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet">
  ${slots.join("")}
  ${cuts}
  <div class="cut-line v" style="left:4.25in"></div>
</div>`,
  });
}

/* ------------------------------------------------------- 6. Guide / help */

/** Full-page upload guidelines and troubleshooting, for the welcome table. */
export function guideSheet(qr, url) {
  const steps = COPY.steps
    .map(
      (step, i) => `
      <li class="g-step">
        <span class="g-num">${i + 1}</span>
        <div>
          <p class="g-step-title">${step.title}</p>
          <p class="g-step-body">${step.body}</p>
        </div>
      </li>`,
    )
    .join("");

  const guidelines = COPY.guidelines
    .map((item) => `<li class="g-bullet">${item}</li>`)
    .join("");

  const troubleshooting = COPY.troubleshooting
    .map(
      (item) => `
      <li class="g-fix">
        <p class="g-problem">${item.problem}</p>
        <p class="g-answer">${item.fix}</p>
      </li>`,
    )
    .join("");

  const css = `
.sheet { padding: 0.62in 0.66in 0.5in; display: flex; flex-direction: column; }

.g-head { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 0.4in; }
.g-head-text { flex: 1; }
.g-head .kicker { font-size: 6.4pt; text-align: left; text-indent: 0; }
.g-head .names {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: 34pt; font-weight: 500; line-height: 1.05; margin-top: 0.05in;
}
.g-head .date { font-size: 11pt; margin-top: 0.03in; }
.g-head .headline { font-size: 15pt; margin-top: 0.08in; color: ${PALETTE.roseDeep}; }
.g-head .g-sub { font-size: 8.4pt; color: ${PALETTE.warmGray}; margin-top: 0.06in; line-height: 1.5; }

.g-qr { display: flex; flex-direction: column; align-items: center; flex: none; }
.g-qr .qr-panel { width: 1.72in; height: 1.72in; padding: 0.06in; }
.g-qr .url { font-size: 7.6pt; margin-top: 0.09in; }

/* flex:none — without it the divider is the first thing a tight page squashes. */
.g-divider { flex: none; height: 1px; background: ${PALETTE.rose}59; margin: 0.2in 0 0.17in; }

.g-section-title {
  flex: none;
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: 16pt; font-weight: 600; color: ${PALETTE.charcoal};
  margin-bottom: 0.11in;
}

.g-steps { flex: none; display: flex; gap: 0.28in; list-style: none; }
.g-step { flex: 1; display: flex; gap: 0.1in; align-items: flex-start; }
.g-num {
  display: flex; align-items: center; justify-content: center;
  flex: none; width: 0.26in; height: 0.26in; border-radius: 50%;
  background: ${PALETTE.paleSage}; color: ${PALETTE.sageDeep};
  font-family: "Cormorant Garamond", Georgia, serif; font-size: 12pt; font-weight: 600;
  font-variant-numeric: lining-nums;
  font-feature-settings: "lnum" 1;
}
.g-step-title { font-size: 9pt; font-weight: 600; }
.g-step-body { font-size: 8pt; line-height: 1.45; color: ${PALETTE.warmGray}; margin-top: 0.02in; }

.g-bullets { flex: none; columns: 2; column-gap: 0.36in; list-style: none; }
.g-bullet {
  font-size: 8.1pt; line-height: 1.48; color: ${PALETTE.warmGray};
  break-inside: avoid; margin-bottom: 0.085in; padding-left: 0.16in; position: relative;
}
.g-bullet::before {
  content: ""; position: absolute; left: 0; top: 0.055in;
  width: 0.045in; height: 0.045in; transform: rotate(45deg); background: ${PALETTE.sage};
}

.g-fixes { flex: none; columns: 2; column-gap: 0.36in; list-style: none; }
.g-fix { break-inside: avoid; margin-bottom: 0.12in; }
.g-problem { font-size: 8.6pt; font-weight: 600; color: ${PALETTE.charcoal}; }
.g-answer { font-size: 7.9pt; line-height: 1.45; color: ${PALETTE.warmGray}; margin-top: 0.03in; }

.g-foot {
  flex: none; margin-top: auto; padding-top: 0.18in;
  border-top: 1px solid ${PALETTE.rose}59;
  display: flex; align-items: baseline; justify-content: space-between; gap: 0.3in;
}
.g-foot .url { font-size: 9pt; }
.g-foot .note { font-size: 7.4pt; color: ${PALETTE.warmGray}; letter-spacing: 0.04em; }
`;

  return page({
    title: `${SITE.coupleNames} — upload guide`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet">
  <div class="g-head">
    <div class="g-head-text">
      <p class="kicker">${KICKER}</p>
      <h1 class="names">${NAMES}</h1>
      ${dateMarkup("11pt")}
      <h2 class="headline">Sharing your photos &amp; videos</h2>
      <p class="g-sub">Scan the code, or type the address into any browser. It works on any phone, with no app to install and nothing to sign in to.</p>
    </div>
    <div class="g-qr">
      <div class="qr-panel">${qrMarkup(qr)}</div>
      <p class="url">${urlMarkup(url)}</p>
    </div>
  </div>

  <div class="g-divider"></div>
  <h3 class="g-section-title">How it works</h3>
  <ul class="g-steps">${steps}</ul>

  <div class="g-divider"></div>
  <h3 class="g-section-title">Good to know</h3>
  <ul class="g-bullets">${guidelines}</ul>

  <div class="g-divider"></div>
  <h3 class="g-section-title">If something goes wrong</h3>
  <ul class="g-fixes">${troubleshooting}</ul>

  <div class="g-foot">
    <p class="url">${urlMarkup(url)}</p>
    <p class="note">${COPY.reassurance}</p>
  </div>
</div>`,
  });
}

/* ------------------------------------------------------- 7. NFC discs */

/**
 * A "tap" mark: a fingertip and three radiating arcs.
 *
 * Deliberately not the NFC Forum N-Mark, which is a trademark with its own
 * usage terms. A contactless-style wave reads the same to a guest and carries
 * no strings.
 */
function tapIcon() {
  return `<svg class="tap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" aria-hidden="true">
    <circle cx="6.5" cy="12" r="2.4" fill="currentColor" stroke="none"/>
    <path d="M12 8a5.6 5.6 0 0 1 0 8"/>
    <path d="M15.6 5a10.4 10.4 0 0 1 0 14"/>
    <path d="M19.2 2a15.2 15.2 0 0 1 0 20"/>
  </svg>`;
}

/**
 * Punch-out labels for 1in NFC discs, 35 to a sheet.
 *
 * No QR code here on purpose. At 1in a code for this URL would fall to roughly
 * 0.6mm per module with no room for a quiet zone, which is exactly the sort of
 * code that works on the designer's phone and on nobody else's. The disc does
 * one job, and the cards carry the scannable fallback.
 *
 * The disc sits on the same cream as the sheet, so there is no printed edge to
 * misalign: punch it a little off-centre and there is still nothing to give it
 * away. Only the inner ring and the type have to land inside the cut.
 */
export function nfcDiscSheet() {
  const COLUMNS = 5;
  const ROWS = 7;
  const PITCH = 1.3; // inches between disc centres, leaving room for a punch
  const left = (8.5 - COLUMNS * PITCH) / 2;
  const top = (11 - ROWS * PITCH) / 2;

  const disc = `<div class="disc">
    <span class="ring"></span>
    <span class="cut"></span>
    ${tapIcon()}
    <p class="tap-word">${escapeHtml(COPY.nfc.tap)}</p>
    ${ruleMarkup("0.42in")}
    <p class="tap-action">${escapeHtml(COPY.nfc.action)}</p>
  </div>`;

  const slots = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      slots.push(
        `<div class="slot" style="top:${(top + row * PITCH).toFixed(3)}in;left:${(left + col * PITCH).toFixed(3)}in">${disc}</div>`,
      );
    }
  }

  const css = `
.slot {
  position: absolute;
  width: ${PITCH}in; height: ${PITCH}in;
  display: flex; align-items: center; justify-content: center;
}

.disc {
  position: relative;
  width: 1.12in; height: 1.12in;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
}

/* The design's visible edge. Kept well inside the cut so a wobbly punch
   never clips it. */
.ring {
  position: absolute;
  top: 50%; left: 50%;
  width: 0.82in; height: 0.82in;
  margin: -0.41in 0 0 -0.41in;
  border: 1px solid ${PALETTE.rose}73;
  border-radius: 50%;
}

/* Punch guide at exactly 1in. Faint on purpose — punch just inside it and
   it disappears with the offcut. */
.cut {
  position: absolute;
  top: 50%; left: 50%;
  width: 1in; height: 1in;
  margin: -0.5in 0 0 -0.5in;
  border: 0.5px dashed ${PALETTE.rose}4d;
  border-radius: 50%;
}

.tap-icon {
  width: 0.185in; height: 0.185in;
  color: ${PALETTE.sageDeep};
  margin-bottom: 0.035in;
}

.tap-word {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: 15pt;
  font-weight: 600;
  line-height: 1;
  color: ${PALETTE.charcoal};
}

.disc .rule { margin: 0.045in 0; }

.tap-action {
  font-size: 6pt;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: ${PALETTE.warmGray};
  white-space: nowrap;
}
`;

  return page({
    title: `${SITE.coupleNames} — NFC tag discs`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet">${slots.join("")}</div>`,
  });
}

/* --------------------------------------------------- 8. NFC tag card 4x6 */

/**
 * The 4x6 card an NFC tag gets stuck onto, with instructions around it.
 *
 * The landing circle is 1.35in for a 1in tag, so an eighth of an inch of the
 * blush target still shows once the tag is down and the placement reads as
 * deliberate rather than approximate. "place tag here" sits inside it and
 * disappears under the tag.
 *
 * It carries a QR code as well, small and clearly secondary. NFC is not
 * universal — older iPhones need the reader in Control Centre and Android
 * phones need it switched on — and a guest holding a card that does nothing
 * has no way of knowing that is why. The code is the way out.
 *
 * @param {object} qr
 * @param {string} url
 * @param {{ perSheet: number, sheetWidth: number, sheetHeight: number }} layout
 */
function nfcCardMarkup(qr, url) {
  return `<div class="piece">
  <div class="frame"></div>
  <p class="kicker">${KICKER}</p>
  <h1 class="names">${NAMES}</h1>
  ${dateMarkup("10pt")}
  ${ruleMarkup("1.3in")}
  <h2 class="headline">${COPY.nfcCard.headline}</h2>

  <div class="target">
    <p class="target-hint">${COPY.nfcCard.hint}</p>
  </div>

  <p class="instruction">${COPY.nfcCard.instruction}</p>

  <div class="fallback">
    <p class="fallback-label">${COPY.nfcCard.fallbackLabel}</p>
    <div class="qr-panel">${qrMarkup(qr)}</div>
    <p class="url">${urlMarkup(url)}</p>
  </div>
</div>`;
}

const NFC_CARD_CSS = `
.piece {
  --u: 1.0; --qr: 1.25in;
  width: 4in; height: 6in;
  padding: 0.26in 0.34in;
  justify-content: center;
}
.piece .frame { inset: 0.17in; border-radius: 0.11in; }
.piece .kicker { font-size: 6.2pt; }
.piece .names { font-size: 28pt; margin-top: 0.06in; }
.piece .rule { margin: 0.1in 0; }
.piece .headline { font-size: 17pt; }

/* The tag's landing zone. Sized so a 1in tag leaves the target visible. */
.target {
  position: relative;
  flex: none;
  width: 1.35in; height: 1.35in;
  margin-top: 0.13in;
  border-radius: 50%;
  background: ${PALETTE.blush}8c;
  border: 1.5px dashed ${PALETTE.rose};
  display: flex;
  align-items: center;
  justify-content: center;
}
.target-hint {
  font-size: 6pt;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  text-indent: 0.14em;
  color: ${PALETTE.roseDeep};
}

.instruction {
  font-size: 8pt;
  line-height: 1.5;
  color: ${PALETTE.warmGray};
  margin-top: 0.14in;
  max-width: 2.8in;
}

.fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 0.16in;
  padding-top: 0.14in;
  border-top: 1px solid ${PALETTE.rose}59;
  width: 2.6in;
}
.fallback-label {
  font-size: 7.2pt;
  font-weight: 600;
  color: ${PALETTE.charcoal};
}
.fallback .qr-panel { flex: none; margin-top: 0.09in; }
.fallback .url { font-size: 8.4pt; margin-top: 0.09in; }
`;

/** One card on a true 4in x 6in page — what a photo lab wants. */
export function nfcCard4x6Sheet(qr, url) {
  return page({
    title: `${SITE.coupleNames} — NFC tag card`,
    width: "4in",
    height: "6in",
    css: PIECE_CSS + NFC_CARD_CSS,
    body: `<div class="sheet">${nfcCardMarkup(qr, url)}</div>`,
  });
}

/** The same card, two to a US Letter sheet, for printing at home. */
export function nfcCardLetterSheet(qr, url) {
  const card = nfcCardMarkup(qr, url);
  // Two 4in cards side by side leave a quarter inch of margin either side.
  const top = (11 - 6) / 2;
  const left = (8.5 - 2 * 4) / 2;

  const css = `
${NFC_CARD_CSS}
.slot { position: absolute; width: 4in; height: 6in; }
`;

  return page({
    title: `${SITE.coupleNames} — NFC tag cards, 2 per sheet`,
    width: "8.5in",
    height: "11in",
    css: PIECE_CSS + css,
    body: `<div class="sheet">
  <div class="slot" style="top:${top}in;left:${left}in">${card}</div>
  <div class="slot" style="top:${top}in;left:${left + 4}in">${card}</div>
  <div class="cut-line v" style="left:${left}in;top:${top}in;bottom:${top}in"></div>
  <div class="cut-line v" style="left:${left + 4}in;top:${top}in;bottom:${top}in"></div>
  <div class="cut-line v" style="left:${left + 8}in;top:${top}in;bottom:${top}in"></div>
  <div class="cut-line h" style="top:${top}in;left:${left}in;right:${left}in"></div>
  <div class="cut-line h" style="top:${top + 6}in;left:${left}in;right:${left}in"></div>
</div>`,
  });
}

/** Everything in the set, in the order the files are numbered. */
export const PIECES = [
  // `qrInches` is the printed edge of the QR square (including its quiet zone).
  // generate.mjs turns it into a per-module size so an over-long URL that
  // pushes the symbol to a denser version can't quietly become unscannable.
  { slug: "01-sign-8.5x11", label: "Full-page sign (1 per sheet)", qrInches: 2.55, render: signSheet },
  { slug: "02-table-tent", label: "Fold-in-half table tent (1 per sheet)", qrInches: 1.75, render: tableTentSheet },
  { slug: "03-cards-half-page", label: "Half-page cards, 8.5 x 5.5in (2 per sheet)", qrInches: 2.5, render: halfPageSheet },
  { slug: "04-cards-quarter-page", label: "Quarter-page cards, 4.25 x 5.5in (4 per sheet)", qrInches: 1.75, render: quarterPageSheet },
  { slug: "05-mini-tags", label: "Mini tags, 4.25 x 2.75in (8 per sheet)", qrInches: 1.4, render: miniTagSheet },
  { slug: "06-guide-8.5x11", label: "Upload guide & troubleshooting (1 per sheet)", qrInches: 1.6, render: guideSheet },
  // No QR: see nfcDiscSheet() for why a code this small would be a liability.
  { slug: "07-nfc-discs", label: "1in NFC tag discs (35 per sheet)", qrInches: null, render: nfcDiscSheet },
  { slug: "08-nfc-card-4x6", label: "NFC tag card, 4 x 6in page (1 per page)", qrInches: 1.25,
    widthIn: 4, heightIn: 6, render: nfcCard4x6Sheet },
  { slug: "09-nfc-card-4x6-letter", label: "NFC tag card, 4 x 6in (2 per US Letter sheet)", qrInches: 1.25,
    render: nfcCardLetterSheet },
];

/** Quiet zone in modules, matching the default passed to qrToSvg(). */
export const QR_QUIET_ZONE = 4;
