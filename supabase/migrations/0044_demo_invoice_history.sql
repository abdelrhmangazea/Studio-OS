-- =============================================================
-- 0044 — Twelve months of invoices for the demo studio.
--
-- The dashboard now opens on a year of revenue, and the demo seeder
-- wrote three invoices, all inside the last thirty days — so the demo
-- chart was two bars and ten blanks. This adds the money the demo's
-- delivered and in-progress projects would actually have billed, spread
-- across the last eleven months, so a sales demo shows a business with
-- a history rather than one that started last week.
--
-- Same rules as 0042: every write asserts its row count, everything
-- hangs off a demo project (so the is_demo trigger flags it and reset
-- removes it), and the function is idempotent — a second call on a
-- workspace that already has the history is a no-op, so it can also be
-- run against an already-loaded demo without wiping it.
-- =============================================================

create or replace function public.demo_seed_history(p_ws uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  p_concept uuid; p_dd uuid; p_tender uuid; p_construct uuid; p_deliv uuid; p_follow uuid;
  n int;
begin
  select id into p_concept   from public.projects where workspace_id=p_ws and is_demo and current_stage='05_concept' limit 1;
  select id into p_dd        from public.projects where workspace_id=p_ws and is_demo and current_stage='06_design_development' limit 1;
  select id into p_tender    from public.projects where workspace_id=p_ws and is_demo and current_stage='07_tender_ffe' limit 1;
  select id into p_construct from public.projects where workspace_id=p_ws and is_demo and current_stage='08_construction' limit 1;
  select id into p_deliv     from public.projects where workspace_id=p_ws and is_demo and current_stage='09_delivered' limit 1;
  select id into p_follow    from public.projects where workspace_id=p_ws and is_demo and current_stage='10_followup' limit 1;

  if p_concept is null or p_dd is null or p_tender is null or p_construct is null
     or p_deliv is null or p_follow is null then
    raise exception 'demo history: the demo projects are not all present — load the demo first';
  end if;

  -- Already there (a top-up on a loaded demo, or a repeated call). The
  -- base seeder never invoices the follow-up project, so an invoice on
  -- it can only have come from here. (Dates are no marker: a demo
  -- loaded weeks ago already has "old" invoices.)
  if exists (
    select 1 from public.invoices where project_id = p_follow
  ) then
    return;
  end if;

  -- Amounts are a share of each project's value, so the history agrees
  -- with the figures the demo shows elsewhere. Every one of these is
  -- paid: history is money that arrived.
  insert into public.invoices (workspace_id, project_id, contact_id, amount, currency, status, issued_at)
  select p_ws, v.pid, pr.contact_id, round(pr.value * v.share), 'EGP', 'paid', now() - v.ago
  from (values
    -- the year-old follow-up project: three payments, long settled
    (p_follow,    0.40, interval '335 days'),
    (p_follow,    0.30, interval '292 days'),
    (p_follow,    0.30, interval '251 days'),
    -- delivered last week: paid in three over the year
    (p_deliv,     0.40, interval '152 days'),
    (p_deliv,     0.35, interval '93 days'),
    (p_deliv,     0.25, interval '19 days'),
    -- the site under construction: the first two payments
    (p_construct, 0.30, interval '128 days'),
    (p_construct, 0.30, interval '64 days'),
    -- tender, design development, concept: their first payments
    (p_tender,    0.35, interval '108 days'),
    (p_tender,    0.30, interval '46 days'),
    (p_dd,        0.35, interval '71 days'),
    (p_concept,   0.35, interval '40 days')
  ) as v(pid, share, ago)
  join public.projects pr on pr.id = v.pid;

  get diagnostics n = row_count;
  perform public.demo_expect('history invoices', 12, n);
end;
$$;

revoke all on function public.demo_seed_history(uuid) from public, anon, authenticated;


-- The loader, unchanged except for the one extra step.
create or replace function public.load_demo_data()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  ws uuid := public.current_workspace_id();
  real_before int;
  real_after int;
  result jsonb;
begin
  if ws is null then raise exception 'no workspace'; end if;
  if not (public.is_owner() or public.is_platform_admin()) then
    raise exception 'only the studio owner can load demo data';
  end if;

  select count(*)::int into real_before
    from public.contacts where workspace_id = ws and not is_demo;

  perform public.reset_demo_data();

  perform public.demo_seed_people(ws);
  perform public.demo_seed_projects(ws);
  perform public.demo_seed_supporting(ws);
  perform public.demo_seed_history(ws);

  select count(*)::int into real_after
    from public.contacts where workspace_id = ws and not is_demo;

  if real_after <> real_before then
    raise exception 'demo seeder touched real data: % real contacts before, % after',
      real_before, real_after;
  end if;

  select jsonb_build_object(
    'contacts',  (select count(*) from public.contacts  where workspace_id=ws and is_demo),
    'projects',  (select count(*) from public.projects  where workspace_id=ws and is_demo),
    'suppliers', (select count(*) from public.suppliers where workspace_id=ws and is_demo),
    'invoices',  (select count(*) from public.invoices  where workspace_id=ws and is_demo),
    'tasks',     (select count(*) from public.tasks t join public.projects p on p.id=t.project_id
                   where p.is_demo and p.workspace_id=ws),
    'stages_covered', (select count(distinct current_stage) from public.projects
                        where workspace_id=ws and is_demo),
    'real_untouched', real_after
  ) into result;

  return result;
end;
$$;
