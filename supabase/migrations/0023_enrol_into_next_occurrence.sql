-- =============================================================
-- Studio OS — enrol into the NEXT occurrence, not this calendar year
--
-- 0021 stopped enrolling clients into occasions that had already
-- passed, which killed the false "overdue" rows. But it went too far
-- the other way: a client delivered in August, after all four Hijri
-- dates for the year had gone, was enrolled into almost nothing.
--
-- Delivering in August should still set up Ramadan. It is NEXT
-- Ramadan, not this one. So: this year's date if it is still ahead,
-- otherwise next year's — dated when the designer has entered it,
-- dateless when they have not, which is precisely what the dashboard
-- prompt exists to chase.
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
  occ_year  integer;
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

  -- Birthday, and ONLY where one is recorded. Never inferred, and no
  -- dateless placeholder for a client who has not given one.
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

  -- New Year: the next 1 January. Fixed, and never asked for.
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

    if occ_date is not null and occ_date >= current_date then
      occ_year := this_year;
    else
      occ_year := this_year + 1;
      select d.date into occ_date
      from public.occasion_dates d
      where d.workspace_id = ws and d.year = occ_year and d.occasion_key = occ.kind;
    end if;

    insert into public.reminders
      (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
    values (ws, cid, new.id, occ.kind::public.reminder_kind, occ_date,
            occ.template, true, occ_year)
    on conflict do nothing;
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
