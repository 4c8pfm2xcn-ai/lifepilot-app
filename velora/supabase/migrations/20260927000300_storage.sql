-- Velora storage: three private buckets. Objects live under "<user_id>/..." prefixes.
-- The server creates signed URLs (short-lived) after verifying ownership, so no bucket is public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('input-images', 'input-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('generated-videos', 'generated-videos', false, 52428800, array['video/mp4']),
  ('thumbnails', 'thumbnails', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users may read objects in their own folder (defence in depth; the app uses server-side signed URLs).
create policy "velora_read_own_objects" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('input-images', 'generated-videos', 'thumbnails')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Uploads from the browser happen through server-issued signed upload URLs
-- (createSignedUploadUrl), which bypass RLS for that single path. Direct inserts
-- are only allowed into the user's own folder of the image buckets.
create policy "velora_insert_own_images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('input-images', 'thumbnails')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "velora_delete_own_objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('input-images', 'generated-videos', 'thumbnails')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
