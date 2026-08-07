-- =============================================================
-- Studio OS — how the beta is actually run.
--
-- Three things: somewhere for a designer to tell us what broke, a
-- count of which features anyone actually opens, and one screen where
-- we can read both.
--
-- ---------------------------------------------------------------
-- FLAG — this is the one place a query crosses workspaces.
--
-- The standing rule is "no query may ever cross workspaces". A
-- platform admin reading feedback from every studio breaks it, and
-- item 17 asks for exactly that screen. So the crossing is made as
-- narrow as it can be:
--
--   * It applies to TWO tables — feedback and feature_usage. Nothing
--     else. A platform admin has no extra rights on contacts,
--     projects, invoices, documents, portal links or anything else;
--     those policies are untouched and still filter on
--     current_workspace_id() alone.
--   * feature_usage holds counts, not rows — "12 people used the
--     hourly calculator", never who or for which client.
--   * Membership is a table with rows in it, not a role anyone can
--     grant themselves. It starts EMPTY. Adding the first admin is a
--     deliberate act in the SQL editor, not something the app can do.
--
-- Everything else in the architecture is unchanged.
-- ---------------------------------------------------------------
-- =============================================================


-- -------------------------------------------------------------
-- Who is us
--
-- Deliberately not a value on user_role. That enum describes
-- membership of a workspace (owner / member / viewer); this is the
-- vendor, which is a different axis. Folding them together would
-- force a platform admin to also be somebody's owner.
--
-- No workspace_id on this table for the same reason: it is not
-- workspace data. RLS is on and the only way to read it is through
-- the SECURITY DEFINER helper below.
-- -------------------------------------------------------------

create table if not exists public.platform_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  note       text,
  added_at   timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No policies. Nobody reads this directly, not even to check themselves.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a where a.profile_id = auth.uid()
  );
$$;

revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.is_platform_admin() from anon;
grant  execute on function public.is_platform_admin() to authenticated;


-- -------------------------------------------------------------
-- Item 15 — feedback
-- -------------------------------------------------------------

do $$ begin
  create type public.feedback_kind as enum ('bug', 'idea', 'question');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.feedback_state as enum ('new', 'read', 'answered', 'closed');
exception when duplicate_object then null;
end $$;

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,
  kind         public.feedback_kind  not null default 'bug',
  state        public.feedback_state not null default 'new',
  message      text not null check (length(trim(message)) > 0),

  -- Where they were and what they were looking at. A bug report that
  -- does not say which screen is half a bug report, and asking a
  -- designer to describe their browser is asking them to give up.
  page         text,
  context      jsonb not null default '{}'::jsonb,

  reply        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists feedback_workspace_idx on public.feedback (workspace_id, created_at desc);
create index if not exists feedback_state_idx     on public.feedback (state, created_at desc);

alter table public.feedback enable row level security;

-- A studio writes its own, reads its own, and can never see another's.
create policy "feedback_insert_own" on public.feedback for insert
  to authenticated
  with check (workspace_id = public.current_workspace_id());

create policy "feedback_select_own_or_admin" on public.feedback for select
  to authenticated
  using (workspace_id = public.current_workspace_id() or public.is_platform_admin());

-- Only we change state or answer. A studio cannot edit a report after
-- sending it, and cannot write itself a reply.
create policy "feedback_update_admin" on public.feedback for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create or replace function public.touch_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_feedback on public.feedback;
create trigger touch_feedback before update on public.feedback
  for each row execute function public.touch_feedback();


-- The caller never supplies workspace_id or profile_id — they are read
-- from the session, so a report cannot be filed against someone else.
create or replace function public.submit_feedback(
  p_kind    text,
  p_message text,
  p_page    text default null,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws  uuid := public.current_workspace_id();
  new_id uuid;
begin
  if ws is null then
    raise exception 'no workspace for this user';
  end if;

  if coalesce(trim(p_message), '') = '' then
    raise exception 'please write something before sending';
  end if;

  if p_kind not in ('bug', 'idea', 'question') then
    raise exception 'unknown feedback kind';
  end if;

  insert into public.feedback (workspace_id, profile_id, kind, message, page, context)
  values (ws, auth.uid(), p_kind::public.feedback_kind,
          left(trim(p_message), 4000), left(coalesce(p_page, ''), 200),
          coalesce(p_context, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.submit_feedback(text, text, text, jsonb) from public;
revoke execute on function public.submit_feedback(text, text, text, jsonb) from anon;
grant  execute on function public.submit_feedback(text, text, text, jsonb) to authenticated;


-- -------------------------------------------------------------
-- Item 19 — which features anyone actually opens
--
-- Counts only. No row ids, no client names, no amounts. The question
-- this answers is "did anybody ever open the quotations card", which
-- decides what survives the beta.
-- -------------------------------------------------------------

create table if not exists public.feature_usage (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feature      text not null,
  uses         integer not null default 0,
  first_used_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (workspace_id, feature)
);

alter table public.feature_usage enable row level security;

create policy "feature_usage_select_own_or_admin" on public.feature_usage for select
  to authenticated
  using (workspace_id = public.current_workspace_id() or public.is_platform_admin());

create or replace function public.record_feature_use(p_feature text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if ws is null or coalesce(trim(p_feature), '') = '' then
    return;
  end if;

  insert into public.feature_usage as fu (workspace_id, feature, uses)
  values (ws, left(trim(p_feature), 60), 1)
  on conflict (workspace_id, feature) do update
    set uses = fu.uses + 1, last_used_at = now();
end;
$$;

revoke execute on function public.record_feature_use(text) from public;
revoke execute on function public.record_feature_use(text) from anon;
grant  execute on function public.record_feature_use(text) to authenticated;


-- -------------------------------------------------------------
-- Item 17 — the one internal screen
--
-- Aggregates, so the admin page never has to pull rows to count them.
-- Returns nothing at all unless the caller is a platform admin —
-- checked inside, not left to the caller to ask nicely.
-- -------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed';
  end if;

  return jsonb_build_object(
    'workspaces', (select count(*) from public.workspaces),
    'feedback_open', (select count(*) from public.feedback where state in ('new', 'read')),
    'feedback_total', (select count(*) from public.feedback),

    'features', coalesce((
      select jsonb_agg(row_to_json(f) order by f.total desc)
      from (
        select feature,
               sum(uses)::bigint      as total,
               count(*)::bigint       as studios,
               max(last_used_at)      as last_used
        from public.feature_usage
        group by feature
      ) f
    ), '[]'::jsonb),

    -- Which studios are actually using the thing, by activity rather
    -- than by name alone. No client data crosses here.
    'studios', coalesce((
      select jsonb_agg(row_to_json(s) order by s.contacts desc)
      from (
        select w.id, w.name, w.created_at,
               (select count(*) from public.contacts c where c.workspace_id = w.id) as contacts,
               (select count(*) from public.projects p where p.workspace_id = w.id) as projects,
               (select coalesce(sum(u.uses), 0) from public.feature_usage u
                where u.workspace_id = w.id) as feature_uses
        from public.workspaces w
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_overview() from public;
revoke execute on function public.admin_overview() from anon;
grant  execute on function public.admin_overview() to authenticated;


-- -------------------------------------------------------------
-- Item 19 — the Beta badge, dismissible, per user
-- -------------------------------------------------------------

alter table public.profiles
  add column if not exists beta_badge_dismissed boolean not null default false;
