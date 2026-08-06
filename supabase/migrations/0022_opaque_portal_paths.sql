-- =============================================================
-- Studio OS — remove the workspace and project ids from anything
-- the client portal can see.
--
-- Found by inspecting the portal response field by field. The ids
-- were never returned as keys, but they were embedded in two values
-- the client legitimately needs:
--
--   upload_prefix  {workspace_id}/{portal_token}
--   files[].path   {workspace_id}/{project_id}/{filename}
--
-- Measured impact was nil — RLS keys off current_workspace_id() from
-- the JWT, never off client input, and every probe with the leaked
-- ids returned empty. But an identifier the client has no use for
-- should not be in their hands at all, so the storage layout stops
-- encoding it.
--
--   receipts from the portal → {portal_token}/receipt-…
--   project files            → {opaque uuid}/{filename}
--
-- Booking receipts keep their existing shape; nothing about the
-- Bucket 5 flow changes.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Receipt uploads: accept the portal's token-first path too
-- -------------------------------------------------------------

create or replace function public.receipt_upload_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Booking page: {workspace_id}/{booking_token}/…
  select exists (
    select 1
    from public.bookings b
    where b.workspace_id::text = split_part(object_name, '/', 1)
      and b.public_token::text = split_part(object_name, '/', 2)
      and b.status <> 'cancelled'
  )
  -- Portal: {portal_token}/… — the token is already the client's own
  -- secret, so the path discloses nothing they do not hold.
  or exists (
    select 1
    from public.portal_links l
    where l.token = split_part(object_name, '/', 1)
      and l.is_active
      and l.revoked_at is null
  );
$$;

revoke execute on function public.receipt_upload_allowed(text) from public;
grant  execute on function public.receipt_upload_allowed(text) to anon, authenticated;


create or replace function public.portal_attach_receipt(p_token text, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid     uuid := public.resolve_portal_token(p_token);
  proj    public.projects%rowtype;
  invoice uuid;
begin
  if pid is null then
    raise exception 'this link is no longer active';
  end if;

  -- The path must sit under this booking's own token, and nothing else.
  if split_part(p_path, '/', 1) <> p_token then
    raise exception 'that file does not belong to this project';
  end if;

  select * into proj from public.projects where id = pid;

  select id into invoice from public.invoices
  where project_id = pid and status <> 'draft'
  order by created_at desc limit 1;

  if invoice is null then
    raise exception 'there is no invoice to pay yet';
  end if;

  insert into public.receipts (workspace_id, invoice_id, file_url)
  values (proj.workspace_id, invoice, p_path);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.portal_attach_receipt(text, text) from public;
grant  execute on function public.portal_attach_receipt(text, text) to anon, authenticated;


-- -------------------------------------------------------------
-- 2. Project files: authorise through the files table, not the path
--
-- The path no longer says which workspace an object belongs to, so
-- the owner policies ask the files table instead. The row is written
-- before the object is uploaded, so the INSERT policy has something
-- to check against.
-- -------------------------------------------------------------

drop policy if exists "project_files_owner_read"   on storage.objects;
drop policy if exists "project_files_owner_write"  on storage.objects;
drop policy if exists "project_files_owner_delete" on storage.objects;

create policy "project_files_owner_read" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.files f
      where f.file_url = name
        and f.workspace_id = public.current_workspace_id()
    )
  );

create policy "project_files_owner_write" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.files f
      where f.file_url = name
        and f.workspace_id = public.current_workspace_id()
    )
  );

create policy "project_files_owner_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.files f
      where f.file_url = name
        and f.workspace_id = public.current_workspace_id()
    )
  );


-- -------------------------------------------------------------
-- 3. The portal stops handing out the workspace id
-- -------------------------------------------------------------

create or replace function public.portal_project(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pid   uuid := public.resolve_portal_token(p_token);
  proj  public.projects%rowtype;
  total integer;
  done  integer;
begin
  if pid is null then
    return null;
  end if;

  select * into proj from public.projects where id = pid;

  select count(*), count(*) filter (where status = 'complete')
  into total, done
  from public.project_stages where project_id = pid;

  return jsonb_build_object(
    'project', jsonb_build_object('name', proj.name, 'code', proj.code),

    'studio', (
      select jsonb_build_object(
        'name', s.studio_name, 'logo_url', s.logo_url,
        'accent_color', s.accent_color, 'language', s.default_language)
      from public.studio_settings s where s.workspace_id = proj.workspace_id
    ),

    'current_stage', (
      select jsonb_build_object('title_ar', d.title_ar, 'title_en', d.title_en,
                                'number', d.sort_order)
      from public.stage_definitions d where d.stage_key = proj.current_stage
    ),

    'stages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'number', d.sort_order, 'title_ar', d.title_ar, 'title_en', d.title_en,
        'status', ps.status
      ) order by ps.sort_order)
      from public.project_stages ps
      join public.stage_definitions d on d.stage_key = ps.stage_key
      where ps.project_id = pid
    ), '[]'::jsonb),

    'progress', case when coalesce(total, 0) = 0 then 0
                     else round(done::numeric * 100 / total) end,

    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'filename', f.filename, 'uploaded_at', f.uploaded_at,
        -- Opaque: no workspace, no project, nothing to read from it.
        'path', f.file_url,
        'stage_title_ar', d.title_ar, 'stage_title_en', d.title_en
      ) order by f.uploaded_at desc)
      from public.files f
      join public.stage_definitions d on d.stage_key = f.stage_key
      where f.project_id = pid and f.is_published_to_portal
    ), '[]'::jsonb),

    'approvals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'decision', a.decision, 'comment', a.comment,
        'decided_at', a.decided_at, 'item_ref', a.item_ref
      ) order by a.decided_at desc)
      from public.approvals a where a.project_id = pid
    ), '[]'::jsonb),

    'invoice', (
      select jsonb_build_object('id', i.id, 'amount', i.amount,
                                'currency', i.currency, 'status', i.status)
      from public.invoices i
      where i.project_id = pid and i.status <> 'draft'
      order by i.created_at desc limit 1
    ),

    'receipt_uploaded', exists (
      select 1 from public.receipts r
      join public.invoices i on i.id = r.invoice_id
      where i.project_id = pid
    ),

    'revisions', (
      select jsonb_build_object('free_allowance', r.free_allowance, 'used', r.used)
      from public.revisions r where r.project_id = pid
    ),

    -- The token alone. The client already has it.
    'upload_prefix', p_token
  );
end;
$$;

revoke execute on function public.portal_project(text) from public;
grant  execute on function public.portal_project(text) to anon, authenticated;


-- -------------------------------------------------------------
-- 4. The approval lock covers the decision, not the foreign key
--
-- Found while deleting a file that had been approved. item_ref is
-- `on delete set null`, so removing the file makes the database null
-- the pointer — and the permanence trigger, which blocked ANY update,
-- refused it. Deleting a file reported "an approval cannot be changed
-- once it is given", which is both wrong and confusing.
--
-- What must be permanent is the DECISION: what was decided, what was
-- said, and when. A dangling pointer being tidied is none of those.
-- Deleting the approval itself is still refused outright.
-- -------------------------------------------------------------

create or replace function public.lock_given_approvals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.decision = 'approved' then
      raise exception 'an approval cannot be deleted once it is given';
    end if;
    return old;
  end if;

  if old.decision = 'approved'
     and (new.decision   is distinct from old.decision
       or new.comment    is distinct from old.comment
       or new.decided_at is distinct from old.decided_at
       or new.project_id is distinct from old.project_id
       or new.stage_key  is distinct from old.stage_key) then
    raise exception 'an approval cannot be changed once it is given';
  end if;

  return new;
end;
$$;

revoke execute on function public.lock_given_approvals() from public, anon, authenticated;
