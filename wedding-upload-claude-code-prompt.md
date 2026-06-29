# Claude Code Prompt — Wedding Photo & Video Upload Site

Build a mobile-first web app where wedding guests scan a QR code, optionally enter their first name, and upload photos and videos directly from their phones. Uploads appear in a **live shared gallery** in real time. No guest login. Deploy target is **Vercel**; storage and data are on **Supabase (Pro plan)**.

## Stack
- **Next.js** (App Router, TypeScript), deployed on Vercel
- **Supabase**: Storage (resumable/TUS uploads), Postgres (metadata), Realtime (live gallery)
- Client libs: `@supabase/supabase-js`, `tus-js-client` (resumable uploads), `heic2any` (HEIC→JPEG, dynamic import, browser-only)
- **Tailwind CSS**. Warm, celebratory, mobile-first design that holds up on a phone over weak venue wifi. Follow the palette in **Visual design** below.

## Visual design & color palette
Soft, romantic, airy wedding aesthetic — **dusty rose, sage green, and soft pastels** on a warm off-white background, with lots of whitespace and gentle rounded corners. Elegant but not fussy; it should feel celebratory and read instantly on a phone.

Use these as the Tailwind theme tokens (extend `theme.colors`); nudge shades slightly if you need more contrast, but keep the family:

| Role | Color | Hex |
|---|---|---|
| Background | warm off-white / cream | `#FAF6F1` |
| Surface / cards | soft white | `#FFFFFF` |
| Primary accent | dusty rose | `#C9A0A4` |
| Primary accent (deep — buttons/hover) | muted rose | `#B07E84` |
| Secondary accent | sage green | `#9CAF94` |
| Supporting pastel 1 | blush | `#F3DCDC` |
| Supporting pastel 2 | pale sage | `#DCE6D5` |
| Text (primary) | soft charcoal | `#403A38` |
| Text (muted) | warm gray | `#8A817C` |

Guidance:
- **Buttons / primary actions:** dusty rose fill, white text, deep-rose on hover/active. Upload progress bars in sage green.
- **Backgrounds:** cream base; use the blush and pale-sage pastels for subtle section tints, empty states, and the upload drop-zone — never as large saturated blocks.
- **Typography:** a refined serif for headings (couple's names, section titles) paired with a clean sans-serif for body and UI. Light and spacious.
- **Gallery tiles:** soft rounded corners, gentle shadow, a thin blush or sage hairline border. No harsh black borders or pure-black text anywhere — use the soft charcoal.
- Keep it uncluttered; the photos are the star.

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The service-role key is **never** used client-side. The couple manages and downloads everything via the Supabase dashboard, so this app needs no admin UI.

## Supabase setup
Generate a `setup.sql` file containing everything below, and document the manual dashboard steps in the README.

1. Create a **public** Storage bucket named `wedding-media` with a per-file size limit of **500 MB** (`524288000` bytes).
2. Metadata table + RLS:
```sql
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  uploader_name text,
  media_type text not null check (media_type in ('image','video')),
  poster_path text,
  created_at timestamptz not null default now()
);

alter table public.uploads enable row level security;

create policy "anon can read uploads"
  on public.uploads for select to anon using (true);

create policy "anon can insert uploads"
  on public.uploads for insert to anon with check (true);
```
3. Storage object policies (anon upload + read within the bucket):
```sql
create policy "anon upload to wedding-media"
  on storage.objects for insert to anon
  with check (bucket_id = 'wedding-media');

create policy "anon read wedding-media"
  on storage.objects for select to anon
  using (bucket_id = 'wedding-media');
```
4. Enable **Realtime** on `public.uploads` (add the table to the `supabase_realtime` publication).

## Upload flow — client-side, direct browser → Supabase

**Critical constraint:** Vercel serverless functions cap request bodies at ~4.5 MB. Do **not** route file bytes through any Next.js API route. All transfer is browser → Supabase Storage directly.

1. Optional first-name text input; persist to `localStorage` so repeat uploaders don't retype it.
2. Multi-file picker: `accept="image/*,video/*"`, multiple selection allowed.
3. For each selected file:
   - If HEIC/HEIF (check type/extension), convert to JPEG with `heic2any` (dynamic import).
   - Reject files > 500 MB with a friendly inline message.
   - Upload via `tus-js-client` to the Supabase resumable endpoint:
     - Endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`
     - Headers: `authorization: Bearer ${ANON_KEY}`, `x-upsert: true`
     - **`chunkSize` must be exactly 6 MB (`6 * 1024 * 1024`)** — Supabase's TUS implementation requires this exact value.
     - tus metadata: `bucketName: 'wedding-media'`, `objectName`, `contentType`, `cacheControl: '3600'`
     - Object path: `${crypto.randomUUID()}-${sanitizedFilename}` to avoid collisions.
     - Render a per-file progress bar from tus `onProgress`. tus auto-resumes after a dropped connection.
   - **Video poster:** attempt to generate a thumbnail client-side (hidden `<video>` seeked to ~1s → `<canvas>` → JPEG blob), uploaded as `${path}.poster.jpg`. If generation fails (mobile flakiness), skip it and fall back to a video tile with a play-icon overlay.
   - On storage success, insert a row into `uploads` (`storage_path`, `uploader_name` or null, `media_type`, `poster_path` or null).
4. Handle queued/concurrent uploads gracefully with overall + per-file progress and a clear success state.

## Live gallery
- On load, fetch recent uploads newest-first; paginate with a "Load more" control.
- Subscribe to Supabase Realtime `postgres_changes` (INSERT on `uploads`) and prepend new items live.
- Thumbnails via Supabase's **image transformation** endpoint (Pro feature) — request resized images (~400px wide) for grid tiles; load full-res only in the lightbox. Videos show their poster, or a play-icon tile if none.
- Responsive masonry/grid, lazy-loaded images.
- Lightbox on tap: full-res image or `<video controls>`, the uploader's first name if present, and a Download button (anchor to the public object URL with the `download` attribute). Swipe/arrow navigation between items is a nice-to-have.

## Constraints & gotchas to respect
- All uploads go browser → Supabase via TUS. Never proxy file bytes through Vercel functions.
- HEIC **must** be converted client-side or it won't render in the shared gallery.
- The 6 MB tus chunk size is mandatory for Supabase.
- The anon key is public by design; RLS policies are the security boundary. Note in the README that anon-insert means anyone with the link can upload — acceptable for a private wedding, but flag it.
- No moderation or admin UI in this version. The couple manages and downloads via the Supabase dashboard.

## Deliverables
- A working Next.js app, deployable to Vercel as-is.
- `setup.sql` with all SQL above, plus a README section listing the manual Supabase steps (create bucket + 500 MB limit, run SQL, enable Realtime) and the required env vars.
- A `CLAUDE.md` capturing project context, key decisions, and how to run/deploy, for session continuity.

When done, give me the exact Supabase dashboard steps to do by hand, and what to put in `.env.local` and in Vercel's environment variables.
