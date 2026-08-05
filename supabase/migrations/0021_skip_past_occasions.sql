-- =============================================================
-- Studio OS — Bucket 7 correction: do not enrol into occasions that
-- have already been and gone.
--
-- Found while testing. Delivering a project in August enrolled the
-- client into that year's Ramadan and Eid dates, which were months
-- past — so the moment they were enrolled, four already-expired rows
-- landed under "Needs attention". A client delivered in August was
-- not a client at Ramadan; there is nothing to be reminded about.
--
-- A DATELESS occasion is a different thing and is still created: that
-- one is waiting on the designer, not already gone.
--
-- Two other fixes folded in here, both found the same way:
--   * 'new_year' was an untyped literal in an INSERT ... SELECT, so
--     sync_occasion_reminders raised 42804 and filled nothing
--   * GET DIAGNOSTICS overwrote the count each loop instead of
--     accumulating it, so the caller got the last occasion's number
-- =============================================================

create or replace function public.enrol_in_followup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws        uuid := new.workspace_id;
  cid       uuid := new.contact_id;
  born      date;
  this_year integer := extract(year from now())::integer;
  occ       record;
  bday      date;
  occ_date  date;
begin
  if new.delivered_at is null or old.delivered_at is not null then
    return new;
  end if;

  insert into public.reminders
    (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring)
  values
    (ws, cid, new.id, 'followup_6m', (new.delivered_at + interval '6 months')::date,
     'followup_6_months', false),
    (ws, cid, new.id, 'followup_1y', (new.delivered_at + interval '1 year')::date,
     'followup_1_year', false),
    (ws, cid, new.id, 'followup_2y', (new.delivered_at + interval '2 years')::date,
     'followup_2_years', false)
  on conflict do nothing;

  -- Birthday, and only where one is recorded. Never inferred.
  select birthday into born from public.contacts where id = cid;

  if born is not null then
    bday := make_date(this_year, extract(month from born)::int, extract(day from born)::int);
    if bday < current_date then
      bday := make_date(this_year + 1, extract(month from born)::int, extract(day from born)::int);
    end if;

    insert into public.reminders
      (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
    values (ws, cid, new.id, 'birthday', bday, 'occasion_birthday', true,
            extract(year from bday)::integer)
    on conflict do nothing;
  end if;

  -- New Year: this year's if it is still ahead, otherwise next year's.
  occ_date := make_date(this_year, 1, 1);
  if occ_date < current_date then
    occ_date := make_date(this_year + 1, 1, 1);
  end if;

  insert into public.reminders
    (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
  values (ws, cid, new.id, 'new_year', occ_date, 'occasion_new_year', true,
          extract(year from occ_date)::integer)
  on conflict do nothing;

  for occ in
    select * from (values
      ('hijri_new_year', 'occasion_hijri_new_year'),
      ('ramadan',        'occasion_ramadan'),
      ('eid_fitr',       'occasion_eid_fitr'),
      ('eid_adha',       'occasion_eid_adha')
    ) as t(kind, template)
  loop
    select d.date into occ_date
    from public.occasion_dates d
    where d.workspace_id = ws and d.year = this_year and d.occasion_key = occ.kind;

    if occ_date is null or occ_date >= current_date then
      insert into public.reminders
        (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
      values (ws, cid, new.id, occ.kind::public.reminder_kind, occ_date,
              occ.template, true, this_year)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.tasks
    (workspace_id, title, contact_id, project_id, stage_key, due_date, source, rule_key)
  values
    (ws, 'Photograph the project', cid, new.id, '10_followup',
     (now() + interval '14 days')::date, 'followup', 'marketing_photograph'),
    (ws, 'Agree in writing what may be published', cid, new.id, '10_followup',
     (now() + interval '14 days')::date, 'followup', 'marketing_permissions'),
    (ws, 'Update the portfolio', cid, new.id, '10_followup',
     (now() + interval '30 days')::date, 'followup', 'marketing_portfolio'),
    (ws, 'Request the client testimonial', cid, new.id, '10_followup',
     (now() + interval '30 days')::date, 'followup', 'marketing_testimonial')
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.enrol_in_followup() from public, anon, authenticated;


create or replace function public.sync_occasion_reminders(p_year integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws      uuid := public.current_workspace_id();
  touched integer := 0;
  n       integer;
  occ     record;
begin
  if ws is null then
    raise exception 'no workspace for the current user';
  end if;

  insert into public.reminders
    (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
  select distinct ws, r.contact_id, r.project_id,
         'new_year'::public.reminder_kind, make_date(p_year, 1, 1),
         'occasion_new_year', true, p_year
  from public.reminders r
  where r.workspace_id = ws and r.kind = 'followup_6m'
    and make_date(p_year, 1, 1) >= current_date
  on conflict do nothing;

  for occ in
    select * from (values
      ('hijri_new_year', 'occasion_hijri_new_year'),
      ('ramadan',        'occasion_ramadan'),
      ('eid_fitr',       'occasion_eid_fitr'),
      ('eid_adha',       'occasion_eid_adha')
    ) as t(kind, template)
  loop
    insert into public.reminders
      (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
    select distinct ws, r.contact_id, r.project_id, occ.kind::public.reminder_kind,
           d.date, occ.template, true, p_year
    from public.reminders r
    join public.occasion_dates d
      on d.workspace_id = ws and d.year = p_year and d.occasion_key = occ.kind
    where r.workspace_id = ws and r.kind = 'followup_6m'
      and d.date >= current_date
    on conflict do nothing;

    update public.reminders r
    set due_date = d.date
    from public.occasion_dates d
    where r.workspace_id = ws
      and r.kind = occ.kind::public.reminder_kind
      and r.year = p_year
      and r.due_date is null
      and d.workspace_id = ws and d.year = p_year and d.occasion_key = occ.kind
      and d.date >= current_date;

    get diagnostics n = row_count;
    touched := touched + n;
  end loop;

  -- Anything still dateless for a year now fully entered is an
  -- occasion that has already passed. Drop it rather than leaving a
  -- permanent dateless row sitting on the dashboard.
  delete from public.reminders r
  where r.workspace_id = ws
    and r.year = p_year
    and r.due_date is null
    and not r.is_done
    and exists (
      select 1 from public.occasion_dates d
      where d.workspace_id = ws and d.year = p_year
        and d.occasion_key = r.kind::text
    );

  return touched;
end;
$$;

revoke execute on function public.sync_occasion_reminders(integer) from public, anon;
grant execute on function public.sync_occasion_reminders(integer) to authenticated;
