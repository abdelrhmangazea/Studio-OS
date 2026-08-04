-- =============================================================
-- Studio OS — Bucket 5: the public booking API
--
-- These are the ONLY things `anon` can call, and the only way the
-- public page touches the database. There is no anon policy on any
-- table; RLS stays shut. Each function returns a hand-picked column
-- list, so a bug here leaks its own return shape and nothing else.
-- =============================================================


-- -------------------------------------------------------------
-- 0. Project creation, refactored so a booking can call it
--
-- create_project() reads current_workspace_id(), which is NULL for an
-- anonymous visitor. The body moves into an internal function that
-- takes the workspace explicitly; the public one just supplies it.
-- Behaviour for signed-in callers is unchanged.
-- -------------------------------------------------------------

create or replace function public.create_project_in(
  p_workspace   uuid,
  p_contact_id  uuid,
  p_name        text,
  p_address     text default null,
  p_area        numeric default null,
  p_type        text default null,
  p_requirements text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_project uuid;
  new_code    text;
  checklist   record;
  section     jsonb;
  item        jsonb;
  en_section  jsonb;
  en_item     jsonb;
  position    integer;
begin
  if not exists (select 1 from public.contacts c
                 where c.id = p_contact_id and c.workspace_id = p_workspace) then
    raise exception 'that contact is not in your workspace';
  end if;

  new_code := public.next_project_code(p_workspace);

  insert into public.projects
    (workspace_id, contact_id, code, name, address, area_sqm, project_type, requirements)
  values (p_workspace, p_contact_id, new_code, p_name, p_address, p_area, p_type, p_requirements)
  returning id into new_project;

  insert into public.project_stages (workspace_id, project_id, stage_key, sort_order, status)
  select p_workspace, new_project, d.stage_key, d.sort_order,
         case when d.sort_order = 1 then 'active' else 'locked' end::public.stage_status
  from public.stage_definitions d;

  for checklist in
    select ar.stage as stage_key, ar.structure as ar_struct, en.structure as en_struct
    from public.templates ar
    join public.templates en
      on en.workspace_id = ar.workspace_id and en.key = ar.key and en.language = 'en'
    where ar.workspace_id = p_workspace and ar.type = 'checklist' and ar.language = 'ar'
      and ar.active and ar.stage is not null
  loop
    position := 0;
    for section in select * from jsonb_array_elements(checklist.ar_struct -> 'sections')
    loop
      select value into en_section
      from jsonb_array_elements(checklist.en_struct -> 'sections')
      where value ->> 'id' = section ->> 'id' limit 1;

      for item in select * from jsonb_array_elements(section -> 'items')
      loop
        select value into en_item
        from jsonb_array_elements(coalesce(en_section -> 'items', '[]'::jsonb))
        where value ->> 'id' = item ->> 'id' limit 1;

        position := position + 1;
        insert into public.checklist_items
          (workspace_id, project_id, stage_key, section_title_ar, section_title_en,
           label_ar, label_en, note_ar, note_en, sort_order)
        values
          (p_workspace, new_project, checklist.stage_key,
           section ->> 'title', en_section ->> 'title',
           item ->> 'label',    en_item ->> 'label',
           section ->> 'note',  en_section ->> 'note',
           position);
      end loop;
    end loop;
  end loop;

  return new_project;
end;
$$;


create or replace function public.create_project(
  p_contact_id  uuid,
  p_name        text,
  p_address     text default null,
  p_area        numeric default null,
  p_type        text default null,
  p_requirements text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare ws uuid := public.current_workspace_id();
begin
  if ws is null then
    raise exception 'no workspace for the current user';
  end if;
  return public.create_project_in(ws, p_contact_id, p_name, p_address, p_area, p_type, p_requirements);
end;
$$;


-- -------------------------------------------------------------
-- 1. The page itself — branding, session types, questions
--
-- Deliberately returns no workspace id, no contacts, no bookings.
-- -------------------------------------------------------------

create or replace function public.public_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'studio', jsonb_build_object(
      'name',         s.studio_name,
      'logo_url',     s.logo_url,
      'accent_color', s.accent_color,
      'language',     s.default_language
    ),
    'settings', jsonb_build_object(
      'timezone',             b.timezone,
      'minimum_notice_hours', b.minimum_notice_hours,
      'maximum_days_ahead',   b.maximum_days_ahead
    ),
    'session_types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'label_ar', t.label_ar, 'label_en', t.label_en,
        'mode', t.mode, 'duration_minutes', t.duration_minutes, 'fee', t.fee
      ) order by t.sort_order)
      from public.session_types t
      where t.workspace_id = b.workspace_id and t.active
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'label_ar', q.label_ar, 'label_en', q.label_en,
        'field_type', q.field_type, 'options', q.options, 'is_required', q.is_required
      ) order by q.sort_order)
      from public.booking_questions q
      where q.workspace_id = b.workspace_id and q.active
    ), '[]'::jsonb),
    'currency', s.currency
  )
  from public.booking_settings b
  join public.studio_settings s on s.workspace_id = b.workspace_id
  where b.public_slug = p_slug and b.is_active;
$$;


-- -------------------------------------------------------------
-- 2. Free slots — timestamps only, never the bookings behind them
-- -------------------------------------------------------------

create or replace function public.public_available_slots(
  p_slug          text,
  p_session_type  uuid,
  p_from          date,
  p_to            date
)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg       public.booking_settings%rowtype;
  minutes   integer;
  step      interval;
  day       date;
  rule      jsonb;
  slot      timestamptz;
  day_end   timestamptz;
  earliest  timestamptz;
  latest    date;
begin
  select * into cfg from public.booking_settings
  where public_slug = p_slug and is_active;
  if not found then return; end if;

  select coalesce(t.duration_minutes, cfg.session_duration_minutes) into minutes
  from public.session_types t
  where t.id = p_session_type and t.workspace_id = cfg.workspace_id and t.active;
  if minutes is null then return; end if;

  step     := make_interval(mins => minutes + cfg.buffer_minutes);
  earliest := now() + make_interval(hours => cfg.minimum_notice_hours);
  latest   := (now() + make_interval(days => cfg.maximum_days_ahead))::date;

  day := greatest(p_from, now()::date);

  while day <= least(p_to, latest) loop
    if not exists (select 1 from public.blocked_dates bd
                   where bd.workspace_id = cfg.workspace_id and bd.date = day) then

      for rule in select * from jsonb_array_elements(cfg.availability)
      loop
        if (rule ->> 'day')::int = extract(dow from day)::int then
          slot    := ((day::text || ' ' || (rule ->> 'start'))::timestamp) at time zone cfg.timezone;
          day_end := ((day::text || ' ' || (rule ->> 'end'))::timestamp)   at time zone cfg.timezone;

          while slot + make_interval(mins => minutes) <= day_end loop
            if slot >= earliest
               and not exists (
                 select 1 from public.bookings bk
                 where bk.workspace_id = cfg.workspace_id
                   and bk.status in ('pending', 'confirmed')
                   and tstzrange(bk.slot_start, bk.slot_end)
                       && tstzrange(slot, slot + make_interval(mins => minutes))
               )
            then
              return next slot;
            end if;
            slot := slot + step;
          end loop;
        end if;
      end loop;
    end if;

    day := day + 1;
  end loop;
end;
$$;


-- -------------------------------------------------------------
-- 3. Submitting a booking — the whole chain, in one transaction
--
-- Either every one of these happens or none does. A half-created
-- client with no project is not a state this can reach.
-- -------------------------------------------------------------

create or replace function public.public_create_booking(
  p_slug         text,
  p_session_type uuid,
  p_slot_start   timestamptz,
  p_name         text,
  p_email        text,
  p_phone_code   text,
  p_phone        text,
  p_brief        text default null,
  p_answers      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg          public.booking_settings%rowtype;
  session_row  public.session_types%rowtype;
  slot_end     timestamptz;
  booking_id   uuid;
  booking_tok  uuid;
  contact      public.contacts%rowtype;
  won_status   uuid;
  project      uuid;
  clean_name   text := trim(coalesce(p_name, ''));
  first_name   text;
  last_name    text;
  digits       text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  answer_text  text := '';
  entry        record;
  requirements text;
begin
  if clean_name = '' then
    raise exception 'a name is required';
  end if;

  select * into cfg from public.booking_settings
  where public_slug = p_slug and is_active;
  if not found then
    raise exception 'this booking page is not available';
  end if;

  select * into session_row from public.session_types
  where id = p_session_type and workspace_id = cfg.workspace_id and active;
  if not found then
    raise exception 'that session type is not available';
  end if;

  slot_end := p_slot_start + make_interval(mins => session_row.duration_minutes);

  -- The slot must be one this page actually offers. Without this check a
  -- caller could POST any time at all straight past the UI.
  if not exists (
    select 1 from public.public_available_slots(
      p_slug, p_session_type, p_slot_start::date, p_slot_start::date
    ) s where s = p_slot_start
  ) then
    raise exception 'that time is not available';
  end if;

  first_name := split_part(clean_name, ' ', 1);
  last_name  := nullif(trim(substr(clean_name, length(first_name) + 1)), '');

  -- 1. the booking. The exclusion constraint is what settles a race:
  --    if someone else committed this slot first, this INSERT is refused.
  begin
    insert into public.bookings
      (workspace_id, session_type_id, slot_start, slot_end, status,
       client_name, client_email, client_phone_code, client_phone,
       project_brief, answers)
    values
      (cfg.workspace_id, session_row.id, p_slot_start, slot_end, 'pending',
       clean_name, nullif(trim(coalesce(p_email, '')), ''),
       nullif(trim(coalesce(p_phone_code, '')), ''), nullif(digits, ''),
       nullif(trim(coalesce(p_brief, '')), ''), coalesce(p_answers, '{}'::jsonb))
    returning id, public_token into booking_id, booking_tok;
  exception when exclusion_violation then
    raise exception 'that time was just booked by someone else';
  end;

  -- 2. match an existing contact on email, then on phone. Never duplicate.
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

  -- 3. Booking IS the conversion. Setting is_client directly would be
  --    reverted by sync_client_from_status; the status is what converts.
  select id into won_status from public.lead_statuses
  where workspace_id = cfg.workspace_id and is_won and is_active
  order by sort_order limit 1;

  if won_status is not null then
    update public.contacts set status_id = won_status where id = contact.id;
  end if;

  -- 5. the answers, as readable text
  for entry in select key, value from jsonb_each_text(coalesce(p_answers, '{}'::jsonb))
  loop
    answer_text := answer_text || entry.key || ': ' || entry.value || E'\n';
  end loop;

  requirements := concat_ws(E'\n\n',
    nullif(trim(coalesce(p_brief, '')), ''),
    nullif(answer_text, ''));

  -- 4. the project, opened at stage 01 with its checklist
  project := public.create_project_in(
    cfg.workspace_id, contact.id, clean_name, null, null,
    session_row.label_en, requirements);

  -- 5b. and the same thing in the communication log
  insert into public.notes (workspace_id, contact_id, body, created_by)
  values (cfg.workspace_id, contact.id,
          concat_ws(E'\n',
            'Booked ' || session_row.label_en || ' for ' ||
              to_char(p_slot_start at time zone cfg.timezone, 'YYYY-MM-DD HH24:MI'),
            nullif(trim(coalesce(p_brief, '')), ''),
            nullif(answer_text, '')),
          null);

  update public.bookings
  set contact_id = contact.id, project_id = project
  where id = booking_id;

  -- The only thing the public side ever gets back.
  return jsonb_build_object(
    'token', booking_tok,
    'upload_prefix', cfg.workspace_id::text || '/' || booking_tok::text
  );
end;
$$;


-- -------------------------------------------------------------
-- 4. The confirmation page: what the client may see, and the receipt
-- -------------------------------------------------------------

create or replace function public.public_booking_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'client_name', b.client_name,
    'slot_start',  b.slot_start,
    'slot_end',    b.slot_end,
    'status',      b.status,
    'timezone',    cfg.timezone,
    'session',     jsonb_build_object('label_ar', t.label_ar, 'label_en', t.label_en, 'mode', t.mode),
    'studio',      jsonb_build_object('name', s.studio_name, 'logo_url', s.logo_url,
                                      'accent_color', s.accent_color),
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
    'upload_prefix', b.workspace_id::text || '/' || b.public_token::text
  )
  from public.bookings b
  join public.booking_settings cfg on cfg.workspace_id = b.workspace_id
  left join public.session_types t on t.id = b.session_type_id
  join public.studio_settings s on s.workspace_id = b.workspace_id
  where b.public_token = p_token;
$$;


/** Records an uploaded receipt against this booking's issued invoice. */
create or replace function public.public_attach_receipt(p_token uuid, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings%rowtype;
  invoice uuid;
begin
  select * into booking from public.bookings where public_token = p_token;
  if not found then
    raise exception 'unknown booking';
  end if;

  -- The path must sit inside this booking's own folder.
  if split_part(p_path, '/', 1) <> booking.workspace_id::text
     or split_part(p_path, '/', 2) <> booking.public_token::text then
    raise exception 'that file does not belong to this booking';
  end if;

  select id into invoice from public.invoices
  where booking_id = booking.id and status <> 'draft'
  order by created_at desc limit 1;

  if invoice is null then
    raise exception 'there is no invoice to pay yet';
  end if;

  insert into public.receipts (workspace_id, invoice_id, file_url)
  values (booking.workspace_id, invoice, p_path);

  return jsonb_build_object('ok', true);
end;
$$;


-- -------------------------------------------------------------
-- 5. Grants — anon may call exactly these five, and nothing else
-- -------------------------------------------------------------

revoke execute on function public.create_project_in(uuid, uuid, text, text, numeric, text, text)
  from public, anon, authenticated;

revoke execute on function public.public_booking_page(text)                     from public;
revoke execute on function public.public_available_slots(text, uuid, date, date) from public;
revoke execute on function public.public_create_booking(text, uuid, timestamptz, text, text, text, text, text, jsonb) from public;
revoke execute on function public.public_booking_status(uuid)                   from public;
revoke execute on function public.public_attach_receipt(uuid, text)             from public;

grant execute on function public.public_booking_page(text)                      to anon, authenticated;
grant execute on function public.public_available_slots(text, uuid, date, date) to anon, authenticated;
grant execute on function public.public_create_booking(text, uuid, timestamptz, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.public_booking_status(uuid)                    to anon, authenticated;
grant execute on function public.public_attach_receipt(uuid, text)              to anon, authenticated;
