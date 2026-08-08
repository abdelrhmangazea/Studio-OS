-- =============================================================
-- Studio OS — deleting a client or a project puts it in a bin for
-- thirty days. It does not destroy it.
--
-- WHY THIS IS NOT A SMALL FEATURE
--
-- There was no delete for contacts or projects at all, which is the
-- only reason nobody has lost anything yet. A plain DELETE would
-- cascade: deleting one contact takes their projects, and every
-- project takes its invoices, generated documents, files, quotations,
-- time logs, approvals, portal links and tasks with it. Twenty-one
-- foreign keys, almost all of them CASCADE. One misclick and a year
-- of a studio's work is gone with no undo.
--
-- So the delete a designer can reach is a soft one, and the hard one
-- happens thirty days later when they have had time to notice.
--
-- Deleting a contact also soft-deletes their projects. The alternative
-- is a project sitting in the list whose client no longer exists.
-- Restoring the contact brings back exactly the projects that went
-- down with it, and nothing that was already deleted before — which
-- is why the projects record WHICH deletion took them.
-- =============================================================


alter table public.contacts add column if not exists deleted_at timestamptz;
alter table public.projects add column if not exists deleted_at timestamptz;

-- Set when a project was deleted as a side effect of its contact
-- going. Restoring that contact brings back only these.
alter table public.projects add column if not exists deleted_with_contact uuid;

create index if not exists contacts_live_idx on public.contacts (workspace_id)
  where deleted_at is null;
create index if not exists projects_live_idx on public.projects (workspace_id)
  where deleted_at is null;


-- -------------------------------------------------------------
-- Into the bin
-- -------------------------------------------------------------

create or replace function public.soft_delete_contact(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if not exists (
    select 1 from public.contacts c where c.id = p_id and c.workspace_id = ws
  ) then
    raise exception 'that contact does not belong to your workspace';
  end if;

  -- Only projects that are live right now. One already in the bin
  -- stays there on its own terms and must not be resurrected by
  -- restoring the contact.
  update public.projects
  set deleted_at = now(), deleted_with_contact = p_id
  where contact_id = p_id and workspace_id = ws and deleted_at is null;

  update public.contacts set deleted_at = now() where id = p_id;
end;
$$;

create or replace function public.restore_contact(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if not exists (
    select 1 from public.contacts c where c.id = p_id and c.workspace_id = ws
  ) then
    raise exception 'that contact does not belong to your workspace';
  end if;

  update public.contacts set deleted_at = null where id = p_id;

  update public.projects
  set deleted_at = null, deleted_with_contact = null
  where deleted_with_contact = p_id and workspace_id = ws;
end;
$$;


create or replace function public.soft_delete_project(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if not exists (
    select 1 from public.projects p where p.id = p_id and p.workspace_id = ws
  ) then
    raise exception 'that project does not belong to your workspace';
  end if;

  -- Deleted on its own, so it is not tied to a contact's deletion.
  update public.projects
  set deleted_at = now(), deleted_with_contact = null
  where id = p_id;
end;
$$;

create or replace function public.restore_project(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
  owner_deleted timestamptz;
begin
  if not exists (
    select 1 from public.projects p where p.id = p_id and p.workspace_id = ws
  ) then
    raise exception 'that project does not belong to your workspace';
  end if;

  -- A project cannot come back to a client who is still in the bin;
  -- it would show in the list attached to nobody.
  select c.deleted_at into owner_deleted
  from public.projects p
  join public.contacts c on c.id = p.contact_id
  where p.id = p_id;

  if owner_deleted is not null then
    raise exception 'restore the client first';
  end if;

  update public.projects
  set deleted_at = null, deleted_with_contact = null
  where id = p_id;
end;
$$;


-- -------------------------------------------------------------
-- What is in the bin, and how long it has left
-- -------------------------------------------------------------

create or replace function public.deleted_items()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if ws is null then
    return jsonb_build_object('contacts', '[]'::jsonb, 'projects', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
        'deleted_at', c.deleted_at,
        'purges_at', c.deleted_at + interval '30 days',
        'projects', (select count(*) from public.projects p
                     where p.deleted_with_contact = c.id)
      ) order by c.deleted_at desc)
      from public.contacts c
      where c.workspace_id = ws and c.deleted_at is not null
    ), '[]'::jsonb),

    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'code', p.code, 'name', p.name,
        'deleted_at', p.deleted_at,
        'purges_at', p.deleted_at + interval '30 days',
        -- Went down with its client, so it comes back with them
        -- rather than on its own.
        'with_contact', p.deleted_with_contact is not null
      ) order by p.deleted_at desc)
      from public.projects p
      where p.workspace_id = ws and p.deleted_at is not null
    ), '[]'::jsonb)
  );
end;
$$;


-- -------------------------------------------------------------
-- Thirty days later
--
-- THIS is the destructive one, and it is the only one. It cascades
-- through everything, which is the point — by now the studio has had
-- a month to notice.
--
-- Storage objects are NOT removed here. Nothing in this database can
-- reach them, and a half-deleted file is worse than an orphaned one.
-- See DISASTER-RECOVERY.md.
-- -------------------------------------------------------------

create or replace function public.purge_expired_deletions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone_projects integer;
  gone_contacts integer;
begin
  -- Projects first. Deleting the contact would take them anyway, but
  -- doing it explicitly keeps the count honest.
  with removed as (
    delete from public.projects
    where deleted_at is not null and deleted_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into gone_projects from removed;

  with removed as (
    delete from public.contacts
    where deleted_at is not null and deleted_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into gone_contacts from removed;

  return jsonb_build_object(
    'projects_purged', gone_projects,
    'contacts_purged', gone_contacts,
    'ran_at', now()
  );
end;
$$;


revoke execute on function public.soft_delete_contact(uuid) from public;
revoke execute on function public.soft_delete_contact(uuid) from anon;
grant  execute on function public.soft_delete_contact(uuid) to authenticated;

revoke execute on function public.restore_contact(uuid) from public;
revoke execute on function public.restore_contact(uuid) from anon;
grant  execute on function public.restore_contact(uuid) to authenticated;

revoke execute on function public.soft_delete_project(uuid) from public;
revoke execute on function public.soft_delete_project(uuid) from anon;
grant  execute on function public.soft_delete_project(uuid) to authenticated;

revoke execute on function public.restore_project(uuid) from public;
revoke execute on function public.restore_project(uuid) from anon;
grant  execute on function public.restore_project(uuid) to authenticated;

revoke execute on function public.deleted_items() from public;
revoke execute on function public.deleted_items() from anon;
grant  execute on function public.deleted_items() to authenticated;

-- Nobody can call the purge from the app. It is not a button.
revoke execute on function public.purge_expired_deletions() from public;
revoke execute on function public.purge_expired_deletions() from anon, authenticated;


-- -------------------------------------------------------------
-- Running the purge
--
-- pg_cron is available on this project but not installed. Enabling it
-- is a decision with a cost (it runs as a background worker), so it
-- is left to a deliberate act rather than turned on by a migration:
--
--   create extension if not exists pg_cron with schema extensions;
--   select cron.schedule('purge-deleted', '0 3 * * *',
--                        $cron$ select public.purge_expired_deletions() $cron$);
--
-- Until that is done NOTHING is ever hard-deleted. The bin simply
-- keeps growing, which is the safe direction to fail in.
-- -------------------------------------------------------------
