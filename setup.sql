-- =============================================================================
-- Mark & Nichole Wedding — Supabase setup
-- Run this whole file in the Supabase Dashboard -> SQL Editor.
-- It is safe to re-run (idempotent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Storage bucket: public `wedding-media` with a 500 MB per-file limit.
--    (You can also create this in Dashboard -> Storage -> New bucket; this SQL
--     does the same thing and sets the size limit to 524288000 bytes = 500 MB.)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('wedding-media', 'wedding-media', true, 524288000)
on conflict (id) do update
  set public = true,
      file_size_limit = 524288000;

-- -----------------------------------------------------------------------------
-- 2. Metadata table + Row Level Security.
-- -----------------------------------------------------------------------------
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  uploader_name text,
  media_type text not null check (media_type in ('image', 'video')),
  poster_path text,
  created_at timestamptz not null default now()
);

-- Helpful index for newest-first paging.
create index if not exists uploads_created_at_idx
  on public.uploads (created_at desc);

alter table public.uploads enable row level security;

drop policy if exists "anon can read uploads" on public.uploads;
create policy "anon can read uploads"
  on public.uploads for select to anon using (true);

drop policy if exists "anon can insert uploads" on public.uploads;
create policy "anon can insert uploads"
  on public.uploads for insert to anon with check (true);

-- -----------------------------------------------------------------------------
-- 3. Storage object policies: anon may upload to and read from the bucket.
-- -----------------------------------------------------------------------------
drop policy if exists "anon upload to wedding-media" on storage.objects;
create policy "anon upload to wedding-media"
  on storage.objects for insert to anon
  with check (bucket_id = 'wedding-media');

drop policy if exists "anon read wedding-media" on storage.objects;
create policy "anon read wedding-media"
  on storage.objects for select to anon
  using (bucket_id = 'wedding-media');

-- -----------------------------------------------------------------------------
-- 4. Enable Realtime on public.uploads (add it to the realtime publication).
--    Wrapped so re-running doesn't error if it's already a member.
-- -----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.uploads;
exception
  when duplicate_object then null;
end $$;
