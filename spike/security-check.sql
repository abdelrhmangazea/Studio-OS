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
         ('receipt_upload_allowed')
),
actual as (
  select p.proname as name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and has_function_privilege('anon', p.oid, 'execute')
)
select '1. anon-callable surface' as check,
       case when not exists (select 1 from actual  except select 1 from intended)
             and not exists (select 1 from intended except select 1 from actual)
            then 'PASS — exactly the 12 intended'
            else 'FAIL — unexpected: '
                 || coalesce((select string_agg(name, ', ') from (select 1 from actual except select 1 from intended) x), '(none)')
                 || ' / missing: '
                 || coalesce((select string_agg(name, ', ') from (select 1 from intended except select 1 from actual) y), '(none)')
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
       case when count(*) filter (where tablename not in ('feedback', 'feature_usage')) = 0
            then 'PASS — feedback and feature_usage only'
            else 'FAIL — also on: ' || string_agg(tablename, ', ')
                 filter (where tablename not in ('feedback', 'feature_usage')) end
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || coalesce(with_check, '')) like '%is_platform_admin%';
