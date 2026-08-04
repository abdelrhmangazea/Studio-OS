-- =============================================================
-- Studio OS — Bucket 2: Leads & Clients
--
-- Leads and clients are ONE table with TWO views. A record starts
-- as a lead (is_client = false). Booking a consultation converts it
-- to a client, keeping every field. Nothing is re-entered and
-- nothing is duplicated.
-- =============================================================


-- -------------------------------------------------------------
-- 1. The editable lists
--
-- Every workspace gets its own copy of these, seeded at signup,
-- so a studio can rename "Follow-up 1" to whatever it actually
-- calls that stage without affecting anyone else.
-- -------------------------------------------------------------

create table public.lead_statuses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  label_en     text        not null,
  label_ar     text        not null,
  color        text        not null default '#b7b7b7',
  sort_order   integer     not null default 0,
  is_won       boolean     not null default false,
  is_lost      boolean     not null default false,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

create table public.lead_sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  label_en     text        not null,
  label_ar     text        not null,
  sort_order   integer     not null default 0,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

create index lead_statuses_workspace_idx on public.lead_statuses (workspace_id, sort_order);
create index lead_sources_workspace_idx  on public.lead_sources  (workspace_id, sort_order);


-- -------------------------------------------------------------
-- 2. Contacts — leads and clients in one table
--
-- Note the foreign keys to lead_statuses and lead_sources have no
-- ON DELETE clause, which means Postgres REFUSES to delete a status
-- that any contact still points at. That is what enforces "statuses
-- in use cannot be deleted, only deactivated" — in the database,
-- where no future screen can bypass it.
-- -------------------------------------------------------------

create table public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null default public.current_workspace_id()
                     references public.workspaces (id) on delete cascade,

  first_name         text not null,
  last_name          text,
  email              text,

  -- Stored apart so the code is always known and never guessed.
  phone_country_code text,
  phone_number       text,

  -- ISO 3166-1 alpha-2, e.g. 'EG'. The UI renders the name in the
  -- reader's own language, so one record reads correctly in both.
  country            text,
  nationality        text,

  address            text,
  birthday           date,

  source_id          uuid references public.lead_sources (id),
  status_id          uuid references public.lead_statuses (id),

  is_client          boolean not null default false,
  converted_at       timestamptz,

  last_contact_at    timestamptz,
  next_action_at     date,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The leads table and the kanban both filter on these constantly.
create index contacts_workspace_client_idx on public.contacts (workspace_id, is_client);
create index contacts_status_idx           on public.contacts (status_id);
create index contacts_source_idx           on public.contacts (source_id);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------------
-- 3. Notes — the communication log
-- -------------------------------------------------------------

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  contact_id   uuid not null references public.contacts (id) on delete cascade,
  body         text not null,
  created_by   uuid default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now()
);

create index notes_contact_idx on public.notes (contact_id, created_at desc);


-- Adding a note is a touchpoint, so it updates last_contact_at.
-- This lives in the database rather than in JavaScript so it holds
-- for the CSV importer and for every later bucket too.
create or replace function public.bump_last_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.contacts
  set last_contact_at = greatest(coalesce(last_contact_at, new.created_at), new.created_at)
  where id = new.contact_id;
  return new;
end;
$$;

create trigger notes_bump_last_contact
  after insert on public.notes
  for each row execute function public.bump_last_contact();


-- -------------------------------------------------------------
-- 4. Row Level Security
--
-- Same rule as Bucket 1: every policy filters on the caller's
-- workspace, and an operation with no policy is denied.
-- -------------------------------------------------------------

alter table public.lead_statuses enable row level security;
alter table public.lead_sources  enable row level security;
alter table public.contacts      enable row level security;
alter table public.notes         enable row level security;


-- --- lead_statuses: everyone reads, owners edit ---

create policy "lead_statuses_select" on public.lead_statuses for select
  to authenticated using (workspace_id = public.current_workspace_id());

create policy "lead_statuses_insert" on public.lead_statuses for insert
  to authenticated
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

create policy "lead_statuses_update" on public.lead_statuses for update
  to authenticated
  using      (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

create policy "lead_statuses_delete" on public.lead_statuses for delete
  to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_owner());


-- --- lead_sources: same ---

create policy "lead_sources_select" on public.lead_sources for select
  to authenticated using (workspace_id = public.current_workspace_id());

create policy "lead_sources_insert" on public.lead_sources for insert
  to authenticated
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

create policy "lead_sources_update" on public.lead_sources for update
  to authenticated
  using      (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

create policy "lead_sources_delete" on public.lead_sources for delete
  to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_owner());


-- --- contacts: any member can read, add and edit. Nobody deletes ---

create policy "contacts_select" on public.contacts for select
  to authenticated using (workspace_id = public.current_workspace_id());

create policy "contacts_insert" on public.contacts for insert
  to authenticated with check (workspace_id = public.current_workspace_id());

create policy "contacts_update" on public.contacts for update
  to authenticated
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

-- No DELETE policy, on purpose. A lead that goes nowhere is moved to
-- a lost status and stays searchable forever. It is never removed.


-- --- notes: read, add and delete within the workspace ---

create policy "notes_select" on public.notes for select
  to authenticated using (workspace_id = public.current_workspace_id());

create policy "notes_insert" on public.notes for insert
  to authenticated with check (workspace_id = public.current_workspace_id());

create policy "notes_delete" on public.notes for delete
  to authenticated using (workspace_id = public.current_workspace_id());


-- -------------------------------------------------------------
-- 5. Seeding a new workspace
--
-- One function, called both by the signup trigger and by the
-- backfill at the bottom of this file.
-- -------------------------------------------------------------

create or replace function public.seed_workspace_lists(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Already seeded? Leave it alone.
  if exists (select 1 from public.lead_statuses where workspace_id = target_workspace) then
    return;
  end if;

  insert into public.lead_statuses
    (workspace_id, label_en, label_ar, color, sort_order, is_won, is_lost)
  values
    (target_workspace, 'New',            'جديد',        '#b7b7b7', 1, false, false),
    (target_workspace, 'Contacted',      'تم التواصل',   '#0077B6', 2, false, false),
    (target_workspace, 'Follow-up 1',    'متابعة ١',    '#0077B6', 3, false, false),
    (target_workspace, 'Follow-up 2',    'متابعة ٢',    '#f2d709', 4, false, false),
    (target_workspace, 'Follow-up 3',    'متابعة ٣',    '#f2d709', 5, false, false),
    (target_workspace, 'Booked',         'تم الحجز',     '#22C55E', 6, true,  false),
    (target_workspace, 'Rejected',       'مرفوض',       '#e11d3c', 7, false, true),
    (target_workspace, 'Not interested', 'غير مهتم',     '#b7b7b7', 8, false, true);

  insert into public.lead_sources (workspace_id, label_en, label_ar, sort_order)
  values
    (target_workspace, 'Instagram', 'إنستغرام',        1),
    (target_workspace, 'WhatsApp',  'واتساب',          2),
    (target_workspace, 'Website',   'الموقع الإلكتروني', 3),
    (target_workspace, 'Referral',  'ترشيح',           4),
    (target_workspace, 'Walk-in',   'زيارة مباشرة',     5),
    (target_workspace, 'Other',     'أخرى',            6);
end;
$$;


-- The signup trigger now seeds the lists as well.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  signup_studio    text := nullif(trim(new.raw_user_meta_data ->> 'studio_name'), '');
  signup_name      text := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  insert into public.workspaces (name)
  values (coalesce(signup_studio, 'My Studio'))
  returning id into new_workspace_id;

  insert into public.profiles (id, workspace_id, name, email, role)
  values (new.id, new_workspace_id, signup_name, new.email, 'owner')
  on conflict (id) do nothing;

  insert into public.studio_settings (workspace_id, studio_name)
  values (new_workspace_id, signup_studio)
  on conflict (workspace_id) do nothing;

  perform public.seed_workspace_lists(new_workspace_id);

  return new;
end;
$$;


-- -------------------------------------------------------------
-- 6. Grants
--
-- Same reasoning as migration 0003: these are trigger and helper
-- functions, not REST endpoints.
-- -------------------------------------------------------------

revoke execute on function public.bump_last_contact()          from public, anon, authenticated;
revoke execute on function public.seed_workspace_lists(uuid)   from public, anon, authenticated;


-- -------------------------------------------------------------
-- 7. Backfill workspaces that already exist
-- -------------------------------------------------------------

do $$
declare
  existing uuid;
begin
  for existing in select id from public.workspaces loop
    perform public.seed_workspace_lists(existing);
  end loop;
end;
$$;
