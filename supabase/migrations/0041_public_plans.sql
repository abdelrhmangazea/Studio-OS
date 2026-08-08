-- The marketing site is public and has a pricing section. The plans
-- table is readable only by `authenticated`, so a visitor saw an
-- empty grid where the prices should be. Found by loading the
-- deployed page logged out, not by reading the policy.
--
-- Fixed the way every other public surface in this product works: a
-- SECURITY DEFINER function, NOT an anon policy on the table. That
-- keeps "zero anon policies on any table" true, and the public sees
-- exactly the columns listed here rather than whatever the table
-- grows later. Note what is NOT returned: provider_price_monthly and
-- provider_price_yearly are processor identifiers and no visitor
-- needs them.
create or replace function public.public_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', p.key, 'name_ar', p.name_ar, 'name_en', p.name_en,
    'price_monthly', p.price_monthly, 'currency', p.currency, 'is_live', p.is_live,
    'max_team_seats', p.max_team_seats, 'max_active_projects', p.max_active_projects,
    'max_contacts', p.max_contacts, 'max_usable_templates', p.max_usable_templates,
    'client_portal_enabled', p.client_portal_enabled,
    'document_generator_enabled', p.document_generator_enabled,
    'reports_enabled', p.reports_enabled, 'fee_calculator_enabled', p.fee_calculator_enabled
  ) order by p.sort_order), '[]'::jsonb)
  from public.plans p where p.active;
$$;

revoke execute on function public.public_plans() from public;
grant  execute on function public.public_plans() to anon, authenticated;
