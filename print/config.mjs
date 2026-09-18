/**
 * What the printed pieces say, and where they point.
 *
 * The couple's names are read out of `src/lib/site.ts` so the print set and the
 * website can't drift apart. Everything else is print-only copy.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The address the QR codes point at. Override per-run with the first CLI
 * argument or the `PRINT_URL` environment variable — useful if the site later
 * moves to a custom domain.
 */
export const DEFAULT_URL = "https://nichole-mark-photos.vercel.app";

/** Pull a string field out of `src/lib/site.ts` without needing a TS toolchain. */
function readSiteField(source, field, fallback) {
  // Matches `field: "value"` / `field: 'value'`, including a wrapped value.
  const pattern = new RegExp(`${field}\\s*:\\s*(?:\\n\\s*)?(["'])((?:\\\\.|[^\\\\])*?)\\1`);
  const match = source.match(pattern);
  if (!match) {
    console.warn(
      `[print] Could not read SITE.${field} from src/lib/site.ts — using "${fallback}".`,
    );
    return fallback;
  }
  return match[2].replace(/\\(["'\\])/g, "$1");
}

function loadSite() {
  const fallback = { coupleNames: "Mark & Nichole", kicker: "We're so glad you're here", date: "" };
  let source;
  try {
    source = readFileSync(join(here, "..", "src", "lib", "site.ts"), "utf8");
  } catch {
    console.warn("[print] src/lib/site.ts not found — using built-in defaults.");
    return fallback;
  }
  return {
    coupleNames: readSiteField(source, "coupleNames", fallback.coupleNames),
    kicker: readSiteField(source, "kicker", fallback.kicker),
    // An empty date is the site's way of hiding it; the print set follows suit.
    date: readSiteField(source, "date", fallback.date),
  };
}

export const SITE = loadSite();

/** Shared print copy. Kept short — venue pieces are read at a glance. */
export const COPY = {
  headline: "Share your photos",
  headlineLong: "Share your photos &amp; videos",
  subhead: "Scan the code with your phone camera.",
  reassurance: "No app. No sign-in. Just your camera.",

  /**
   * The 1in NFC disc. Every word here has to earn its place at that size.
   * Read across the rule it says "Tap me to upload". A longer second line
   * runs into the ring, where the circle has already started to narrow.
   */
  nfc: {
    tap: "Tap me",
    action: "to upload",
  },

  steps: [
    { title: "Point your camera", body: "Open the Camera app and hold it over the code. Tap the link that pops up." },
    { title: "Add your photos", body: "Tap <em>Add photos &amp; videos</em> and pick as many as you like." },
    { title: "Watch them land", body: "They appear in our live gallery within seconds, for everyone to see." },
  ],

  guidelines: [
    "Photos and videos are both welcome, up to 500&nbsp;MB each.",
    "Pick several at once. Three upload at a time so the venue wifi keeps up.",
    "Keep the page open until every bar reads <strong>Done</strong>.",
    "Your first name is optional. It just labels what you share.",
    "iPhone photos are converted automatically. That is the <em>Converting…</em> step.",
    "Everything shared is visible to every guest with this link, and downloadable from the gallery.",
    "The link stays live. Add more tonight, tomorrow, or next week.",
  ],

  troubleshooting: [
    {
      problem: "My camera will not pick up the code",
      fix: "Use the built-in Camera app, hold steady about a hand's width away, and make sure the whole code is in frame. Or just type the address into any browser.",
    },
    {
      problem: "The progress bar is stuck or crawling",
      fix: "Venue wifi gets crowded. Leave the page open and it keeps going on its own. If it will not budge, switch wifi off and use cell data.",
    },
    {
      problem: "It says <strong>Failed</strong>",
      fix: "Tap <em>Add photos &amp; videos</em> and choose the same file again. It picks up from where it stopped rather than starting over.",
    },
    {
      problem: "It says <strong>Too large. Max is 500&nbsp;MB.</strong>",
      fix: "That video is over the limit. Trim it in your Photos app and share the shorter clip.",
    },
    {
      problem: "I closed the tab before it finished",
      fix: "Open the link again on the same phone and re-pick those files. Anything already sent is safe.",
    },
    {
      problem: "My photo is not in the gallery",
      fix: "Pull down to refresh the page. New uploads normally appear on their own within a few seconds.",
    },
    {
      problem: "My video shows a play button, not a preview",
      fix: "Normal. Some phones will not hand over a preview frame. The video itself plays fine when tapped.",
    },
    {
      problem: "Nothing loads at all",
      fix: "Check that you are connected to wifi or cell data, then reload. Still stuck? Grab someone from the wedding party.",
    },
  ],
};

/** Human-readable form of the link, for people who would rather type it. */
export function displayUrl(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
