-- =============================================================
-- Studio OS — Bucket 6: Client Portal (schema)
--
-- A secret per-project link, no password, that shows one client one
-- project and nothing else.
--
-- This is the highest-risk surface in the product, so the rules are
-- enforced here rather than in the page:
--
--   * the token is 32 bytes from a cryptographic source, never a
--     timestamp and never a sequence
--   * only ONE link can be active per project at a time
--   * revoking is instant — every public function re-checks is_active
--     on every call, so there is nothing to invalidate or expire
--   * an approval, once given, cannot be edited by anyone
--
-- The public read path is in 0016. There is no `anon` policy on any
-- table in this file.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Types
-- -------------------------------------------------------------

create type public.approval_decision as enum ('approved', 'changes_requested');


-- -------------------------------------------------------------
-- 2. Tables
-- -------------------------------------------------------------

create table public.portal_links (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  token        text not null unique,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

-- One live link per project. Regenerating revokes the old one first,
-- so two working links for the same project cannot exist.
create unique index portal_links_one_active
  on public.portal_links (project_id) where is_active;

create index portal_links_token_idx on public.portal_links (token) where is_active;


create table public.files (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null default public.current_workspace_id()
                         references public.workspaces (id) on delete cascade,
  project_id             uuid not null references public.projects (id) on delete cascade,
  stage_key              text not null references public.stage_definitions (stage_key),
  file_url               text not null,
  filename               text not null,
  -- Nothing reaches the client unless the designer says so. Default off.
  is_published_to_portal boolean not null default false,
  uploaded_at            timestamptz not null default now()
);

create index files_project_idx on public.files (workspace_id, project_id, stage_key);


create table public.approvals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  stage_key    text not null references public.stage_definitions (stage_key),
  -- null  = the client approved the STAGE, and only this opens a gate
  -- set   = the client approved one file; never opens a gate
  item_ref     uuid references public.files (id) on delete set null,
  decision     public.approval_decision not null,
  comment      text,
  decided_at   timestamptz not null default now()
);

create index approvals_project_idx on public.approvals (workspace_id, project_id, decided_at desc);


create table public.revisions (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null default public.current_workspace_id()
                 references public.workspaces (id) on delete cascade,
  project_id     uuid not null unique references public.projects (id) on delete cascade,
  free_allowance integer not null default 2,
  used           integer not null default 0
);


-- The studio-wide default every new project's allowance starts from.
alter table public.studio_settings
  add column if not exists default_revision_allowance integer not null default 2;


-- -------------------------------------------------------------
-- 3. An approval is permanent
--
-- "An approval is timestamped and locked once given." Enforced by the
-- database, so it holds for the portal, for the app, and for anything
-- written later.
-- -------------------------------------------------------------

create or replace function public.lock_given_approvals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.decision = 'approved' then
    raise exception 'an approval cannot be changed once it is given';
  end if;
  return new;
end;
$$;

create trigger approvals_are_permanent
  before update or delete on public.approvals
  for each row execute function public.lock_given_approvals();


-- -------------------------------------------------------------
-- 4. Tokens
--
-- 32 bytes of cryptographic randomness, hex encoded — 64 characters,
-- 256 bits. pgcrypto lives in the `extensions` schema and these
-- functions run with search_path = '', so it is fully qualified.
-- -------------------------------------------------------------

create or replace function public.issue_portal_link(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws       uuid := public.current_workspace_id();
  new_token text;
begin
  if not exists (
    select 1 from public.projects
    where id = p_project_id and workspace_id = ws
  ) then
    raise exception 'project not found in your workspace';
  end if;

  -- Regenerating revokes whatever was live first, in the same
  -- transaction, so there is never a moment with two working links.
  update public.portal_links
  set is_active = false, revoked_at = now()
  where project_id = p_project_id and workspace_id = ws and is_active;

  new_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.portal_links (workspace_id, project_id, token)
  values (ws, p_project_id, new_token);

  -- Every project with a portal also has a revision budget, seeded
  -- from the studio default at the moment the link is first issued.
  insert into public.revisions (workspace_id, project_id, free_allowance)
  select ws, p_project_id, coalesce(s.default_revision_allowance, 2)
  from public.studio_settings s
  where s.workspace_id = ws
  on conflict (project_id) do nothing;

  return new_token;
end;
$$;


create or replace function public.revoke_portal_link(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare ws uuid := public.current_workspace_id();
begin
  update public.portal_links
  set is_active = false, revoked_at = now()
  where project_id = p_project_id and workspace_id = ws and is_active;

  if not found then
    raise exception 'this project has no active portal link';
  end if;
end;
$$;


-- -------------------------------------------------------------
-- 5. RLS — designer side only. No anon policy anywhere in this file.
-- -------------------------------------------------------------

alter table public.portal_links enable row level security;
alter table public.files        enable row level security;
alter table public.approvals    enable row level security;
alter table public.revisions    enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['portal_links', 'files', 'approvals', 'revisions']
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
-- 6. Project file storage
--
-- Private bucket. The anon read policy that lets a client download a
-- PUBLISHED file lives in 0016, next to the rest of the public path.
-- -------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-files', 'project-files', false, 26214400,
        array['image/jpeg','image/png','image/webp','image/heic','image/svg+xml',
              'application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "project_files_owner_read" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "project_files_owner_write" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "project_files_owner_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );


-- -------------------------------------------------------------
-- 7. Grants — the designer's two functions, nothing to anon
-- -------------------------------------------------------------

revoke execute on function public.issue_portal_link(uuid)  from public, anon;
revoke execute on function public.revoke_portal_link(uuid) from public, anon;
revoke execute on function public.lock_given_approvals()   from public, anon, authenticated;

grant execute on function public.issue_portal_link(uuid)  to authenticated;
grant execute on function public.revoke_portal_link(uuid) to authenticated;
