-- =============================================================
-- Studio OS — viewer stops being fiction.
--
-- Before this migration there were 88 write policies and only five
-- tables checked role at all. A `viewer` could insert, update and
-- delete contacts, projects, invoices — everything. The role existed
-- in the dropdown and nowhere else.
--
-- TWO LAYERS, BECAUSE ONE IS NOT ENOUGH
--
-- Layer 1 is RLS on every write policy. That closes the direct API.
--
-- Layer 2 is a trigger, and it is the one that matters. Thirteen
-- SECURITY DEFINER functions — complete_stage, override_gate,
-- issue_portal_link, soft_delete_contact and the rest — run as the
-- table owner and are NOT SUBJECT TO RLS AT ALL. However tight the
-- policies are, a viewer calling those goes straight through. A
-- trigger fires for them too.
--
-- Proven, not asserted: as a viewer, a delete was attempted against
-- all 32 workspace tables. 32 blocked, 0 allowed. Direct inserts
-- refused. soft_delete_contact() and issue_portal_link() refused.
--
-- THE BRANCH THAT KEEPS THE BOOKING PAGE ALIVE
--
-- public_create_booking inserts a contact and a project on behalf of
-- somebody with no account and no profile. can_write() is false for
-- them and always will be. Without the auth.uid() IS NULL branch,
-- closing the viewer hole would have closed the booking page — the
-- product's entire front door — and it would have looked like a role
-- bug rather than a billing one. Verified working as anon after.
-- =============================================================

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role in ('owner', 'member')
  );
$$;

revoke execute on function public.can_write() from public;
revoke execute on function public.can_write() from anon;
grant  execute on function public.can_write() to authenticated;


-- LAYER 1. Applied by reading pg_policies rather than by hand: there
-- are 75 of them, and a hand-written list is a list with something
-- missing from it.
--
-- profiles and feedback are excluded deliberately. A viewer must
-- still set their own language and theme, and must still be able to
-- report a bug. Neither is workspace data.
do $$
declare r record;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and cmd in ('INSERT', 'UPDATE', 'DELETE')
       and tablename not in ('profiles', 'feedback', 'plans', 'subscriptions',
                             'promo_codes', 'promo_redemptions', 'workspaces')
       and (coalesce(qual, '') || coalesce(with_check, '')) like '%current_workspace_id()%'
       and (coalesce(qual, '') || coalesce(with_check, '')) not like '%can_write()%'
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (%s and public.can_write())',
                     r.policyname, r.tablename, r.with_check);
    elsif r.cmd = 'DELETE' then
      execute format('alter policy %I on public.%I using (%s and public.can_write())',
                     r.policyname, r.tablename, r.qual);
    else
      execute format('alter policy %I on public.%I using (%s and public.can_write()) with check (%s and public.can_write())',
                     r.policyname, r.tablename, r.qual, r.with_check);
    end if;
  end loop;
end $$;


-- LAYER 2.
create or replace function public.assert_can_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No account at all: the public booking flow. It does its own
  -- validation and has no profile to check. See the header.
  if auth.uid() is not null and not public.can_write() then
    raise exception 'READ_ONLY:this role cannot change anything';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke execute on function public.assert_can_write() from public;
revoke execute on function public.assert_can_write() from anon, authenticated;

do $$
declare t text;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join information_schema.columns col
        on col.table_schema = 'public' and col.table_name = c.relname
       and col.column_name = 'workspace_id'
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname not in ('feedback', 'feature_usage', 'subscriptions',
                             'promo_redemptions', 'profiles')
     group by c.relname
  loop
    execute format('drop trigger if exists assert_can_write on public.%I', t);
    execute format(
      'create trigger assert_can_write before insert or update or delete on public.%I
         for each row execute function public.assert_can_write()', t);
  end loop;
end $$;


-- -------------------------------------------------------------
-- Assignment
--
-- Only the OWNER sees everything. Everyone else sees what is
-- assigned to them, and unassigned means owner-only — so a new
-- member joins seeing nothing until somebody deliberately hands
-- them something, rather than seeing every client by default.
--
-- This applies to viewers too. "Only the owner sees everything"
-- reads as exactly that, and a read-only role with a view of every
-- client is a larger exposure than the role is worth.
-- -------------------------------------------------------------

alter table public.contacts add column if not exists assigned_to uuid
  references public.profiles(id) on delete set null;
alter table public.projects add column if not exists assigned_to uuid
  references public.profiles(id) on delete set null;

create index if not exists contacts_assigned_idx on public.contacts (assigned_to)
  where assigned_to is not null;
create index if not exists projects_assigned_idx on public.projects (assigned_to)
  where assigned_to is not null;

drop policy if exists "contacts_select" on public.contacts;
create policy "contacts_select" on public.contacts for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and deleted_at is null
    and (public.is_owner() or assigned_to = auth.uid())
  );

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and deleted_at is null
    and (public.is_owner() or assigned_to = auth.uid())
  );

-- Writing follows seeing: a member must not edit what they cannot read.
drop policy if exists "contacts_update" on public.contacts;
create policy "contacts_update" on public.contacts for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and deleted_at is null
    and public.can_write()
    and (public.is_owner() or assigned_to = auth.uid())
  )
  with check (workspace_id = public.current_workspace_id() and public.can_write());

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and deleted_at is null
    and public.can_write()
    and (public.is_owner() or assigned_to = auth.uid())
  )
  with check (workspace_id = public.current_workspace_id() and public.can_write());


-- The grant leak, for the third time in two buckets. Every new
-- function — including trigger functions — picks up a PUBLIC EXECUTE
-- grant at creation, and revoking only from anon/authenticated leaves
-- it. spike/security-check.sql caught these; I did not.
do $$
declare fn text;
begin
  foreach fn in array array[
    'contacts_within_plan()', 'projects_within_plan()', 'seats_within_plan()',
    'fee_calculations_within_plan()', 'generated_within_plan()',
    'subscribe_new_workspace()', 'touch_subscription()'
  ] loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon, authenticated', fn);
  end loop;
end $$;
