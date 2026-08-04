-- =============================================================
-- Studio OS — Bucket 1: Foundation (storage)
--
-- The studio logo bucket.
--
-- Public read, because the client-facing pages in later buckets
-- (booking page, client portal, questionnaire) show the designer's
-- logo to people who are not signed in.
--
-- Writes are locked to `{workspace_id}/...`, owners only, so a
-- workspace can only ever write inside its own folder.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('studio-logos', 'studio-logos', true)
on conflict (id) do nothing;


create policy "studio_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'studio-logos');


create policy "studio_logos_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'studio-logos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
    and public.is_owner()
  );


create policy "studio_logos_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'studio-logos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
    and public.is_owner()
  );


create policy "studio_logos_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'studio-logos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
    and public.is_owner()
  );
