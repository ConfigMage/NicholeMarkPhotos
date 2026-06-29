# Mark &amp; Nichole — Wedding Photo &amp; Video Upload

A mobile-first web app where wedding guests scan a QR code, optionally enter
their first name, and upload photos &amp; videos straight from their phones.
Uploads appear in a **live shared gallery** in real time. No guest login.

- **Frontend:** Next.js (App Router, TypeScript) + Tailwind CSS, deployed on **Vercel**
- **Backend:** **Supabase** Storage (resumable/TUS uploads), Postgres (metadata), Realtime (live gallery)
- **Uploads go browser → Supabase directly** (never through a Vercel function — those cap bodies at ~4.5 MB)

---

## 1. Supabase setup (do this by hand, once)

Create a Supabase project (Pro plan — needed for the image-transformation
thumbnails), then:

### a. Run the SQL

1. Open **Supabase Dashboard → SQL Editor → New query**.
2. Paste the entire contents of [`setup.sql`](./setup.sql) and **Run**.

That single script:

- Creates the **public** Storage bucket `wedding-media` with a **500 MB**
  per-file limit (`524288000` bytes).
- Creates the `public.uploads` metadata table and its RLS policies
  (anon can read &amp; insert).
- Creates the Storage object policies (anon can upload to &amp; read from the bucket).
- Adds `public.uploads` to the `supabase_realtime` publication (enables the live gallery).

### b. Verify in the dashboard

- **Storage:** you should see a `wedding-media` bucket, marked **Public**, with a
  500 MB file size limit. (If you prefer, you can create the bucket here manually
  instead of via SQL — same result.)
- **Database → Replication / Publications:** confirm `uploads` is part of
  `supabase_realtime`. (The SQL does this; this is just a sanity check.)
- **Authentication is NOT required** — guests are anonymous.

### c. Grab your API keys

**Dashboard → Project Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> ⚠️ Never use the **service_role** key in this app. It is not needed anywhere
> client-side, and exposing it would bypass all security.

---

## 2. Environment variables

Only two, both public (`NEXT_PUBLIC_*`):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL, e.g. `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon public key |

### Local development (`.env.local`)

```bash
cp .env.local.example .env.local
# then edit .env.local and paste your two values
```

### Vercel

In your Vercel project → **Settings → Environment Variables**, add both
variables for **Production, Preview, and Development**, then redeploy:

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = <your anon public key>
```

---

## 3. Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## 4. Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. **Import the project** at [vercel.com/new](https://vercel.com/new) — it
   auto-detects Next.js; no build settings to change.
3. Add the two environment variables (above).
4. Deploy. Make a QR code that points at the deployed URL and print it for the
   tables.

---

## How it works

- **Upload flow** (`src/lib/upload.ts`, `src/components/UploadSection.tsx`):
  - Optional first name, persisted to `localStorage`.
  - Multi-file picker (`image/*,video/*`), drag-and-drop on desktop.
  - HEIC/HEIF photos are converted to JPEG in the browser with `heic2any`
    (dynamic import) so the gallery can render them.
  - Files &gt; 500 MB are rejected inline.
  - Each file uploads via **`tus-js-client`** to Supabase's resumable endpoint
    `…/storage/v1/upload/resumable` with the **mandatory 6 MB chunk size**.
    Uploads auto-resume after a dropped connection. Up to 3 run concurrently.
  - Videos get a best-effort client-generated poster thumbnail
    (`<video>` → `<canvas>` → JPEG), uploaded as `<path>.poster.jpg`. If that
    fails on a flaky mobile codec, the gallery shows a play-icon tile instead.
  - On success, a row is inserted into `public.uploads`.
- **Live gallery** (`src/components/Gallery.tsx`):
  - Loads newest-first with a **Load more** button (keyset pagination).
  - Subscribes to Supabase Realtime (`postgres_changes` INSERT) and prepends new
    items live.
  - Grid thumbnails use Supabase's **image transformation** endpoint (~400px);
    full-res is only loaded in the lightbox.
  - Tap a tile for a lightbox: full image or `<video controls>`, the uploader's
    name, a **Download** button, and swipe / arrow-key navigation.

---

## Security note (please read)

The **anon key is public by design** — it ships in the browser. The security
boundary is **Row Level Security**, and these policies intentionally allow
**anyone with the link to upload and to view** the gallery. That's appropriate
for a private wedding link shared on table cards, but be aware:

- Anyone who obtains the URL can upload or see photos.
- There is **no moderation / admin UI** in this version (by design). The couple
  manages and downloads everything from the **Supabase dashboard** (Storage +
  Table editor).

If you ever need to lock it down further, do it with stricter RLS policies in
Supabase — not by hiding the anon key.
