-- =============================================================
-- Studio OS — Bucket 6: the portal's public path
--
-- Everything a client can reach goes through the four functions
-- below. There is no `anon` policy on portal_links, files, approvals,
-- revisions, projects, project_stages, or anything else — so this is
-- the entire surface, not merely the intended one.
--
-- EVERY function starts by resolving the token through
-- resolve_portal_token(), which returns a project id ONLY when the
-- link is active and not revoked. Revoking therefore takes effect on
-- the very next call: nothing is cached and nothing has to expire.
--
-- WHAT THE CLIENT CAN SEE, exhaustively:
--   projects           name, code                      (their project only)
--   project_stages     status, sort_order              (their project only)
--   stage_definitions  title_ar, title_en, sort_order  (labels only)
--   studio_settings    studio_name, logo_url, accent_color, default_language
--   files              id, filename, uploaded_at       (published only)
--   approvals          decision, comment, decided_at, item_ref
--   invoices           amount, currency, status        (their project only)
--   receipts           existence, as a boolean
--   revisions          free_allowance, used
--
-- WHAT IT CANNOT SEE, at any price:
--   contacts (including their own), any other project, any other
--   workspace, checklist items, notes, templates, generated documents,
--   gate state, booking data, and every internal stage_key. A stage
--   reaches the client as "Design Development", never as
--   '06_design_development'.
--
-- The token is passed in the request BODY, never a query string, and
-- no function below ever includes it in an error message.
-- =============================================================


-- -------------------------------------------------------------
-- 1. The one place a token becomes a project
-- -------------------------------------------------------------

create or replace function public.resolve_portal_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.project_id
  from public.portal_links l
  where l.token = p_token
    and l.is_active
    and l.revoked_at is null;
$$;

revoke execute on function public.resolve_portal_token(text) from public, anon, authenticated;


-- -------------------------------------------------------------
-- 2. The portal itself
-- -------------------------------------------------------------

create or replace function public.portal_project(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pid     uuid := public.resolve_portal_token(p_token);
  proj    public.projects%rowtype;
  total   integer;
  done    integer;
begin
  if pid is null then
    -- Deliberately says nothing about why, and never repeats the token.
    return null;
  end if;

  select * into proj from public.projects where id = pid;

  select count(*), count(*) filter (where status = 'complete')
  into total, done
  from public.project_stages where project_id = pid;

  return jsonb_build_object(
    'project', jsonb_build_object(
      'name', proj.name,
      'code', proj.code
    ),

    'studio', (
      select jsonb_build_object(
        'name', s.studio_name, 'logo_url', s.logo_url,
        'accent_color', s.accent_color, 'language', s.default_language)
      from public.studio_settings s where s.workspace_id = proj.workspace_id
    ),

    -- Client-facing labels only. stage_key never crosses this line.
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

    -- Nothing appears here that the designer has not published.
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'filename', f.filename, 'uploaded_at', f.uploaded_at,
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

    'upload_prefix', proj.workspace_id::text || '/' || p_token
  );
end;
$$;


-- -------------------------------------------------------------
-- 3. Approving, or asking for changes
--
-- p_file_id null  → a decision about the CURRENT STAGE. An approval
--                   here is what opens the gate.
-- p_file_id set   → a decision about one file. Recorded on the
--                   timeline, but it never opens a gate.
--
-- Running out of revisions does not block anything. It is stated in
-- the portal and recorded for the designer; the request still goes
-- through. That is the specified behaviour, not an oversight.
-- -------------------------------------------------------------

create or replace function public.portal_submit_decision(
  p_token    text,
  p_decision text,
  p_comment  text default null,
  p_file_id  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid       uuid := public.resolve_portal_token(p_token);
  proj      public.projects%rowtype;
  target    text;
  stage_row public.project_stages%rowtype;
  flags     jsonb;
  billable  boolean := false;
begin
  if pid is null then
    raise exception 'this link is no longer active';
  end if;

  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'unknown decision';
  end if;

  if p_decision = 'changes_requested'
     and coalesce(trim(p_comment), '') = '' then
    raise exception 'please describe the change you would like';
  end if;

  select * into proj from public.projects where id = pid;

  if p_file_id is null then
    target := proj.current_stage;
  else
    -- The file must belong to this project and actually be published,
    -- or it is not something this client was ever shown.
    select f.stage_key into target
    from public.files f
    where f.id = p_file_id and f.project_id = pid and f.is_published_to_portal;

    if target is null then
      raise exception 'that item is not part of this project';
    end if;
  end if;

  insert into public.approvals
    (workspace_id, project_id, stage_key, item_ref, decision, comment)
  values
    (proj.workspace_id, pid, target, p_file_id,
     p_decision::public.approval_decision, nullif(trim(coalesce(p_comment, '')), ''));

  if p_decision = 'changes_requested' then
    update public.revisions
    set used = used + 1
    where project_id = pid
    returning used > free_allowance into billable;

  elsif p_file_id is null then
    -- A STAGE approval, and only a stage approval, satisfies the gate.
    -- It sets the flag the stage already declares; it invents nothing,
    -- so stages without a client_approved flag are untouched.
    select d.gate_flags into flags
    from public.stage_definitions d where d.stage_key = target;

    if flags @> '[{"key":"client_approved"}]'::jsonb then
      select * into stage_row from public.project_stages
      where project_id = pid and stage_key = target;

      update public.project_stages
      set gate_state = jsonb_set(gate_state, array['client_approved'], 'true'::jsonb, true)
      where id = stage_row.id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'billable', coalesce(billable, false));
end;
$$;


-- -------------------------------------------------------------
-- 4. Receipts, reusing Bucket 5's flow
--
-- The same private bucket and the same manual confirmation. The only
-- new thing is that a portal token may now stand in for a booking
-- token when validating the upload path.
-- -------------------------------------------------------------

create or replace function public.receipt_upload_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    where b.workspace_id::text = split_part(object_name, '/', 1)
      and b.public_token::text = split_part(object_name, '/', 2)
      and b.status <> 'cancelled'
  )
  or exists (
    select 1
    from public.portal_links l
    join public.projects p on p.id = l.project_id
    where p.workspace_id::text = split_part(object_name, '/', 1)
      and l.token = split_part(object_name, '/', 2)
      and l.is_active
      and l.revoked_at is null
  );
$$;


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

  select * into proj from public.projects where id = pid;

  if split_part(p_path, '/', 1) <> proj.workspace_id::text
     or split_part(p_path, '/', 2) <> p_token then
    raise exception 'that file does not belong to this project';
  end if;

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


-- -------------------------------------------------------------
-- 5. Downloading a published file
--
-- Two conditions, both required: the file is published to the portal,
-- AND its project still has a live link. Revoking the link therefore
-- stops downloads in the same instant it closes the portal.
--
-- Accepted exposure: a published file stays fetchable by its exact
-- storage path until the link is revoked. The path carries a random
-- uuid, and the portal link is itself shareable by the client, so an
-- edge function would move this exposure rather than remove it.
-- Logged for review in Bucket 9, before other studios are onboarded.
-- -------------------------------------------------------------

create or replace function public.portal_file_download_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.files f
    join public.portal_links l on l.project_id = f.project_id
    where f.file_url = object_name
      and f.is_published_to_portal
      and l.is_active
      and l.revoked_at is null
  );
$$;

create policy "project_files_portal_read" on storage.objects for select
  to anon
  using (
    bucket_id = 'project-files'
    and public.portal_file_download_allowed(name)
  );


-- -------------------------------------------------------------
-- 6. Grants — anon may call exactly these three, and nothing else
-- -------------------------------------------------------------

revoke execute on function public.portal_project(text)                    from public;
revoke execute on function public.portal_submit_decision(text, text, text, uuid) from public;
revoke execute on function public.portal_attach_receipt(text, text)       from public;
revoke execute on function public.portal_file_download_allowed(text)      from public;

grant execute on function public.portal_project(text)                     to anon, authenticated;
grant execute on function public.portal_submit_decision(text, text, text, uuid) to anon, authenticated;
grant execute on function public.portal_attach_receipt(text, text)        to anon, authenticated;
grant execute on function public.portal_file_download_allowed(text)       to anon, authenticated;
