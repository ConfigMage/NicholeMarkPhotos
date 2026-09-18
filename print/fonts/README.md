# Bundled fonts

The print set embeds these as base64 so a rendered sheet needs no network and
looks identical on every machine. Both are the **latin subset** of the variable
font, pulled from Google Fonts.

| File | Family | Licence |
|---|---|---|
| `CormorantGaramond-latin.woff2` | Cormorant Garamond (roman, weights 300–700) | SIL OFL 1.1 — see `OFL-CormorantGaramond.txt` |
| `CormorantGaramond-Italic-latin.woff2` | Cormorant Garamond (italic, weights 300–700) | SIL OFL 1.1 — see `OFL-CormorantGaramond.txt` |
| `Inter-latin.woff2` | Inter (weights 100–900) | SIL OFL 1.1 — see `OFL-Inter.txt` |

These are the same two families the site loads in `src/app/layout.tsx`, so the
printed pieces and the web page share one voice.

To refresh them, grab the latin `@font-face` sources from:

```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400..700;1,400&family=Inter:wght@400..700
```

Request it with a modern browser user-agent (otherwise Google serves older
static formats), then download the `woff2` whose `unicode-range` starts at
`U+0000-00FF` and save it over the file above.
