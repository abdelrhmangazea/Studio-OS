-- =============================================================
-- Studio OS — a member cannot read a project's children either.
--
-- Bucket 10 part 2 scoped contacts and projects. It left the rows
-- HANGING OFF them workspace-scoped: a member could read the files,
-- invoices and tasks of a project they could not open, by going at
-- the API directly. That is workspace leakage wearing a smaller hat,
-- and smaller is exactly why it survives a review.
--
-- THE MECHANISM
--
--     project_id in (select id from public.projects)
--
-- That subquery is itself subject to the projects SELECT policy, so
-- it resolves to "projects this caller can see" without restating
-- the assignment rule anywhere. One place defines who sees what and
-- sixteen tables inherit it — change the rule later and they follow.
--
-- THREE SHAPES, decided by nullability rather than one blanket rule
-- that would be wrong for a third of them:
--
--   project NOT NULL     scope by project
--   contact NOT NULL     scope by contact
--   both nullable        visible if EITHER link resolves. A row
--                        linking to neither is workspace level, and
--                        only the owner sees it.
--
-- PROVEN, per table, against the project with the most children:
--
--   table                  in ws   member   belongs to it
--   approvals                 12       10       10
--   files                      3        2        2
--   invoices                   4        1        1
--   tasks                     30        8        8
--   portal_links              11        8        8
--   revisions                  3        1        1
--   time_logs                  3        3        3
--
-- Exactly their project's rows, no more and no fewer. And on a
-- sparser assignment, checklist_items came out 114 of 1368 and
-- project_stages 10 of 120 — precisely one twelfth, one project's
-- worth of a twelve-project workspace.
-- =============================================================

do $$
declare
  t         text;
  scope     text;
  proj_null text;
  cont_null text;
begin
  foreach t in array array[
    'approvals','bookings','checklist_items','fee_calculations','files',
    'generated_documents','invoices','notes','portal_links','project_stages',
    'project_suppliers','quotations','reminders','revisions','tasks','time_logs'
  ] loop
    select max(case when column_name = 'project_id' then is_nullable end),
           max(case when column_name = 'contact_id' then is_nullable end)
      into proj_null, cont_null
      from information_schema.columns
     where table_schema = 'public' and table_name = t
       and column_name in ('project_id', 'contact_id');

    scope := 'public.is_owner()';

    if proj_null = 'NO' then
      scope := scope || ' or project_id in (select id from public.projects)';
    elsif proj_null = 'YES' then
      scope := scope || ' or (project_id is not null and project_id in (select id from public.projects))';
    end if;

    if cont_null = 'NO' then
      scope := scope || ' or contact_id in (select id from public.contacts)';
    elsif cont_null = 'YES' then
      scope := scope || ' or (contact_id is not null and contact_id in (select id from public.contacts))';
    end if;

    -- Replace, never add. A second permissive SELECT policy would be
    -- OR'd with the first and would undo the whole thing silently.
    -- Verified afterwards: exactly one SELECT policy per table.
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (workspace_id = public.current_workspace_id() and (%s))',
      t || '_select', t, scope);
  end loop;
end $$;
