# Venue print set

QR cards, signs and a troubleshooting sheet that point guests at the upload
site, in the same palette and type as the site itself.

Everything is in [`out/`](./out), ready to print. All six are **US Letter**, so
any home or office printer will do.

---

## What's in the set

| File | What it is | Per sheet | Where it goes |
|---|---|---|---|
| `01-sign-8.5x11.pdf` | Full-page sign with the three steps spelled out | 1 | An easel or frame by the entrance, the guest book, the welcome table |
| `02-table-tent.pdf` | Fold-in-half tent, reads from both sides | 1 | Gift table, bar, dessert table, anywhere it needs to be seen across a room |
| `03-cards-half-page.pdf` | 8.5 × 5.5in cards | 2 | Cocktail tables, the bar top, the photo booth |
| `04-cards-quarter-page.pdf` | 4.25 × 5.5in cards | 4 | One per dinner table, next to the centrepiece |
| `05-mini-tags.pdf` | 4.25 × 2.75in tags | 8 | Tucked into favours, restroom baskets, the guest book, place settings |
| `06-guide-8.5x11.pdf` | Upload guidelines and troubleshooting | 1 | Welcome table, the bar, next to whoever is fielding questions |

Assembly:

- **`02-table-tent`** — fold once across the middle, on the marked line. The
  upper half prints upside down on purpose, so both faces read correctly once
  it is folded. No cutting.
- **`03`, `04`, `05`** — cut along the hairlines. Each card has its own inset
  frame set well inside the trim, so a slightly crooked cut still looks right.
- **`01`, `06`** — print and go.

---

## Printing

- **Print at 100% / Actual size.** Not "Fit to page" — that shrinks the QR codes
  and nudges the cut lines off the marks.
- Heavier stock (32 lb / 120 gsm or card) holds up far better on a table than
  copier paper, and the table tent needs it to stand.
- **Matte, not glossy.** Gloss throws venue light straight back into the phone
  camera and is the single most common reason a code will not scan.
- Colour, obviously, and leave "background graphics" on if your print dialog
  asks. The cream background is part of the design.

### Before you print a hundred of them

1. Print **one** sheet.
2. Scan it with an actual phone, in light like the venue's.
3. Check the page that opens is the real upload site, then upload one photo end
   to end.

Two minutes now beats a stack of cards pointing at a dead link.

---

## Regenerating

Needed only if the address changes, or the names or wording do.

```bash
node print/generate.mjs                          # rebuild with the current URL
node print/generate.mjs https://your-domain.com   # point the codes somewhere else
npm run print                                     # same as the first one
```

Useful flags:

| Flag | Effect |
|---|---|
| `--out <dir>` | Write the PDFs somewhere other than `print/out` |
| `--png` | Also write a PNG of each sheet, for a quick look without opening a PDF |
| `--keep-html` | Keep the intermediate HTML, for hand-tweaking a one-off |
| `--chrome <path>` | Use a specific Chrome/Chromium binary |

The generator prints the QR version and the printed size of one module for each
piece, and warns if a piece drops below **0.6 mm per module**, which is roughly
where phone cameras start to struggle. A longer URL needs a denser code, so if
you move to a long custom domain, check that line rather than assuming.

**Requirements:** Node 18+ and a Chrome, Chromium or Edge install. No
`npm install` — the QR encoder is in `qr.mjs` and the fonts are in `fonts/`.

### Changing the wording

- **Names, greeting, date** live in [`src/lib/site.ts`](../src/lib/site.ts), the
  same file the website reads. Change them once, re-run, and the site and the
  print set stay in step. (Set `SITE.date` and it appears on the cards too.)
- **Everything else** — the steps, the guidelines, the troubleshooting answers —
  is in [`config.mjs`](./config.mjs).
- **Colours and type** are in [`theme.mjs`](./theme.mjs), mirrored from
  `tailwind.config.ts`.

---

## How it is built

| File | Job |
|---|---|
| `qr.mjs` | Dependency-free QR encoder (ISO/IEC 18004, byte mode, Reed-Solomon, the eight masks) |
| `config.mjs` | The URL and all the print copy; reads the names out of `src/lib/site.ts` |
| `theme.mjs` | Palette, embedded fonts, shared stylesheet |
| `pieces.mjs` | The six layouts, sized in real inches |
| `generate.mjs` | Renders each piece to PDF through headless Chrome |

The QR codes are **vector paths**, not images, so they stay sharp at any size a
print shop enlarges them to. The codes use **quartile** error correction, which
tolerates a quarter of the symbol being damaged — enough to survive an evening
of being handled at a dinner table.
