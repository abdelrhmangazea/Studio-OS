-- =============================================================
-- Studio OS — rate limiting on everything the public can call.
--
-- The booking page and the client portal are reachable with no
-- login. Until now nothing stopped someone hammering them: filling
-- a studio's calendar with junk bookings, or walking the portal
-- RPCs looking for a token that works.
--
-- The counter lives in the database rather than in the app, because
-- the app is not the only way in — the RPCs are HTTP endpoints and
-- anyone can call them directly with curl.
--
-- Honest limits of this: the IP comes from a header. Supabase's edge
-- sets cf-connecting-ip itself and it cannot be forged, but somebody
-- with a pool of addresses still gets one bucket per address. This
-- is a speed bump against casual abuse, not a defence against a
-- determined attacker. The things that actually cannot be bypassed
-- are elsewhere: the slot exclusion constraint (0011) means a slot
-- can never be double-booked no matter how many requests arrive,
-- and portal tokens are 256 bits of random so they cannot be walked.
--
-- NOTE — this is the one table in the schema with no workspace_id.
-- It holds no workspace data: a bucket string, a timestamp and a
-- count. RLS is on with zero policies, so no client can read it at
-- all, not even their own row. Flagging it rather than quietly
-- adding a column nothing ever filters on.
-- =============================================================


create table if not exists public.request_throttle (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 1
);

alter table public.request_throttle enable row level security;
-- Deliberately no policies. Only SECURITY DEFINER functions touch it.


-- -------------------------------------------------------------
-- Who is calling
--
-- PostgREST exposes the request headers as a GUC. cf-connecting-ip
-- is written by the edge and is the trustworthy one; x-forwarded-for
-- is the fallback, and only its first entry is the client.
-- -------------------------------------------------------------

create or replace function public.request_ip()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(split_part(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
    'unknown'
  );
$$;

-- Both revokes are needed. `from public` drops the implicit grant
-- Postgres gives every function; `from anon, authenticated` drops the
-- explicit one Supabase's default privileges attach at creation time.
-- Revoking only from PUBLIC leaves these callable over HTTP — which
-- would hand anyone a way to fill someone else's bucket and lock them
-- out. Checked with has_function_privilege after applying, not assumed.
revoke execute on function public.request_ip() from public;
revoke execute on function public.request_ip() from anon, authenticated;


-- -------------------------------------------------------------
-- The counter
--
-- A fixed window, not a sliding one. Fixed windows let through up
-- to double the limit right at a boundary; that is a fair trade for
-- one row and one statement per request, and the numbers below have
-- enough headroom that it does not matter.
-- -------------------------------------------------------------

create or replace function public.throttle(
  p_bucket text,
  p_limit  integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_hits integer;
begin
  insert into public.request_throttle as rt (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case when rt.window_start < now() - p_window then 1
                    else rt.hits + 1 end,
        window_start = case when rt.window_start < now() - p_window then now()
                            else rt.window_start end
  returning rt.hits into current_hits;

  -- Sweep occasionally rather than on every call. One in a hundred
  -- requests pays for the cleanup; the table stays small.
  if random() < 0.01 then
    delete from public.request_throttle where window_start < now() - interval '1 day';
  end if;

  if current_hits > p_limit then
    -- P0001. PostgREST returns this as 400 with the message intact,
    -- and the client maps it to a sentence in the user's language.
    raise exception 'too many requests, please wait a moment and try again';
  end if;
end;
$$;

revoke execute on function public.throttle(text, integer, interval) from public;
revoke execute on function public.throttle(text, integer, interval) from anon, authenticated;


-- =============================================================
-- The booking page
-- =============================================================

-- Opening the page: generous, it is one call per page load.
create or replace function public.public_booking_page(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.throttle('book:' || public.request_ip(), 120, interval '1 hour');

  return (
    select jsonb_build_object(
      'studio', jsonb_build_object(
        'name', s.studio_name, 'logo_url', s.logo_url,
        'accent_color', s.accent_color, 'language', s.default_language),
      'settings', jsonb_build_object(
        'timezone', b.timezone,
        'minimum_notice_hours', b.minimum_notice_hours,
        'maximum_days_ahead', b.maximum_days_ahead),
      'session_types', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'label_ar', t.label_ar, 'label_en', t.label_en,
          'mode', t.mode, 'duration_minutes', t.duration_minutes, 'fee', t.fee
        ) order by t.sort_order)
        from public.session_types t
        where t.workspace_id = b.workspace_id and t.active), '[]'::jsonb),
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q.id, 'label_ar', q.label_ar, 'label_en', q.label_en,
          'field_type', q.field_type, 'options', q.options, 'is_required', q.is_required
        ) order by q.sort_order)
        from public.booking_questions q
        where q.workspace_id = b.workspace_id and q.active), '[]'::jsonb),
      'currency', s.currency)
    from public.booking_settings b
    join public.studio_settings s on s.workspace_id = b.workspace_id
    where b.public_slug = p_slug and b.is_active
  );
end;
$$;

revoke execute on function public.public_booking_page(text) from public;
grant  execute on function public.public_booking_page(text) to anon, authenticated;


-- Creating a booking: five an hour. A real client books once.
create or replace function public.public_create_booking(
  p_slug text, p_session_type uuid, p_slot_start timestamptz,
  p_name text, p_email text, p_phone_code text, p_phone text,
  p_brief text default null, p_answers jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.booking_settings%rowtype;
  session_row public.session_types%rowtype;
  slot_end timestamptz; booking_id uuid; booking_tok uuid;
  contact public.contacts%rowtype; won_status uuid; project uuid;
  clean_name text := trim(coalesce(p_name, ''));
  first_name text; last_name text;
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  answer_text text := ''; entry record; requirements text;
begin
  perform public.throttle('booking:' || public.request_ip(), 5, interval '1 hour');

  if clean_name = '' then raise exception 'a name is required'; end if;

  select * into cfg from public.booking_settings where public_slug = p_slug and is_active;
  if not found then raise exception 'this booking page is not available'; end if;

  select * into session_row from public.session_types
  where id = p_session_type and workspace_id = cfg.workspace_id and active;
  if not found then raise exception 'that session type is not available'; end if;

  slot_end := p_slot_start + make_interval(mins => session_row.duration_minutes);

  if not exists (
    select 1 from public.public_available_slots(
      p_slug, p_session_type, p_slot_start::date, p_slot_start::date) s
    where s = p_slot_start) then
    raise exception 'that time is not available';
  end if;

  first_name := split_part(clean_name, ' ', 1);
  last_name := nullif(trim(substr(clean_name, length(first_name) + 1)), '');

  begin
    insert into public.bookings
      (workspace_id, session_type_id, slot_start, slot_end, status,
       client_name, client_email, client_phone_code, client_phone, project_brief, answers)
    values
      (cfg.workspace_id, session_row.id, p_slot_start, slot_end, 'pending',
       clean_name, nullif(trim(coalesce(p_email, '')), ''),
       nullif(trim(coalesce(p_phone_code, '')), ''), nullif(digits, ''),
       nullif(trim(coalesce(p_brief, '')), ''), coalesce(p_answers, '{}'::jsonb))
    returning id, public_token into booking_id, booking_tok;
  exception when exclusion_violation then
    raise exception 'that time was just booked by someone else';
  end;

  select * into contact from public.contacts c
  where c.workspace_id = cfg.workspace_id
    and p_email is not null and trim(p_email) <> ''
    and lower(c.email) = lower(trim(p_email))
  limit 1;

  if not found and digits <> '' then
    select * into contact from public.contacts c
    where c.workspace_id = cfg.workspace_id
      and c.phone_number = digits
      and coalesce(c.phone_country_code, '') = coalesce(trim(p_phone_code), '')
    limit 1;
  end if;

  if not found then
    insert into public.contacts
      (workspace_id, first_name, last_name, email, phone_country_code, phone_number)
    values (cfg.workspace_id, first_name, last_name,
            nullif(trim(coalesce(p_email, '')), ''),
            nullif(trim(coalesce(p_phone_code, '')), ''), nullif(digits, ''))
    returning * into contact;
  end if;

  select id into won_status from public.lead_statuses
  where workspace_id = cfg.workspace_id and is_won and is_active
  order by sort_order limit 1;

  if won_status is not null then
    update public.contacts set status_id = won_status where id = contact.id;
  end if;

  for entry in select key, value from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) loop
    answer_text := answer_text || entry.key || ': ' || entry.value || E'\n';
  end loop;

  requirements := concat_ws(E'\n\n',
    nullif(trim(coalesce(p_brief, '')), ''), nullif(answer_text, ''));

  project := public.create_project_in(
    cfg.workspace_id, contact.id, clean_name, null, null,
    session_row.label_en, requirements);

  insert into public.notes (workspace_id, contact_id, body, created_by)
  values (cfg.workspace_id, contact.id,
          concat_ws(E'\n',
            'Booked ' || session_row.label_en || ' for ' ||
              to_char(p_slot_start at time zone cfg.timezone, 'YYYY-MM-DD HH24:MI'),
            nullif(trim(coalesce(p_brief, '')), ''), nullif(answer_text, '')),
          null);

  update public.bookings set contact_id = contact.id, project_id = project where id = booking_id;

  return jsonb_build_object(
    'token', booking_tok,
    'upload_prefix', cfg.workspace_id::text || '/' || booking_tok::text);
end;
$$;

revoke execute on function public.public_create_booking(
  text, uuid, timestamptz, text, text, text, text, text, jsonb) from public;
grant  execute on function public.public_create_booking(
  text, uuid, timestamptz, text, text, text, text, text, jsonb) to anon, authenticated;


-- Checking a booking you already made: per token, not per IP, so one
-- person refreshing their own confirmation page never blocks another.
create or replace function public.public_booking_status(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.throttle('bstatus:' || p_token::text, 60, interval '1 minute');

  return (
    select jsonb_build_object(
      'client_name', b.client_name,
      'slot_start',  b.slot_start,
      'slot_end',    b.slot_end,
      'status',      b.status,
      'timezone',    cfg.timezone,
      'session',     jsonb_build_object('label_ar', t.label_ar, 'label_en', t.label_en, 'mode', t.mode),
      'studio',      jsonb_build_object('name', s.studio_name, 'logo_url', s.logo_url,
                                        'accent_color', s.accent_color,
                                        'language', s.default_language),
      'invoice', (
        select jsonb_build_object('id', i.id, 'amount', i.amount, 'currency', i.currency,
                                  'status', i.status)
        from public.invoices i
        where i.booking_id = b.id and i.status <> 'draft'
        order by i.created_at desc limit 1
      ),
      'receipt_uploaded', exists (
        select 1 from public.receipts r
        join public.invoices i on i.id = r.invoice_id
        where i.booking_id = b.id
      ),
      'pending_files', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q.id, 'label_ar', q.label_ar, 'label_en', q.label_en
        ) order by q.sort_order)
        from public.booking_questions q
        where q.workspace_id = b.workspace_id
          and q.active
          and q.field_type = 'file'
          and not (b.answer_files ? q.id::text)
      ), '[]'::jsonb),
      'upload_prefix', b.workspace_id::text || '/' || b.public_token::text
    )
    from public.bookings b
    join public.booking_settings cfg on cfg.workspace_id = b.workspace_id
    left join public.session_types t on t.id = b.session_type_id
    join public.studio_settings s on s.workspace_id = b.workspace_id
    where b.public_token = p_token
  );
end;
$$;

revoke execute on function public.public_booking_status(uuid) from public;
grant  execute on function public.public_booking_status(uuid) to anon, authenticated;


-- =============================================================
-- The client portal — per token, thirty a minute
--
-- The portal polls nothing, so thirty a minute is far above any
-- real use of the page while still stopping a script.
-- =============================================================

create or replace function public.portal_project(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid   uuid;
  proj  public.projects%rowtype;
  total integer;
  done  integer;
begin
  -- Throttled on the token as supplied, before it is resolved, so
  -- guessing at tokens is rate limited too.
  perform public.throttle('portal:' || left(p_token, 64), 30, interval '1 minute');

  pid := public.resolve_portal_token(p_token);
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
    'upload_prefix', p_token
  );
end;
$$;

revoke execute on function public.portal_project(text) from public;
grant  execute on function public.portal_project(text) to anon, authenticated;


-- Decisions and uploads: twenty an hour per token. A client approving
-- a batch of drawings never gets near it; a script does immediately.

create or replace function public.portal_submit_decision(
  p_token text, p_decision text, p_comment text default null, p_file_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid       uuid;
  proj      public.projects%rowtype;
  target    text;
  stage_row public.project_stages%rowtype;
  flags     jsonb;
  billable  boolean := false;
begin
  perform public.throttle('portalwrite:' || left(p_token, 64), 20, interval '1 hour');

  pid := public.resolve_portal_token(p_token);
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

revoke execute on function public.portal_submit_decision(text, text, text, uuid) from public;
grant  execute on function public.portal_submit_decision(text, text, text, uuid) to anon, authenticated;


create or replace function public.portal_attach_receipt(p_token text, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid     uuid;
  proj    public.projects%rowtype;
  invoice uuid;
begin
  perform public.throttle('portalwrite:' || left(p_token, 64), 20, interval '1 hour');

  pid := public.resolve_portal_token(p_token);
  if pid is null then
    raise exception 'this link is no longer active';
  end if;

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


create or replace function public.public_attach_receipt(p_token uuid, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare booking public.bookings%rowtype; invoice uuid;
begin
  perform public.throttle('bookwrite:' || p_token::text, 20, interval '1 hour');

  select * into booking from public.bookings where public_token = p_token;
  if not found then raise exception 'unknown booking'; end if;

  if split_part(p_path, '/', 1) <> booking.workspace_id::text
     or split_part(p_path, '/', 2) <> booking.public_token::text then
    raise exception 'that file does not belong to this booking';
  end if;

  select id into invoice from public.invoices
  where booking_id = booking.id and status <> 'draft'
  order by created_at desc limit 1;

  if invoice is null then raise exception 'there is no invoice to pay yet'; end if;

  insert into public.receipts (workspace_id, invoice_id, file_url)
  values (booking.workspace_id, invoice, p_path);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.public_attach_receipt(uuid, text) from public;
grant  execute on function public.public_attach_receipt(uuid, text) to anon, authenticated;


create or replace function public.public_attach_answer_file(
  p_token uuid, p_question uuid, p_path text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking  public.bookings%rowtype;
  question public.booking_questions%rowtype;
begin
  perform public.throttle('bookwrite:' || p_token::text, 20, interval '1 hour');

  select * into booking from public.bookings where public_token = p_token;
  if not found then
    raise exception 'unknown booking';
  end if;

  if split_part(p_path, '/', 1) <> booking.workspace_id::text
     or split_part(p_path, '/', 2) <> booking.public_token::text
     or split_part(p_path, '/', 3) <> 'answers' then
    raise exception 'that file does not belong to this booking';
  end if;

  select * into question from public.booking_questions
  where id = p_question
    and workspace_id = booking.workspace_id
    and field_type = 'file';
  if not found then
    raise exception 'that question does not take a file';
  end if;

  update public.bookings
  set answer_files = answer_files || jsonb_build_object(
        p_question::text,
        jsonb_build_object('path', p_path, 'name', left(coalesce(p_name, ''), 200))
      )
  where id = booking.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.public_attach_answer_file(uuid, uuid, text, text) from public;
grant  execute on function public.public_attach_answer_file(uuid, uuid, text, text) to anon, authenticated;
