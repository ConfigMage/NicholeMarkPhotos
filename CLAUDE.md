# CLAUDE.md — project context for Mark &amp; Nichole Wedding upload app

## What this is
A mobile-first Next.js (App Router, TS) site for wedding guests to upload photos
&amp; videos from their phones into a **live shared gallery**. No guest auth.
Deploy target: **Vercel**. Storage/DB/Realtime: **Supabase (Pro)**.

## Hard constraints (don't regress these)
- **All file bytes go browser → Supabase directly.** Never proxy uploads through
  a Next.js API route / Vercel function — Vercel caps request bodies at ~4.5 MB.
  Uploads use `tus-js-client` against `…/storage/v1/upload/resumable`.
- **TUS `chunkSize` must be exactly `6 * 1024 * 1024` (6 MB).** Supabase's TUS
  implementation requires this exact value; changing it breaks uploads.
- **HEIC/HEIF must be converted to JPEG client-side** (`heic2any`, dynamic import,
  browser-only) or the gallery can't render iOS photos.
- **Service-role key is never used.** Only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. RLS is the security boundary; anon insert/read
  is intentional for a private wedding link.
- **Thumbnails use Supabase image transformation** (`getPublicUrl(..., { transform })`,
  a Pro feature). Full-res is only loaded in the lightbox.

## Layout
```
setup.sql                      All Supabase SQL (bucket, table, RLS, realtime). Idempotent.
src/lib/supabase.ts            Shared browser client + isConfigured + BUCKET name.
src/lib/storage.ts             publicUrl / thumbUrl (transform) / downloadUrl helpers.
src/lib/upload.ts              HEIC convert, poster gen, TUS upload, poster upload, row insert.
src/lib/site.ts               EDIT ME: couple names, kicker, date, tagline (display only).
src/lib/types.ts              UploadRow / MediaType.
src/app/layout.tsx            Fonts (Cormorant Garamond serif + Inter sans), metadata.
src/app/page.tsx              Composes Header + Upload + Gallery; shows ConfigNotice if env missing.
src/components/UploadSection.tsx  Name input, picker/drop-zone, concurrency-3 queue, progress.
src/components/Gallery.tsx        Keyset pagination + Realtime INSERT subscription + masonry tiles.
src/components/Lightbox.tsx       Full-res / video, name, download, swipe + arrow-key nav.
print/qr.mjs                   Dependency-free QR encoder (byte mode, RS ECC, masking).
print/config.mjs               EDIT ME: the URL the codes point at + all print copy.
print/theme.mjs                Print palette/type, mirrored from tailwind.config.ts.
print/pieces.mjs               The six venue layouts, sized in real inches.
print/generate.mjs             Renders each piece to PDF via headless Chrome.
print/out/*.pdf                Generated, committed. `npm run print` rebuilds them.
```

## Key decisions
- **Plain `<img loading="lazy">`, not `next/image`.** Supabase transform URLs are
  dynamic and cross-origin; plain img avoids remotePatterns config and image-opt
  cost while still being lazy.
- **Realtime is the single source for adding new tiles.** The uploader does NOT
  optimistically insert into the gallery; the inserted row comes back over
  Realtime. Everything is **deduped by `id`**, so a missed/duplicated event is safe.
- **Keyset pagination** (`created_at < oldest`) instead of offset, so live inserts
  at the top don't shift the "Load more" window.
- **Poster generation is best-effort** and resolves to `null` on any failure;
  videos without a poster render a play-icon placeholder tile.
- **Couple names / date / tagline live in `src/lib/site.ts`** — change them there.
  `SITE.date` is empty by default; set it (e.g. "September 12, 2026") to show it.
- **The print set has no npm dependencies** and must stay that way — the couple
  needs to regenerate these PDFs on any laptop, years later, without a registry.
  `print/config.mjs` reads the names out of `src/lib/site.ts` (regex, with a
  loud fallback) so the cards and the site can't drift apart.
- **Printed QR codes are pure black on white with a 4-module quiet zone.** Don't
  tint them, don't put them on the cream background, don't shrink the quiet
  zone — each of those costs scan reliability in dim venue light.

## Env / run / deploy
- Local: `cp .env.local.example .env.local`, fill 2 vars, `npm install`, `npm run dev`.
- Supabase: run `setup.sql` in SQL Editor; confirm `wedding-media` bucket is public
  with a 500 MB limit and `uploads` is in the `supabase_realtime` publication.
- Vercel: import repo (auto-detects Next.js), add the 2 `NEXT_PUBLIC_*` env vars
  for all environments, deploy. Point a QR code at the deployed URL.

## Not in scope (intentionally)
- No moderation, no admin UI, no guest accounts. The couple manages/downloads via
  the Supabase dashboard.
