-- =============================================================
-- Studio OS — the limits, enforced where they cannot be argued with.
--
-- Triggers, not RLS. Two reasons:
--
--   1. An RLS WITH CHECK can only say no. A trigger can say WHICH
--      limit, WHAT it is, and WHICH plan lifts it — which is the
--      difference between a usable message and a dead end.
--   2. Counting siblings inside a policy runs on every row of every
--      statement. A BEFORE INSERT trigger runs once per new row.
--
-- THE ERROR FORMAT IS A CONTRACT
--
--     LIMIT_REACHED:<what>:<limit>:<plan>
--
-- The client parses it and renders a real sentence with an upgrade
-- link. It is never shown raw. Adding a limit means adding a trigger
-- that raises in this shape and a line in the dictionary — nothing
-- else changes.
--
-- WHAT IS NOT ENFORCED HERE, AND WHY
--
-- `reports_enabled` is not in this file. Reports are read-only over
-- data the studio already owns and which Bucket 9 guarantees stays
-- exportable after a downgrade. Blocking those reads server-side
-- would break export. So reports are gated in the UI ONLY, and that
-- is a deliberate, stated exception rather than an oversight.
-- =============================================================


-- -------------------------------------------------------------
-- Contacts
-- -------------------------------------------------------------

create or replace function public.contacts_within_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pk   text;
  lim  integer;
  used integer;
begin
  pk := public.effective_plan_key(new.workspace_id);
  select max_contacts into lim from public.plans where key = pk;
  if lim is null then return new; end if;

  -- Rows in the bin do not count. Deleting a contact to make room is
  -- a reasonable thing to do, and it should work immediately rather
  -- than in thirty days.
  select count(*) into used
    from public.contacts
   where workspace_id = new.workspace_id and deleted_at is null;

  if used >= lim then
    raise exception 'LIMIT_REACHED:contacts:%:%', lim, pk;
  end if;

  return new;
end;
$$;

drop trigger if exists contacts_within_plan on public.contacts;
create trigger contacts_within_plan before insert on public.contacts
  for each row execute function public.contacts_within_plan();


-- -------------------------------------------------------------
-- Active projects
--
-- "Active" means it is live work: not binned, not archived, and not
-- closed or on hold. A studio on Free with one finished project can
-- start another without deleting the first — archiving is enough.
-- -------------------------------------------------------------

create or replace function public.projects_within_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pk   text;
  lim  integer;
  used integer;
begin
  pk := public.effective_plan_key(new.workspace_id);
  select max_active_projects into lim from public.plans where key = pk;
  if lim is null then return new; end if;

  select count(*) into used
    from public.projects
   where workspace_id = new.workspace_id
     and deleted_at is null
     and not is_archived
     and state not in ('closed', 'on_hold');

  if used >= lim then
    raise exception 'LIMIT_REACHED:projects:%:%', lim, pk;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_within_plan on public.projects;
create trigger projects_within_plan before insert on public.projects
  for each row execute function public.projects_within_plan();


-- -------------------------------------------------------------
-- Team seats
--
-- Counts active members only. Deactivating somebody frees their seat,
-- which is what a studio expects when a freelancer's contract ends.
-- -------------------------------------------------------------

create or replace function public.seats_within_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pk   text;
  lim  integer;
  used integer;
begin
  -- The signup trigger creates the workspace and its first profile in
  -- one transaction, before any subscription row exists. The owner's
  -- own seat is never in question.
  if new.role = 'owner' then return new; end if;

  pk := public.effective_plan_key(new.workspace_id);
  select max_team_seats into lim from public.plans where key = pk;
  if lim is null then return new; end if;

  select count(*) into used
    from public.profiles
   where workspace_id = new.workspace_id and active;

  if used >= lim then
    raise exception 'LIMIT_REACHED:seats:%:%', lim, pk;
  end if;

  return new;
end;
$$;

drop trigger if exists seats_within_plan on public.profiles;
create trigger seats_within_plan before insert on public.profiles
  for each row execute function public.seats_within_plan();


-- -------------------------------------------------------------
-- Features
-- -------------------------------------------------------------

create or replace function public.require_feature(p_feature text, p_workspace uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pk text := public.effective_plan_key(coalesce(p_workspace, public.current_workspace_id()));
  ok boolean;
begin
  execute format('select %I from public.plans where key = $1', p_feature)
    into ok using pk;

  if not coalesce(ok, false) then
    raise exception 'FEATURE_LOCKED:%:%', p_feature, pk;
  end if;
end;
$$;

revoke execute on function public.require_feature(text, uuid) from public;
revoke execute on function public.require_feature(text, uuid) from anon, authenticated;


/** The fee calculator. */
create or replace function public.fee_calculations_within_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_feature('fee_calculator_enabled', new.workspace_id);
  return new;
end;
$$;

drop trigger if exists fee_calculations_within_plan on public.fee_calculations;
create trigger fee_calculations_within_plan before insert on public.fee_calculations
  for each row execute function public.fee_calculations_within_plan();


/**
 * The client portal.
 *
 * issue_portal_link is SECURITY DEFINER, so this cannot be reached by
 * hiding a button — the check is inside the only thing that can mint
 * a link.
 */
-- Reproduced from its existing definition with ONE line added. The
-- revisions seeding below is load-bearing — the portal reads the free
-- allowance from it — and the return type is text, not a row. Both
-- would have been lost by rewriting this from memory.
create or replace function public.issue_portal_link(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws        uuid := public.current_workspace_id();
  new_token text;
begin
  if not exists (
    select 1 from public.projects
    where id = p_project_id and workspace_id = ws
  ) then
    raise exception 'project not found in your workspace';
  end if;

  -- ↓ the only new line
  perform public.require_feature('client_portal_enabled', ws);

  update public.portal_links
  set is_active = false, revoked_at = now()
  where project_id = p_project_id and workspace_id = ws and is_active;

  new_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.portal_links (workspace_id, project_id, token)
  values (ws, p_project_id, new_token);

  insert into public.revisions (workspace_id, project_id, free_allowance)
  select ws, p_project_id, coalesce(s.default_revision_allowance, 2)
  from public.studio_settings s
  where s.workspace_id = ws
  on conflict (project_id) do nothing;

  return new_token;
end;
$$;

revoke execute on function public.issue_portal_link(uuid) from public;
revoke execute on function public.issue_portal_link(uuid) from anon;
grant  execute on function public.issue_portal_link(uuid) to authenticated;
