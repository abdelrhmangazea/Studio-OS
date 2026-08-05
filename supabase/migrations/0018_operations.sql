-- =============================================================
-- Studio OS — Bucket 7: Operations Layer (schema)
--
-- Tasks, reminders, and the occasion dates the designer enters by
-- hand. This is the last schema change in V1.
--
-- Two things here are load-bearing and worth naming:
--
--   * Overdue is not a column. It is `is_done = false and due_date <
--     today`, computed at read time, so nothing can quietly expire or
--     roll an item out of sight. An overdue item stays overdue until
--     somebody closes it.
--
--   * Reminders hang off the CONTACT. project_id is only ever a
--     breadcrumb back to the work that started the relationship.
--     Delivering a project archives the project, never the
--     relationship, so a delivered project must not take its
--     reminders off the dashboard with it.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Types
-- -------------------------------------------------------------

create type public.task_source as enum ('manual', 'stage_rule', 'followup', 'portal');

create type public.reminder_kind as enum (
  'followup_6m', 'followup_1y', 'followup_2y',
  'birthday',
  'hijri_new_year', 'ramadan', 'eid_fitr', 'eid_adha', 'new_year',
  'custom'
);


-- -------------------------------------------------------------
-- 2. Tables
-- -------------------------------------------------------------

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  title        text not null,
  contact_id   uuid references public.contacts (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  stage_key    text references public.stage_definitions (stage_key),
  due_date     date,
  is_done      boolean not null default false,
  done_at      timestamptz,
  created_by   uuid references public.profiles (id),
  source       public.task_source not null default 'manual',
  created_at   timestamptz not null default now(),

  -- What an auto-created task is waiting for, so the rule that made it
  -- can close it again when the wait is over. Null for manual tasks.
  rule_key     text
);

create index tasks_open_idx on public.tasks (workspace_id, is_done, due_date);
create index tasks_project_idx on public.tasks (workspace_id, project_id);

-- One open auto-task per rule per project. Stops a rule that fires
-- twice from stacking duplicates on the designer's list.
create unique index tasks_one_open_per_rule
  on public.tasks (project_id, rule_key) where rule_key is not null and not is_done;


create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  contact_id   uuid not null references public.contacts (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete set null,
  kind         public.reminder_kind not null,
  -- Null while an occasion's date for that year has not been entered.
  -- The dashboard says so out loud rather than skipping it silently.
  due_date     date,
  is_done      boolean not null default false,
  done_at      timestamptz,
  template_key text,
  recurring    boolean not null default false,
  -- Which year an occasion reminder belongs to. Null for the one-offs.
  year         integer,
  created_at   timestamptz not null default now()
);

create index reminders_open_idx on public.reminders (workspace_id, is_done, due_date);

-- One reminder per contact per kind — per year for the recurring ones.
create unique index reminders_one_per_kind
  on public.reminders (contact_id, kind, coalesce(year, 0));


create table public.occasion_dates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  year         integer not null,
  occasion_key text not null,
  date         date not null,

  unique (workspace_id, year, occasion_key)
);


-- -------------------------------------------------------------
-- 3. Project value — optional, always
--
-- Used by the "average project value" insight, which prefers this
-- figure and falls back to the sum of the project's invoices. A
-- project with neither is left OUT of the average rather than counted
-- as zero, which would drag the number down and make it a lie.
--
-- Nothing requires this to create or progress a project.
-- -------------------------------------------------------------

alter table public.projects
  add column if not exists value numeric;

comment on column public.projects.value is
  'Optional. The designer''s own figure for what this project is worth.';


-- -------------------------------------------------------------
-- 4. RLS
-- -------------------------------------------------------------

alter table public.tasks          enable row level security;
alter table public.reminders      enable row level security;
alter table public.occasion_dates enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['tasks', 'reminders', 'occasion_dates']
  loop
    execute format($f$
      create policy %1$I on public.%2$I for select
        to authenticated using (workspace_id = public.current_workspace_id());
      create policy %3$I on public.%2$I for insert
        to authenticated with check (workspace_id = public.current_workspace_id());
      create policy %4$I on public.%2$I for update
        to authenticated
        using      (workspace_id = public.current_workspace_id())
        with check (workspace_id = public.current_workspace_id());
      create policy %5$I on public.%2$I for delete
        to authenticated using (workspace_id = public.current_workspace_id());
    $f$, tbl||'_select', tbl, tbl||'_insert', tbl||'_update', tbl||'_delete');
  end loop;
end;
$$;


-- -------------------------------------------------------------
-- 5. BACKFILL — nothing recorded before tasks existed may be lost
--
-- Bucket 6 recorded portal change requests on the timeline and as a
-- counter, because tasks did not exist yet. Every one of those that is
-- still open now becomes a real task, dated when the client actually
-- asked. A request already answered by a later approval is left alone.
-- -------------------------------------------------------------

insert into public.tasks
  (workspace_id, title, contact_id, project_id, stage_key, due_date, source, created_at)
select
  a.workspace_id,
  'Change requested by the client: ' || left(coalesce(a.comment, ''), 120),
  p.contact_id,
  a.project_id,
  a.stage_key,
  a.decided_at::date,
  'portal',
  a.decided_at
from public.approvals a
join public.projects p on p.id = a.project_id
where a.decision = 'changes_requested'
  and not exists (
    select 1 from public.approvals later
    where later.project_id = a.project_id
      and later.stage_key = a.stage_key
      and coalesce(later.item_ref, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(a.item_ref, '00000000-0000-0000-0000-000000000000'::uuid)
      and later.decision = 'approved'
      and later.decided_at > a.decided_at
  );
