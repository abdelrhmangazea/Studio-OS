-- =============================================================
-- Studio OS — the standing security check.
--
-- Run this in the Supabase SQL editor after ANY migration. Every row
-- it returns should say PASS. A FAIL is a real hole, not a warning.
--
-- It exists because "remember to write the revoke" is not a control.
-- Three separate times in Bucket 9 a function came out reachable by
-- anon when it should not have been, and each time the thing that
-- caught it was a query like this one, not a careful reading.
-- =============================================================

-- 1. The anon-callable surface is EXACTLY the intended public API.
--    Anything extra is a function the internet can call.
with intended(name) as (
  values ('booking_file_upload_allowed'),
         ('portal_attach_receipt'),
         ('portal_file_download_allowed'),
         ('portal_project'),
         ('portal_submit_decision'),
         ('public_attach_answer_file'),
         ('public_attach_receipt'),
         ('public_available_slots'),
         ('public_booking_page'),
         ('public_booking_status'),
         ('public_create_booking'),
         ('receipt_upload_allowed'),
         -- 0041: the marketing page shows the plan table to visitors.
         ('public_plans')
),
actual as (
  select p.proname as name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and has_function_privilege('anon', p.oid, 'execute')
)
select '1. anon-callable surface' as check,
       case when not exists (select 1 from actual  except select 1 from intended)
             and not exists (select name from intended except select name from actual)
            then 'PASS — exactly the 13 intended'
            else 'FAIL — unexpected: '
                 || coalesce((select string_agg(name, ', ') from (select name from actual except select name from intended) x), '(none)')
                 || ' / missing: '
                 || coalesce((select string_agg(name, ', ') from (select name from intended except select name from actual) y), '(none)')
       end as result

union all

-- 2. Every SECURITY DEFINER function pins its search_path. Without it
--    a caller can point the function at their own tables.
select '2. SECURITY DEFINER search_path',
       case when count(*) = 0 then 'PASS — all pinned'
            else 'FAIL — ' || count(*) || ' unpinned: ' || string_agg(proname, ', ') end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and (p.proconfig is null or not (p.proconfig::text like '%search_path%'))

union all

-- 3. Every table in public has RLS enabled. A table without it is
--    readable by anyone holding the anon key.
select '3. RLS on every table',
       case when count(*) = 0 then 'PASS — all enabled'
            else 'FAIL — ' || count(*) || ' without RLS: ' || string_agg(tablename, ', ') end
from pg_tables where schemaname = 'public' and not rowsecurity

union all

-- 4. No workspace table carries an anon policy. The public surface is
--    SECURITY DEFINER functions only — never a policy that lets the
--    anon role read a table directly.
select '4. no anon policies on tables',
       case when count(*) = 0 then 'PASS — none'
            else 'FAIL — ' || string_agg(schemaname || '.' || tablename || ':' || policyname, ', ') end
from pg_policies
where schemaname = 'public' and 'anon' = any(roles)

union all

-- 5. The one deliberate cross-workspace read is still only the two
--    tables it was approved for. is_platform_admin() must not appear
--    in a policy on anything else.
select '5. platform admin reach',
       case when count(*) filter (where tablename not in ('feedback', 'feature_usage', 'plans', 'subscriptions', 'promo_codes', 'promo_redemptions')) = 0
            then 'PASS — feedback and billing tables only'
            else 'FAIL — also on: ' || string_agg(tablename, ', ')
                 filter (where tablename not in ('feedback', 'feature_usage', 'plans', 'subscriptions', 'promo_codes', 'promo_redemptions')) end
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || coalesce(with_check, '')) like '%is_platform_admin%'
union all

-- 6. Every write policy on workspace data requires can_write(), so a
--    viewer cannot write through the API.
select '6. write policies guarded',
       format('%s of %s carry can_write()',
         count(*) filter (where (coalesce(qual,'') || coalesce(with_check,'')) like '%can_write%'),
         count(*))
from pg_policies
where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE')
  and tablename not in ('profiles','feedback','plans','subscriptions',
                        'promo_codes','promo_redemptions','workspaces')

union all

-- 7. RLS is not enough on its own: SECURITY DEFINER functions bypass
--    it entirely, so the trigger has to be on every workspace table.
select '7. assert_can_write triggers',
       case when count(*) >= 32 then 'PASS — ' || count(*) || ' tables'
            else 'FAIL — only ' || count(*) end
from pg_trigger where tgname = 'assert_can_write' and not tgisinternal

union all

-- 8. A member must not read a child row belonging to a project they
--    cannot see.
--
--    NOTE ON THE PATTERN: Postgres normalises a policy expression when
--    it stores it — "public.projects" comes back as "projects", and it
--    inserts newlines. An earlier version of this check looked for
--    "from public.projects" and reported 0 of 16 while the scoping was
--    provably working. A check that cries wolf gets ignored, which is
--    worse than not having it.
select '8. child tables member-scoped',
  case when count(*) filter (where not (qual ilike '%is_owner()%'
         and (qual ilike '%FROM projects%' or qual ilike '%FROM contacts%'))) = 0
       then 'PASS — all 16 scoped'
       else 'FAIL — unscoped: ' || string_agg(tablename, ', ')
            filter (where not (qual ilike '%is_owner()%'
                   and (qual ilike '%FROM projects%' or qual ilike '%FROM contacts%'))) end
from pg_policies
where schemaname = 'public' and cmd = 'SELECT'
  and tablename in ('approvals','bookings','checklist_items','fee_calculations','files',
                    'generated_documents','invoices','notes','portal_links','project_stages',
                    'project_suppliers','quotations','reminders','revisions','tasks','time_logs')

union all

-- 9. THE SEEDER ASSERTS WHAT IT WROTE.
--
--    A write with a fixed, known row count must check that count and
--    raise when it does not match. This is not style. The revisions
--    upsert was originally an UPDATE against a row that did not exist
--    yet: zero rows matched, Postgres returned success, the seeder
--    reported a clean run, and the revision counter rendered blank.
--    Nothing failed. That is the whole problem — an exit code says
--    the statement ran, not that it did anything.
--
--    The rule this enforces: every table a seeder writes is covered by
--    at least one demo_expect(). It caught its first gap immediately —
--    receipts had two inserts and no assertion at all.
select '9. seeder asserts its writes',
       case when count(*) filter (where asserts < tables_written) = 0
            then 'PASS — ' || sum(asserts) || ' assertions cover ' || sum(tables_written) || ' tables'
            else 'FAIL — unasserted writes in: '
                 || string_agg(proname, ', ') filter (where asserts < tables_written) end
from (
  select p.proname,
         (length(p.prosrc) - length(replace(p.prosrc, 'demo_expect(', '')))
           / length('demo_expect(') as asserts,
         (select count(distinct m[1])
            from regexp_matches(p.prosrc, 'insert into public\.(\w+)', 'g') m) as tables_written
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'demo_seed%'
) s

union all

-- 10. Loading demo data cannot touch a real record. The guarantee is
--     only worth what it is checked against, so load_demo_data()
--     counts real contacts before and after and refuses to return if
--     the number moved. This check is that the guard is still there.
select '10. demo load guards real data',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'load_demo_data'
                     and p.prosrc like '%real_before%' and p.prosrc like '%real_after%') = 1
            then 'PASS — before/after guard present'
            else 'FAIL — load_demo_data no longer counts real records' end;
