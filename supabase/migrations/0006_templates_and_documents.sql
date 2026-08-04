-- =============================================================
-- Studio OS — Bucket 3: Template & Document Engine (schema)
--
-- Templates are paired across languages by `key`: every key has one
-- 'ar' row and one 'en' row. Nothing is ever paired by array order.
--
-- The seeded library lives in workspace-less *_library tables, and is
-- COPIED into each workspace on signup. That is what lets a brand new
-- studio be seeded automatically, and what makes "reset to defaults"
-- a copy rather than a re-parse of a file the server cannot see.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Types
-- -------------------------------------------------------------

create type public.template_type    as enum ('checklist', 'document', 'message', 'questionnaire');
create type public.template_channel as enum ('email', 'whatsapp');


-- -------------------------------------------------------------
-- 2. The master library — system-wide, not per workspace
-- -------------------------------------------------------------

create table public.template_library (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  type       public.template_type    not null,
  channel    public.template_channel,
  stage      text,
  language   public.app_language     not null,
  title      text not null,
  subject    text,
  body       text not null,
  sort_order integer not null default 0,
  unique (key, language)
);

create table public.questionnaire_library (
  id        uuid primary key default gen_random_uuid(),
  key       text  not null unique,
  structure jsonb not null
);


-- -------------------------------------------------------------
-- 3. Per-workspace tables
-- -------------------------------------------------------------

create table public.templates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  key          text not null,
  type         public.template_type    not null,
  channel      public.template_channel,
  stage        text,
  language     public.app_language     not null,
  title        text not null,
  subject      text,
  body         text not null,

  -- true for seeded rows. Still fully editable — is_system only marks
  -- what "reset to defaults" is allowed to replace.
  is_system    boolean not null default false,
  active       boolean not null default true,
  sort_order   integer not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (workspace_id, key, language)
);

create index templates_workspace_type_idx on public.templates (workspace_id, type, sort_order);

create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();


create table public.questionnaire_templates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  key          text  not null,
  structure    jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, key)
);

create trigger questionnaire_templates_set_updated_at
  before update on public.questionnaire_templates
  for each row execute function public.set_updated_at();


-- The record of what was actually generated and sent. Append-only:
-- no UPDATE or DELETE policy, on purpose.
create table public.generated_documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  contact_id   uuid references public.contacts (id) on delete cascade,
  project_id   uuid,                       -- filled in from Bucket 4
  template_key text,
  type         public.template_type,
  language     public.app_language not null,
  title        text not null,
  final_body   text not null,              -- after the designer's edits
  field_values jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references public.profiles (id)
);

create index generated_documents_contact_idx
  on public.generated_documents (workspace_id, contact_id, created_at desc);


-- designer_title resolves from profiles.title, which did not exist.
alter table public.profiles add column title text;


-- -------------------------------------------------------------
-- 4. Row Level Security
-- -------------------------------------------------------------

alter table public.template_library        enable row level security;
alter table public.questionnaire_library   enable row level security;
alter table public.templates               enable row level security;
alter table public.questionnaire_templates enable row level security;
alter table public.generated_documents     enable row level security;

-- The library is readable by any signed-in user and writable by nobody.
-- It holds no customer data — only the shipped template text.
create policy "template_library_read" on public.template_library
  for select to authenticated using (true);

create policy "questionnaire_library_read" on public.questionnaire_library
  for select to authenticated using (true);

-- templates: full control inside your own workspace
create policy "templates_select" on public.templates for select
  to authenticated using (workspace_id = public.current_workspace_id());
create policy "templates_insert" on public.templates for insert
  to authenticated with check (workspace_id = public.current_workspace_id());
create policy "templates_update" on public.templates for update
  to authenticated
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy "templates_delete" on public.templates for delete
  to authenticated using (workspace_id = public.current_workspace_id());

create policy "questionnaire_templates_select" on public.questionnaire_templates for select
  to authenticated using (workspace_id = public.current_workspace_id());
create policy "questionnaire_templates_insert" on public.questionnaire_templates for insert
  to authenticated with check (workspace_id = public.current_workspace_id());
create policy "questionnaire_templates_update" on public.questionnaire_templates for update
  to authenticated
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

-- generated_documents: read and append only. It is the record of what
-- was sent, so it must not be rewritten after the fact.
create policy "generated_documents_select" on public.generated_documents for select
  to authenticated using (workspace_id = public.current_workspace_id());
create policy "generated_documents_insert" on public.generated_documents for insert
  to authenticated with check (workspace_id = public.current_workspace_id());


-- -------------------------------------------------------------
-- 5. Seeding a workspace from the library
-- -------------------------------------------------------------

create or replace function public.seed_workspace_templates(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.templates
    (workspace_id, key, type, channel, stage, language, title, subject, body, is_system, sort_order)
  select target_workspace, l.key, l.type, l.channel, l.stage, l.language,
         l.title, l.subject, l.body, true, l.sort_order
  from public.template_library l
  on conflict (workspace_id, key, language) do nothing;

  insert into public.questionnaire_templates (workspace_id, key, structure)
  select target_workspace, q.key, q.structure
  from public.questionnaire_library q
  on conflict (workspace_id, key) do nothing;
end;
$$;


/**
 * Reset to defaults.
 *
 * Replaces only the rows that came from the library (is_system = true).
 * Templates the designer created themselves are is_system = false and
 * are never touched. Owner only.
 */
create or replace function public.reset_system_templates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ws       uuid := public.current_workspace_id();
  restored integer;
begin
  if ws is null then
    raise exception 'no workspace for the current user';
  end if;
  if not public.is_owner() then
    raise exception 'only the studio owner can reset templates';
  end if;

  delete from public.templates where workspace_id = ws and is_system;
  delete from public.questionnaire_templates where workspace_id = ws;

  perform public.seed_workspace_templates(ws);

  select count(*) into restored
  from public.templates where workspace_id = ws and is_system;

  return restored;
end;
$$;


-- The signup trigger now seeds templates too.
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
  perform public.seed_workspace_templates(new_workspace_id);

  return new;
end;
$$;


-- -------------------------------------------------------------
-- 6. Grants
--
-- seed_workspace_templates is internal. reset_system_templates is
-- called from Settings, so authenticated needs EXECUTE on that one.
-- -------------------------------------------------------------

revoke execute on function public.seed_workspace_templates(uuid) from public, anon, authenticated;
revoke execute on function public.reset_system_templates()       from public, anon;
grant  execute on function public.reset_system_templates()       to authenticated;
