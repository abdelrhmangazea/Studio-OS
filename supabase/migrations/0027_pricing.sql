-- =============================================================
-- Studio OS — Bucket 8: the fee calculator
--
-- Six pricing methods, built to be thrown away individually.
--
-- The method lives in a `method` TEXT column, not an enum, and its
-- inputs live in a jsonb blob. That is deliberate: removing a method
-- after beta means deleting one file in src/lib/pricing and one line
-- from its index — no migration, no enum surgery, no other method
-- touched. Calculations already saved under a removed method still
-- read back, because nothing about them was ever schema.
--
-- pricing_config holds every rate and multiplier the methods read.
-- One jsonb rather than thirty columns, for the same reason.
-- =============================================================

create table public.fee_calculations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,

  -- Free text on purpose. See the note above.
  method       text not null,

  -- Everything typed in, and every step of the arithmetic. Saved so a
  -- price can still be explained six months later, when the rates in
  -- Settings have moved on.
  inputs       jsonb not null default '{}'::jsonb,
  result       jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id)
);

create index fee_calculations_project_idx
  on public.fee_calculations (workspace_id, project_id, created_at desc);
create index fee_calculations_method_idx
  on public.fee_calculations (workspace_id, method);

alter table public.fee_calculations enable row level security;

create policy "fee_calculations_select" on public.fee_calculations for select
  to authenticated using (workspace_id = public.current_workspace_id());
create policy "fee_calculations_insert" on public.fee_calculations for insert
  to authenticated with check (workspace_id = public.current_workspace_id());
create policy "fee_calculations_update" on public.fee_calculations for update
  to authenticated
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy "fee_calculations_delete" on public.fee_calculations for delete
  to authenticated using (workspace_id = public.current_workspace_id());


-- -------------------------------------------------------------
-- Settings the methods read
-- -------------------------------------------------------------

alter table public.studio_settings
  add column if not exists default_pricing_method text,
  add column if not exists pricing_config jsonb not null default '{}'::jsonb;

comment on column public.studio_settings.pricing_config is
  'Rates, bands and multipliers for the fee calculator. One blob so a '
  'pricing method can be removed without a migration.';


-- Sensible starting values, so the calculator is usable before the
-- designer has opened Settings. Every one is editable.
update public.studio_settings
set pricing_config = jsonb_build_object(
  'per_sqm',    jsonb_build_object('simple', 0,
                  'by_space', jsonb_build_object('living', 0, 'kitchen', 0,
                                                 'bathroom', 0, 'outdoor', 0)),
  'percentage', jsonb_build_object('flat', 10, 'bands', '[]'::jsonb),
  'per_room',   jsonb_build_object('types', jsonb_build_object(
                  'bedroom', 0, 'living', 0, 'kitchen', 0, 'bathroom', 0)),
  'cost_plus',  jsonb_build_object('markup', 30),
  'complexity', jsonb_build_object('simple', 0.9, 'standard', 1, 'complex', 1.3),
  'margin',     20,
  -- The recommended figure is the calculation; low and high are the
  -- room either side of it that a designer actually negotiates in.
  'range',      jsonb_build_object('low', 0.85, 'high', 1.2),
  -- Adds to 100. Front-loaded, because concept work is where the
  -- effort is and where a project is most likely to stop.
  'phase_split', jsonb_build_object('1', 25, '2', 30, '3', 20, '4', 10, '5', 15)
)
where pricing_config = '{}'::jsonb;


-- -------------------------------------------------------------
-- Which methods are actually being used
--
-- Beta answers "which of the six earn their place". Owner only —
-- it is a fact about the studio, not about one member.
-- -------------------------------------------------------------

create or replace function public.pricing_method_usage()
returns table (method text, uses bigint, last_used timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.method, count(*), max(c.created_at)
  from public.fee_calculations c
  where c.workspace_id = public.current_workspace_id()
  group by c.method
  order by count(*) desc;
$$;

revoke execute on function public.pricing_method_usage() from public, anon;
grant  execute on function public.pricing_method_usage() to authenticated;
