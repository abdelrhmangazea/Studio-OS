-- =============================================================
-- Studio OS — Bucket 7: the rules that create work by themselves
--
-- All of this lives in the database rather than in a screen, so a
-- rule fires on the fact regardless of which surface caused it — the
-- app, the portal, or a direct API call.
--
-- WHERE EACH SIGNAL COMES FROM
--
-- There is no gate flag for "fee proposal sent" or "contract sent",
-- so the signal is the moment the document is actually generated —
-- the only real, timestamped record that it went out.
--
-- The two three-day chases are created when the welcome pack is
-- marked sent, and CLOSE THEMSELVES when the thing they are waiting
-- for arrives: the questionnaire flag flipping, or a booking landing
-- for that client. That is what "in 3 days IF it has not returned"
-- means — the task exists from the start and simply stops mattering.
-- =============================================================


-- -------------------------------------------------------------
-- 1. A small helper, so every rule creates tasks the same way
-- -------------------------------------------------------------

create or replace function public.raise_task(
  p_workspace uuid,
  p_title     text,
  p_contact   uuid,
  p_project   uuid,
  p_stage     text,
  p_due       date,
  p_rule      text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tasks
    (workspace_id, title, contact_id, project_id, stage_key, due_date, source, rule_key)
  values
    (p_workspace, p_title, p_contact, p_project, p_stage, p_due, 'stage_rule', p_rule)
  -- The partial unique index means a rule that fires twice while its
  -- first task is still open simply does nothing the second time.
  on conflict do nothing;
end;
$$;


-- -------------------------------------------------------------
-- 2. Fee proposal sent, and contract sent → chase in 48 hours
-- -------------------------------------------------------------

create or replace function public.task_rules_on_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare contact_row public.contacts%rowtype;
begin
  if new.project_id is null then
    return new;
  end if;

  select * into contact_row from public.contacts where id = new.contact_id;

  if new.template_key = 'fee_proposal_send' then
    perform public.raise_task(
      new.workspace_id,
      'Follow up on the fee proposal',
      new.contact_id, new.project_id, '02_fee_proposal',
      (now() + interval '48 hours')::date,
      'fee_proposal_followup');

  elsif new.template_key = 'contract_send' then
    perform public.raise_task(
      new.workspace_id,
      'Follow up on the contract',
      new.contact_id, new.project_id, '03_contract',
      (now() + interval '48 hours')::date,
      'contract_followup');
  end if;

  return new;
end;
$$;

create trigger documents_raise_tasks
  after insert on public.generated_documents
  for each row execute function public.task_rules_on_document();


-- -------------------------------------------------------------
-- 3. Welcome pack sent → two three-day chases, which close
--    themselves when the thing arrives
-- -------------------------------------------------------------

create or replace function public.task_rules_on_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proj public.projects%rowtype;
  was  boolean;
  now_ boolean;
begin
  if new.stage_key <> '04_onboarding' then
    return new;
  end if;

  select * into proj from public.projects where id = new.project_id;

  -- welcome pack: false/absent → true
  was  := coalesce((old.gate_state ->> 'welcome_pack_sent')::boolean, false);
  now_ := coalesce((new.gate_state ->> 'welcome_pack_sent')::boolean, false);

  if now_ and not was then
    perform public.raise_task(
      new.workspace_id,
      'Questionnaire has not come back — chase it',
      proj.contact_id, new.project_id, '04_onboarding',
      (now() + interval '3 days')::date,
      'questionnaire_chase');

    perform public.raise_task(
      new.workspace_id,
      'Kickoff has not been booked — chase it',
      proj.contact_id, new.project_id, '04_onboarding',
      (now() + interval '3 days')::date,
      'kickoff_chase');
  end if;

  -- questionnaire returned → its chase is over
  was  := coalesce((old.gate_state ->> 'questionnaire_returned')::boolean, false);
  now_ := coalesce((new.gate_state ->> 'questionnaire_returned')::boolean, false);

  if now_ and not was then
    update public.tasks
    set is_done = true, done_at = now()
    where project_id = new.project_id
      and rule_key = 'questionnaire_chase'
      and not is_done;
  end if;

  return new;
end;
$$;

create trigger stages_raise_tasks
  after update on public.project_stages
  for each row execute function public.task_rules_on_stage();


-- A booking for this client ends the kickoff chase, whichever project
-- it belongs to — the client booked, which is the whole point.
create or replace function public.task_rules_on_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contact_id is null then
    return new;
  end if;

  update public.tasks
  set is_done = true, done_at = now()
  where contact_id = new.contact_id
    and rule_key = 'kickoff_chase'
    and not is_done;

  return new;
end;
$$;

create trigger bookings_close_kickoff_chase
  after insert or update of contact_id on public.bookings
  for each row execute function public.task_rules_on_booking();


-- -------------------------------------------------------------
-- 4. A portal change request becomes a task immediately
--
-- No rule_key: every change request is its own piece of work, so
-- these are allowed to stack. This is the live counterpart of the
-- backfill in 0018.
-- -------------------------------------------------------------

create or replace function public.task_rules_on_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare proj public.projects%rowtype;
begin
  if new.decision <> 'changes_requested' then
    return new;
  end if;

  select * into proj from public.projects where id = new.project_id;

  insert into public.tasks
    (workspace_id, title, contact_id, project_id, stage_key, due_date, source)
  values
    (new.workspace_id,
     'Change requested by the client: ' || left(coalesce(new.comment, ''), 120),
     proj.contact_id, new.project_id, new.stage_key,
     new.decided_at::date, 'portal');

  return new;
end;
$$;

create trigger approvals_raise_tasks
  after insert on public.approvals
  for each row execute function public.task_rules_on_approval();


-- -------------------------------------------------------------
-- 5. Delivery enrols the CLIENT in follow-up
--
-- Fires on delivered_at being set, so it happens however the project
-- gets delivered. Everything it creates hangs off the contact:
-- archiving the project must never take the relationship with it.
-- -------------------------------------------------------------

create or replace function public.enrol_in_followup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws       uuid := new.workspace_id;
  cid      uuid := new.contact_id;
  born     date;
  this_year integer := extract(year from now())::integer;
  occ      record;
  bday     date;
begin
  if new.delivered_at is null or old.delivered_at is not null then
    return new;
  end if;

  -- 6 months / 1 year / 2 years, from the handover itself. One-offs.
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

  -- Birthday, and ONLY where one is actually recorded. Never inferred.
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

  -- The five occasions for the current year. New Year is fixed on
  -- 1 January; the four Hijri ones come from what the designer typed,
  -- and stay dateless until they do — never computed behind their back.
  insert into public.reminders
    (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
  values (ws, cid, new.id, 'new_year', make_date(this_year, 1, 1),
          'occasion_new_year', true, this_year)
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
    values (
      ws, cid, new.id, occ.kind::public.reminder_kind,
      (select d.date from public.occasion_dates d
        where d.workspace_id = ws and d.year = this_year and d.occasion_key = occ.kind),
      occ.template, true, this_year)
    on conflict do nothing;
  end loop;

  -- The four post-delivery marketing jobs the spec names.
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

create trigger projects_enrol_followup
  after update of delivered_at on public.projects
  for each row execute function public.enrol_in_followup();


-- -------------------------------------------------------------
-- 6. Filling in occasion dates once the designer enters them
--
-- Called after saving the year's dates. It fills the reminders that
-- were waiting dateless, and creates that year's row for anyone
-- enrolled who does not have one yet.
-- -------------------------------------------------------------

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

  -- New Year needs no input from anybody. The literal must be cast:
  -- in an INSERT ... SELECT it arrives as text, and `kind` is an enum.
  insert into public.reminders
    (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
  select distinct ws, r.contact_id, r.project_id,
         'new_year'::public.reminder_kind, make_date(p_year, 1, 1),
         'occasion_new_year', true, p_year
  from public.reminders r
  where r.workspace_id = ws and r.kind = 'followup_6m'
  on conflict do nothing;

  for occ in
    select * from (values
      ('hijri_new_year', 'occasion_hijri_new_year'),
      ('ramadan',        'occasion_ramadan'),
      ('eid_fitr',       'occasion_eid_fitr'),
      ('eid_adha',       'occasion_eid_adha')
    ) as t(kind, template)
  loop
    -- anyone enrolled but with no row for this year yet
    insert into public.reminders
      (workspace_id, contact_id, project_id, kind, due_date, template_key, recurring, year)
    select distinct ws, r.contact_id, r.project_id, occ.kind::public.reminder_kind,
           (select d.date from public.occasion_dates d
             where d.workspace_id = ws and d.year = p_year and d.occasion_key = occ.kind),
           occ.template, true, p_year
    from public.reminders r
    where r.workspace_id = ws and r.kind = 'followup_6m'
    on conflict do nothing;

    -- and fill in the ones that were still waiting for a date
    update public.reminders r
    set due_date = d.date
    from public.occasion_dates d
    where r.workspace_id = ws
      and r.kind = occ.kind::public.reminder_kind
      and r.year = p_year
      and r.due_date is null
      and d.workspace_id = ws and d.year = p_year and d.occasion_key = occ.kind;

    -- Accumulated, not overwritten: the loop runs four times and the
    -- caller wants the total, not whatever the last occasion did.
    get diagnostics n = row_count;
    touched := touched + n;
  end loop;

  return touched;
end;
$$;


-- -------------------------------------------------------------
-- 7. Grants — none of this is public
-- -------------------------------------------------------------

revoke execute on function public.raise_task(uuid, text, uuid, uuid, text, date, text)
  from public, anon, authenticated;
revoke execute on function public.task_rules_on_document()  from public, anon, authenticated;
revoke execute on function public.task_rules_on_stage()     from public, anon, authenticated;
revoke execute on function public.task_rules_on_booking()   from public, anon, authenticated;
revoke execute on function public.task_rules_on_approval()  from public, anon, authenticated;
revoke execute on function public.enrol_in_followup()       from public, anon, authenticated;
revoke execute on function public.sync_occasion_reminders(integer) from public, anon;

grant execute on function public.sync_occasion_reminders(integer) to authenticated;
