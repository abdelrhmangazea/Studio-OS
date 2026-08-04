-- =============================================================
-- Studio OS — Bucket 1: Foundation (core)
--
-- Creates: workspaces, profiles, studio_settings
--          + workspace isolation (RLS) + signup bootstrap trigger
--
-- The rule this file exists to enforce:
--   every table carries workspace_id, and no query can ever
--   read or write across workspaces.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Enum types
-- -------------------------------------------------------------

create type public.user_role    as enum ('owner', 'member', 'viewer');
create type public.app_language as enum ('ar', 'en');
create type public.app_theme    as enum ('dark', 'light');


-- -------------------------------------------------------------
-- 2. Tables
-- -------------------------------------------------------------

-- One row per subscribing studio.
create table public.workspaces (
  id                  uuid primary key default gen_random_uuid(),
  name                text        not null default 'My Studio',
  onboarding_complete boolean     not null default false,
  created_at          timestamptz not null default now()
);


-- One row per user. Always linked to exactly one workspace.
-- language + theme are this user's own choice, so a member can
-- switch to English on a dark theme without touching anyone else.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid not null       references public.workspaces (id) on delete cascade,
  name         text,
  email        text,
  role         public.user_role    not null default 'owner',
  active       boolean             not null default true,
  language     public.app_language not null default 'ar',
  theme        public.app_theme    not null default 'dark',
  created_at   timestamptz         not null default now()
);

create index profiles_workspace_id_idx on public.profiles (workspace_id);


-- One row per workspace. Branding + workspace-wide defaults.
-- default_language / default_theme are what a NEW member starts
-- with, and what the client-facing pages use in later buckets.
create table public.studio_settings (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid unique not null references public.workspaces (id) on delete cascade,
  studio_name         text,
  logo_url            text,
  accent_color        text                not null default '#0077B6',
  contact_email       text,
  contact_phone       text,
  website             text,
  project_code_prefix text                not null default 'IZ',
  currency            text                not null default 'EGP',
  default_language    public.app_language not null default 'ar',
  default_theme       public.app_theme    not null default 'dark',
  created_at          timestamptz         not null default now(),
  updated_at          timestamptz         not null default now()
);


-- -------------------------------------------------------------
-- 3. Helper functions
--
-- The two policy helpers are SECURITY DEFINER on purpose. They
-- run with the privileges of their owner, so they are NOT subject
-- to RLS themselves.
--
-- This matters: the policies on `profiles` call
-- current_workspace_id(), and that function reads `profiles`.
-- If the function obeyed RLS, that read would trigger the policy
-- again, which would call the function again — infinite
-- recursion, and every query on the table would fail.
-- SECURITY DEFINER is what breaks the loop.
--
-- For the same reason these tables use ENABLE ROW LEVEL SECURITY
-- and NOT `force`. FORCE would apply RLS to the table owner too,
-- which would re-create the recursion described above.
-- -------------------------------------------------------------

-- The workspace of whoever is making the current request.
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.profiles
  where id = auth.uid();
$$;


-- Is the current user an active owner of their workspace?
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'owner'
      and active
  );
$$;


-- Keeps studio_settings.updated_at honest.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger studio_settings_set_updated_at
  before update on public.studio_settings
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------------
-- 4. Row Level Security
--
-- Read this section as the definition of tenant isolation.
-- A table with RLS enabled and no matching policy denies the
-- operation. That is how INSERT and DELETE are locked down here:
-- by writing no policy for them at all.
-- -------------------------------------------------------------

alter table public.workspaces      enable row level security;
alter table public.profiles        enable row level security;
alter table public.studio_settings enable row level security;


-- --- workspaces ---

-- Members can see their own workspace, and nothing else.
create policy "workspaces_select_own"
  on public.workspaces for select
  to authenticated
  using (id = public.current_workspace_id());

-- Only an owner can rename the workspace or mark onboarding done.
create policy "workspaces_update_by_owner"
  on public.workspaces for update
  to authenticated
  using      (id = public.current_workspace_id() and public.is_owner())
  with check (id = public.current_workspace_id() and public.is_owner());

-- No INSERT policy: workspaces are created only by the signup trigger.
-- No DELETE policy: workspaces are never deleted from the app.


-- --- profiles ---

-- Everyone sees their teammates.
create policy "profiles_select_same_workspace"
  on public.profiles for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

-- Anyone can edit their own row. This is how theme + language save,
-- and it works for members and viewers, not just owners.
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using      (id = auth.uid())
  with check (id = auth.uid());

-- Owners can edit anyone in their workspace.
create policy "profiles_update_by_owner"
  on public.profiles for update
  to authenticated
  using      (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

-- No INSERT policy: the signup trigger is the ONLY thing that
-- creates a profile row. No DELETE policy: deactivate, don't delete.


-- --- studio_settings ---

-- Everyone in the workspace can read the branding and defaults.
create policy "studio_settings_select_same_workspace"
  on public.studio_settings for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

-- Only owners can change them.
create policy "studio_settings_update_by_owner"
  on public.studio_settings for update
  to authenticated
  using      (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

-- No INSERT policy: created by the signup trigger. No DELETE policy.


-- -------------------------------------------------------------
-- 5. Signup bootstrap
--
-- A brand new user has no profile, so RLS would block them from
-- creating one. This trigger runs as SECURITY DEFINER immediately
-- after the auth user is inserted, and sets up their whole
-- workspace in a single transaction.
-- -------------------------------------------------------------

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
  -- Already bootstrapped? Do nothing. Guarantees this can never
  -- run twice for the same user and leave duplicate rows behind.
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
