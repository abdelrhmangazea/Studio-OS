-- =============================================================
-- Studio OS — plans, and what each workspace is entitled to.
--
-- This is the vendor's billing, not the studio's. Designers subscribe
-- to the application and pay us. How a designer gets paid by THEIR
-- client is unchanged and stays unchanged: a manual invoice and an
-- uploaded receipt, with no gateway anywhere near it.
--
-- TWO IDEAS CARRY THE WHOLE BUCKET
--
-- 1. THE EFFECTIVE PLAN IS READ, NEVER WRITTEN.
--    Expiry is not a nightly job that rewrites rows — it is a
--    comparison against now(). A workspace whose period ended IS on
--    Free from that instant, with nothing having run. There is no
--    3am job to fail silently, no window where a lapsed workspace is
--    still charged features, and no way for the two to disagree.
--
-- 2. NOTHING IS EVER TAKEN AWAY, ONLY WITHHELD.
--    Dropping to Free never deletes, never hides, never locks. Every
--    row stays readable and exportable however far above the Free
--    limits it is. Only INSERTing something NEW beyond the limit is
--    refused. Losing access must not mean losing work.
-- =============================================================


-- -------------------------------------------------------------
-- Plans
--
-- Prices are placeholders and are meant to be. They are set from the
-- admin screen before going live, and no price is hardcoded anywhere
-- in the app — every screen reads this table.
--
-- Columns are `provider_*` rather than `stripe_*` on purpose. Nothing
-- outside the billing adapter is allowed to know which processor is
-- in use, and a column named after one would break that on day one.
-- -------------------------------------------------------------

create table if not exists public.plans (
  key                        text primary key,
  name_ar                    text not null,
  name_en                    text not null,

  -- Monthly is the only stored price. Yearly is COMPUTED as ten
  -- months (two free) wherever it is shown, so the two can never
  -- drift into disagreeing with each other.
  price_monthly              numeric(10,2) not null default 0,
  currency                   text not null default 'USD',

  provider_price_monthly     text,
  provider_price_yearly      text,

  -- null everywhere means "no limit". Not zero — zero is a real
  -- number and would mean "none allowed".
  max_team_seats             integer,
  max_active_projects        integer,
  max_contacts               integer,

  -- For display: "2 of 24 templates on your plan".
  max_usable_templates       integer,
  -- The actual gate. null = every template.
  usable_template_keys       text[],

  client_portal_enabled      boolean not null default true,
  document_generator_enabled boolean not null default true,
  reports_enabled            boolean not null default true,
  fee_calculator_enabled     boolean not null default true,

  sort_order                 integer not null default 0,
  active                     boolean not null default true,

  -- Set once the admin screen has confirmed the price on this row
  -- matches the amount the processor will actually charge. Until
  -- then the plan cannot be offered at checkout.
  is_live                    boolean not null default false,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

alter table public.plans enable row level security;

-- Everyone signed in may read the plans — they are a price list, and
-- the upgrade prompts need them. Nobody may write except us.
drop policy if exists "plans_read" on public.plans;
create policy "plans_read" on public.plans for select to authenticated using (true);

drop policy if exists "plans_write_admin" on public.plans;
create policy "plans_write_admin" on public.plans for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());


insert into public.plans (
  key, name_ar, name_en, price_monthly, sort_order,
  max_team_seats, max_active_projects, max_contacts,
  max_usable_templates, usable_template_keys,
  client_portal_enabled, document_generator_enabled,
  reports_enabled, fee_calculator_enabled
) values
  ('free', 'مجاني', 'Free', 0, 1,
   1, 1, 15,
   2, array['consultation_confirmation', 'fee_proposal'],
   false, false, false, false),

  ('pro', 'برو', 'Pro', 0, 2,
   1, null, null,
   null, null,
   true, true, true, true),

  ('studio', 'استوديو', 'Studio', 0, 3,
   5, null, null,
   null, null,
   true, true, true, true)
on conflict (key) do nothing;


-- -------------------------------------------------------------
-- Subscriptions — one row per workspace, always
-- -------------------------------------------------------------

do $$ begin
  create type public.subscription_status as enum
    ('trial', 'active', 'past_due', 'cancelled', 'beta');
exception when duplicate_object then null;
end $$;

create table if not exists public.subscriptions (
  workspace_id             uuid primary key references public.workspaces(id) on delete cascade,
  plan_key                 text not null references public.plans(key),
  status                   public.subscription_status not null default 'beta',

  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,

  started_at               timestamptz not null default now(),
  -- null means it does not expire. Used by permanent comp codes and
  -- by the existing beta workspaces.
  current_period_end       timestamptz,
  cancelled_at             timestamptz,

  promo_code_id            uuid,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_provider_sub_idx
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

alter table public.subscriptions enable row level security;

-- A studio reads its own. Nobody writes from the browser — the plan
-- changes only from a verified webhook or an admin action, both of
-- which run as the owner and bypass this.
drop policy if exists "subscriptions_read_own" on public.subscriptions;
create policy "subscriptions_read_own" on public.subscriptions for select to authenticated
  using (workspace_id = public.current_workspace_id() or public.is_platform_admin());

drop policy if exists "subscriptions_write_admin" on public.subscriptions;
create policy "subscriptions_write_admin" on public.subscriptions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());


-- Every workspace that exists today is a beta workspace of ours.
-- Studio, no expiry, so nothing anybody is currently using breaks.
insert into public.subscriptions (workspace_id, plan_key, status, current_period_end)
select w.id, 'studio', 'beta', null
from public.workspaces w
on conflict (workspace_id) do nothing;

-- And every workspace created from now on. Free by default: a new
-- signup with no code gets the free tier, which is the point of
-- having one.
create or replace function public.subscribe_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (workspace_id, plan_key, status)
  values (new.id, 'free', 'active')
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists subscribe_new_workspace on public.workspaces;
create trigger subscribe_new_workspace after insert on public.workspaces
  for each row execute function public.subscribe_new_workspace();


-- -------------------------------------------------------------
-- The effective plan
--
-- Every limit and every feature gate in this bucket goes through
-- here. It is the single answer to "what is this workspace allowed
-- to do right now".
--
-- past_due keeps working until the period actually ends. A card that
-- failed this morning should not lock somebody out of a client
-- meeting this afternoon; the processor retries for days, and the
-- period end is the honest deadline.
-- -------------------------------------------------------------

create or replace function public.effective_plan_key(p_workspace uuid default null)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.status = 'cancelled' then 'free'
    when s.current_period_end is not null and s.current_period_end < now() then 'free'
    else s.plan_key
  end
  from public.subscriptions s
  where s.workspace_id = coalesce(p_workspace, public.current_workspace_id());
$$;

revoke execute on function public.effective_plan_key(uuid) from public;
revoke execute on function public.effective_plan_key(uuid) from anon;
grant  execute on function public.effective_plan_key(uuid) to authenticated;


/** The whole plan row, resolved. Used by the triggers and the UI. */
create or replace function public.current_plan()
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.plans p
  where p.key = coalesce(public.effective_plan_key(), 'free');
$$;

revoke execute on function public.current_plan() from public;
revoke execute on function public.current_plan() from anon;
grant  execute on function public.current_plan() to authenticated;


/**
 * What the subscription screen shows. One call, everything it needs,
 * including how long is left and whether to warn.
 */
create or replace function public.my_subscription()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ws   uuid := public.current_workspace_id();
  sub  public.subscriptions%rowtype;
  eff  text;
  plan public.plans%rowtype;
  days integer;
begin
  if ws is null then return null; end if;

  select * into sub from public.subscriptions where workspace_id = ws;
  if not found then return null; end if;

  eff := public.effective_plan_key(ws);
  select * into plan from public.plans where key = eff;

  days := case
    when sub.current_period_end is null then null
    else greatest(0, ceil(extract(epoch from (sub.current_period_end - now())) / 86400)::int)
  end;

  return jsonb_build_object(
    'status', sub.status,
    'plan_key', sub.plan_key,
    'effective_plan_key', eff,
    -- True when the paid plan has lapsed and they are reading Free.
    -- The screen says so plainly rather than just showing "Free".
    'expired', eff is distinct from sub.plan_key,
    'current_period_end', sub.current_period_end,
    'days_remaining', days,
    -- 14 and 3, as specced. null when nothing expires.
    'warn', case when days is null then null
                 when days <= 3 then 3
                 when days <= 14 then 14
                 else null end,
    'cancelled_at', sub.cancelled_at,
    'has_provider', sub.provider_subscription_id is not null,
    'plan', to_jsonb(plan)
  );
end;
$$;

revoke execute on function public.my_subscription() from public;
revoke execute on function public.my_subscription() from anon;
grant  execute on function public.my_subscription() to authenticated;


-- -------------------------------------------------------------
-- Webhook idempotency
--
-- Stripe retries. It is not an edge case, it is the documented
-- behaviour, and it will happen the first week. The unique key is
-- what makes a second delivery a no-op instead of a second month.
-- -------------------------------------------------------------

create table if not exists public.billing_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,
  event_id    text not null,
  type        text not null,
  payload     jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.billing_events enable row level security;
-- No policies. Only the webhook function writes here, as service role.


create or replace function public.touch_subscription()
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

drop trigger if exists touch_subscription on public.subscriptions;
create trigger touch_subscription before update on public.subscriptions
  for each row execute function public.touch_subscription();

revoke execute on function public.touch_subscription() from public;
revoke execute on function public.touch_subscription() from anon, authenticated;
revoke execute on function public.subscribe_new_workspace() from public;
revoke execute on function public.subscribe_new_workspace() from anon, authenticated;
