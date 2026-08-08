-- =============================================================
-- Studio OS — invites, and the admin controls for plans.
--
-- AN INVITE LINK IS A CREDENTIAL, NOT A URL.
--
-- Same treatment as the portal token: 256 bits of cryptographic
-- random, single use, seven days, revocable. Anyone holding it can
-- join the workspace and read whatever is assigned to them, so it is
-- exactly as sensitive as a password and the screen says so next to
-- the copy button rather than in a help article.
--
-- It is a LINK because this product sends nothing on anyone's behalf,
-- and that does not change for invites. The owner copies it and sends
-- it themselves, exactly as they send everything else it writes.
--
-- Seats are checked when the invite is CREATED as well as when it is
-- accepted. Handing out five links on a one-seat plan and letting
-- four of them fail later is not a kindness.
--
-- Accepting is ONE conditional update, so two people opening a
-- forwarded link at the same moment cannot both get in.
-- =============================================================

create table if not exists public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token        text not null unique,
  role         public.user_role not null default 'member',
  label        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null,
  revoked_at   timestamptz
);

alter table public.workspace_invites enable row level security;

drop policy if exists "invites_owner" on public.workspace_invites;
create policy "invites_owner" on public.workspace_invites for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

create or replace function public.create_invite(p_role text default 'member', p_label text default null)
returns public.workspace_invites
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.current_workspace_id();
  made public.workspace_invites%rowtype;
  lim integer; used integer;
begin
  if not public.is_owner() then raise exception 'only the studio owner can invite'; end if;
  if p_role not in ('member', 'viewer') then raise exception 'unknown role'; end if;

  select max_team_seats into lim from public.plans where key = public.effective_plan_key(ws);
  if lim is not null then
    select count(*) into used from public.profiles where workspace_id = ws and active;
    if used >= lim then
      raise exception 'LIMIT_REACHED:seats:%:%', lim, public.effective_plan_key(ws);
    end if;
  end if;

  insert into public.workspace_invites (workspace_id, token, role, label, created_by)
  values (ws, encode(extensions.gen_random_bytes(32), 'hex'), p_role::public.user_role,
          p_label, auth.uid())
  returning * into made;
  return made;
end; $$;

-- Reading without consuming, so the accept screen can name the studio
-- and the role BEFORE anyone commits, and so signing up and coming
-- back to the same link still works.
create or replace function public.peek_invite(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare inv public.workspace_invites%rowtype; ws_name text;
begin
  select * into inv from public.workspace_invites where token = p_token;
  if not found then return jsonb_build_object('valid', false, 'reason', 'unknown'); end if;
  if inv.revoked_at is not null then return jsonb_build_object('valid', false, 'reason', 'revoked'); end if;
  if inv.accepted_at is not null then return jsonb_build_object('valid', false, 'reason', 'used'); end if;
  if inv.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'expired'); end if;
  select name into ws_name from public.workspaces where id = inv.workspace_id;
  return jsonb_build_object('valid', true, 'studio', ws_name, 'role', inv.role,
                            'expires_at', inv.expires_at);
end; $$;

create or replace function public.accept_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  claimed public.workspace_invites%rowtype;
  lim integer; used integer;
begin
  if caller is null then raise exception 'sign in first'; end if;

  -- One conditional update. Two people opening a forwarded link at the
  -- same instant cannot both get in.
  update public.workspace_invites
     set accepted_at = now(), accepted_by = caller
   where token = p_token and revoked_at is null and accepted_at is null and expires_at > now()
  returning * into claimed;

  if not found then raise exception 'this invite link is no longer valid'; end if;

  select max_team_seats into lim from public.plans
   where key = public.effective_plan_key(claimed.workspace_id);
  if lim is not null then
    select count(*) into used from public.profiles
     where workspace_id = claimed.workspace_id and active;
    if used >= lim then
      raise exception 'LIMIT_REACHED:seats:%:%', lim,
        public.effective_plan_key(claimed.workspace_id);
    end if;
  end if;

  update public.profiles
     set workspace_id = claimed.workspace_id, role = claimed.role, active = true
   where id = caller;

  return jsonb_build_object('ok', true, 'workspace_id', claimed.workspace_id, 'role', claimed.role);
end; $$;

/** Put a workspace on any plan, so a tier can be walked deliberately. */
create or replace function public.admin_set_plan(p_workspace uuid, p_plan_key text, p_days integer default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  update public.subscriptions
     set plan_key = p_plan_key,
         status = case when p_plan_key = 'free' then 'active'::public.subscription_status
                       else 'beta'::public.subscription_status end,
         current_period_end = case when p_days is null then null
                                   else now() + make_interval(days => p_days) end,
         cancelled_at = null
   where workspace_id = p_workspace;
end; $$;

create or replace function public.admin_list_workspaces()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id, 'name', w.name, 'created_at', w.created_at,
      'plan_key', s.plan_key, 'effective', public.effective_plan_key(w.id),
      'status', s.status, 'current_period_end', s.current_period_end,
      'days_remaining', case when s.current_period_end is null then null
        else greatest(0, ceil(extract(epoch from (s.current_period_end - now()))/86400)::int) end,
      'members', (select count(*) from public.profiles p where p.workspace_id = w.id),
      'contacts', (select count(*) from public.contacts c where c.workspace_id = w.id and c.deleted_at is null)
    ) order by w.created_at)
    from public.workspaces w join public.subscriptions s on s.workspace_id = w.id
  ), '[]'::jsonb);
end; $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'create_invite(text,text)', 'peek_invite(text)', 'accept_invite(text)',
    'admin_set_plan(uuid,text,integer)', 'admin_list_workspaces()'
  ] loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
