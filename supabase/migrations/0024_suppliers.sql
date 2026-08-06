-- =============================================================
-- Studio OS — Suppliers
--
-- Bucket 7 said not to build this. The studio asked for it after V1
-- was complete, so it is added here as its own thing rather than
-- backdated into a bucket that explicitly excluded it.
--
-- A supplier belongs to the studio, not to a project — the same
-- carpenter works on many jobs. Projects link to them through
-- project_suppliers, which carries the one thing that IS per project:
-- what they were used for.
-- =============================================================

create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null default public.current_workspace_id()
                     references public.workspaces (id) on delete cascade,
  name               text not null,
  specialty          text,
  phone_country_code text,
  phone_number       text,
  email              text,
  notes              text,
  -- 1 to 5, or null for "not rated yet". Never defaulted to a number:
  -- an unrated supplier is not a one-star supplier.
  rating             integer check (rating is null or rating between 1 and 5),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index suppliers_workspace_idx on public.suppliers (workspace_id, active);

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();


create table public.project_suppliers (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  project_id   uuid not null references public.projects (id)  on delete cascade,
  supplier_id  uuid not null references public.suppliers (id) on delete cascade,
  -- what they did on THIS job, e.g. "joinery, bedroom units"
  role         text,
  created_at   timestamptz not null default now(),

  unique (project_id, supplier_id)
);

create index project_suppliers_project_idx on public.project_suppliers (workspace_id, project_id);


alter table public.suppliers         enable row level security;
alter table public.project_suppliers enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['suppliers', 'project_suppliers']
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
