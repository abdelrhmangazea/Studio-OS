-- =============================================================
-- Studio OS — access codes.
--
-- One mechanism for every kind of granted access: a beta cohort, a
-- single prospect's trial, a permanent partner comp. `code_type` is
-- a LABEL, not behaviour — all three expire identically, so there is
-- exactly one code path through this file. Giving them different
-- behaviour would invent a distinction nobody asked for and would be
-- three times the surface to get wrong.
--
-- THE TWO NULLS
--
--   max_uses      = null → unlimited redemptions
--   duration_days = null → never expires
--
-- Both fail OPEN if written carelessly. `uses_count < max_uses` is
-- NULL when max_uses is NULL, which is not true, which means an
-- unlimited code redeems zero times. Every comparison below spells
-- out the null branch for that reason.
-- =============================================================


do $$ begin
  create type public.access_code_type as enum ('beta', 'trial', 'comp');
exception when duplicate_object then null;
end $$;


create table if not exists public.promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  code_type       public.access_code_type not null default 'beta',
  description     text,
  note            text,

  grants_plan_key text not null references public.plans(key),
  duration_days   integer,
  max_uses        integer,
  uses_count      integer not null default 0,

  valid_from      timestamptz not null default now(),
  valid_until     timestamptz,
  active          boolean not null default true,

  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null,
  revoked_at      timestamptz,

  constraint duration_days_positive check (duration_days is null or duration_days > 0),
  constraint max_uses_positive      check (max_uses is null or max_uses > 0)
);

-- Codes are typed by hand off a screen or a WhatsApp message. Case
-- must not decide whether they work.
create unique index if not exists promo_codes_code_unique on public.promo_codes (upper(code));

alter table public.promo_codes enable row level security;

drop policy if exists "promo_codes_admin" on public.promo_codes;
create policy "promo_codes_admin" on public.promo_codes for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
-- Deliberately no read policy for ordinary users. Redemption happens
-- through a SECURITY DEFINER function, so nobody can list the codes
-- to find one, and a wrong guess reveals nothing.


create table if not exists public.promo_redemptions (
  id                uuid primary key default gen_random_uuid(),
  promo_code_id     uuid not null references public.promo_codes(id) on delete cascade,
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  redeemed_at       timestamptz not null default now(),
  redeemed_by       uuid references public.profiles(id) on delete set null,

  -- What it actually did. Recorded even when it did nothing, because
  -- "this code was used and changed nothing" is the answer to a
  -- support question that would otherwise be unanswerable.
  granted_plan_key  text,
  granted_until     timestamptz,
  changed_anything  boolean not null default true,

  unique (promo_code_id, workspace_id)
);

alter table public.promo_redemptions enable row level security;

drop policy if exists "promo_redemptions_read" on public.promo_redemptions;
create policy "promo_redemptions_read" on public.promo_redemptions for select to authenticated
  using (workspace_id = public.current_workspace_id() or public.is_platform_admin());


-- -------------------------------------------------------------
-- Redeeming
--
-- The claim is ONE statement. Two people redeeming the last use at
-- the same instant: the row lock serialises them, the second sees
-- uses_count already at max_uses, and its update matches nothing.
-- No advisory lock, no retry loop, no application-level counter.
-- -------------------------------------------------------------

create or replace function public.redeem_access_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws           uuid := public.current_workspace_id();
  caller       uuid := auth.uid();
  claimed      public.promo_codes%rowtype;
  sub          public.subscriptions%rowtype;
  current_key  text;
  current_rank integer;
  granted_rank integer;
  final_key    text;
  granted_end  timestamptz;
  final_end    timestamptz;
  changed      boolean;
begin
  if ws is null then
    raise exception 'not signed in';
  end if;

  if not public.is_owner() then
    raise exception 'only the studio owner can redeem a code';
  end if;

  -- Claim a use. Every condition that could let a code through when
  -- it should not is in this one WHERE clause.
  update public.promo_codes
     set uses_count = uses_count + 1
   where upper(code) = upper(trim(coalesce(p_code, '')))
     and active
     and revoked_at is null
     and now() >= valid_from
     and (valid_until is null or now() <= valid_until)
     and (max_uses  is null or uses_count < max_uses)
  returning * into claimed;

  if not found then
    -- One message for every failure. Telling somebody "that code is
    -- used up" rather than "no such code" confirms the code exists,
    -- which is how people go looking for more of them.
    raise exception 'that code is not valid';
  end if;

  select * into sub from public.subscriptions where workspace_id = ws;
  current_key := public.effective_plan_key(ws);

  select sort_order into current_rank from public.plans where key = current_key;
  select sort_order into granted_rank from public.plans where key = claimed.grants_plan_key;

  granted_end := case when claimed.duration_days is null
                      then null
                      else now() + make_interval(days => claimed.duration_days) end;

  -- REPLACE-IF-BETTER. Redeeming must never make anybody worse off.
  final_key := case when coalesce(granted_rank, 0) >= coalesce(current_rank, 0)
                    then claimed.grants_plan_key
                    else sub.plan_key end;

  -- The later of the two ends, where null means forever and so wins.
  --
  -- EXCEPT when they are currently on Free: a Free workspace has a
  -- null end because free never expires, not because it has
  -- unlimited paid access. Treating that null as "forever" would
  -- hand out a permanent paid plan to anyone redeeming a 30-day
  -- trial. This branch is the whole reason that bug does not exist.
  if current_key = 'free' then
    final_end := granted_end;
  elsif sub.current_period_end is null or granted_end is null then
    final_end := null;
  else
    final_end := greatest(sub.current_period_end, granted_end);
  end if;

  changed := (final_key      is distinct from sub.plan_key)
          or (final_end      is distinct from sub.current_period_end)
          or (sub.status     is distinct from claimed.code_type::text::public.subscription_status);

  update public.subscriptions
     set plan_key           = final_key,
         status             = case claimed.code_type
                                when 'trial' then 'trial'::public.subscription_status
                                else 'beta'::public.subscription_status
                              end,
         current_period_end = final_end,
         promo_code_id      = claimed.id,
         cancelled_at       = null
   where workspace_id = ws;

  -- Always logged. The unique index makes a second attempt by the
  -- same workspace fail here, which rolls back the uses_count claim
  -- above with it.
  insert into public.promo_redemptions
    (promo_code_id, workspace_id, redeemed_by, granted_plan_key, granted_until, changed_anything)
  values (claimed.id, ws, caller, final_key, final_end, changed);

  return jsonb_build_object(
    'ok', true,
    'plan_key', final_key,
    'until', final_end,
    'changed', changed,
    'code_type', claimed.code_type
  );

exception
  when unique_violation then
    raise exception 'this code has already been used by your studio';
end;
$$;

revoke execute on function public.redeem_access_code(text) from public;
revoke execute on function public.redeem_access_code(text) from anon;
grant  execute on function public.redeem_access_code(text) to authenticated;


-- -------------------------------------------------------------
-- Admin: issuing, revoking, extending
-- -------------------------------------------------------------

create or replace function public.admin_create_code(
  p_code       text,
  p_plan_key   text,
  p_type       text default 'beta',
  p_days       integer default null,
  p_max_uses   integer default null,
  p_note       text default null,
  p_valid_until timestamptz default null
)
returns public.promo_codes
language plpgsql
security definer
set search_path = ''
as $$
declare created public.promo_codes%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;

  insert into public.promo_codes
    (code, code_type, grants_plan_key, duration_days, max_uses, note, valid_until, created_by)
  values
    (upper(trim(p_code)), p_type::public.access_code_type, p_plan_key,
     p_days, p_max_uses, p_note, p_valid_until, auth.uid())
  returning * into created;

  return created;
end;
$$;


/** Revoke stops FUTURE redemptions. Everyone already on it keeps it. */
create or replace function public.admin_revoke_code(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  update public.promo_codes set active = false, revoked_at = now() where id = p_id;
end;
$$;


/** Changes what FUTURE redemptions get. Touches nobody already on it. */
create or replace function public.admin_set_code_duration(p_id uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  update public.promo_codes set duration_days = p_days where id = p_id;
end;
$$;


/**
 * Who an extension would hit, before it hits them. The admin screen
 * shows this and requires a confirmation naming the count.
 */
create or replace function public.admin_extension_preview(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'workspace_id', w.id,
      'workspace', w.name,
      'current_end', s.current_period_end,
      'days_remaining', case when s.current_period_end is null then null
             else greatest(0, ceil(extract(epoch from (s.current_period_end - now())) / 86400)::int) end,
      'already_expired', s.current_period_end is not null and s.current_period_end < now()
    ) order by w.name)
    from public.promo_redemptions r
    join public.workspaces w on w.id = r.workspace_id
    join public.subscriptions s on s.workspace_id = w.id
    where r.promo_code_id = p_id
  ), '[]'::jsonb);
end;
$$;


/**
 * Extend the workspaces already on a code.
 *
 * From whichever is later — their current end, or now. Extending an
 * expired workspace by 30 days should give it 30 days from today,
 * not 30 days from a date in the past that leaves it still expired.
 */
create or replace function public.admin_extend_workspaces(p_id uuid, p_extra_days integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare touched integer;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;

  with affected as (
    update public.subscriptions s
       set current_period_end =
             greatest(coalesce(s.current_period_end, now()), now())
             + make_interval(days => p_extra_days)
      from public.promo_redemptions r
     where r.promo_code_id = p_id
       and r.workspace_id = s.workspace_id
       and s.current_period_end is not null   -- never turn a permanent grant into a dated one
    returning 1
  )
  select count(*) into touched from affected;

  return touched;
end;
$$;


/** Aimed, not broadcast. Ends ONE workspace's access. Deletes nothing. */
create or replace function public.admin_end_access(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;

  -- The row stays, the plan stays, every record stays readable and
  -- exportable. Only the period ends, which reads as Free.
  update public.subscriptions
     set current_period_end = now()
   where workspace_id = p_workspace;
end;
$$;


/** Every code with its redemptions, for the admin screen. */
create or replace function public.admin_list_codes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.code, 'code_type', c.code_type,
      'grants_plan_key', c.grants_plan_key, 'duration_days', c.duration_days,
      'max_uses', c.max_uses, 'uses_count', c.uses_count,
      'unlimited_uses', c.max_uses is null,
      'never_expires', c.duration_days is null,
      'active', c.active, 'revoked_at', c.revoked_at,
      'note', c.note, 'created_at', c.created_at,
      'redemptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'workspace', w.name,
          'workspace_id', w.id,
          'redeemed_at', r.redeemed_at,
          'changed_anything', r.changed_anything,
          'days_remaining', case when s.current_period_end is null then null
                 else greatest(0, ceil(extract(epoch from (s.current_period_end - now())) / 86400)::int) end,
          'expired', s.current_period_end is not null and s.current_period_end < now()
        ) order by r.redeemed_at desc)
        from public.promo_redemptions r
        join public.workspaces w on w.id = r.workspace_id
        join public.subscriptions s on s.workspace_id = w.id
        where r.promo_code_id = c.id
      ), '[]'::jsonb)
    ) order by c.created_at desc)
    from public.promo_codes c
  ), '[]'::jsonb);
end;
$$;


do $$
declare fn text;
begin
  foreach fn in array array[
    'admin_create_code(text,text,text,integer,integer,text,timestamptz)',
    'admin_revoke_code(uuid)',
    'admin_set_code_duration(uuid,integer)',
    'admin_extension_preview(uuid)',
    'admin_extend_workspaces(uuid,integer)',
    'admin_end_access(uuid)',
    'admin_list_codes()'
  ] loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
