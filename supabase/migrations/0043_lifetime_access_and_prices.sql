-- =============================================================
-- 0043 — Lifetime access for every account that existed at launch,
--        and the real prices.
--
-- Decision (2026-09-03): everyone who signed up during the beta keeps
-- full access permanently — they are the people who will tell us what
-- to change. "Full access" is the Studio plan, which is what the five
-- pre-Aug-8 accounts already had.
--
-- HOW LIFETIME IS REPRESENTED: status = 'beta' with a null
-- current_period_end. effective_plan_key() only demotes a subscription
-- when status = 'cancelled' or the period end is in the past, so a
-- null period end never expires. No new enum value, no new column.
--
-- The 14 accounts this touches are exactly the free/active rows that
-- have no payment provider attached. The count is asserted: a silent
-- 0 or a silent 19 here is a money bug, per the seeder rule.
-- =============================================================

do $$
declare n int;
begin
  update public.subscriptions
     set plan_key = 'studio', status = 'beta', current_period_end = null, updated_at = now()
   where status = 'active' and plan_key = 'free' and provider_subscription_id is null;
  get diagnostics n = row_count;
  if n <> 14 then
    raise exception 'lifetime backfill touched % rows, expected 14', n;
  end if;

  update public.plans set price_monthly = 19, updated_at = now() where key = 'pro';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'pro price: % rows', n; end if;

  update public.plans set price_monthly = 69, updated_at = now() where key = 'studio';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'studio price: % rows', n; end if;
end $$;
