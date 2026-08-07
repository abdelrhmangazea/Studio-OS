-- =============================================================
-- Studio OS — narrowing what a new function is granted at birth,
-- and writing down the check that actually catches the rest.
--
-- This bit twice in one bucket, so it is worth stating exactly how
-- it works rather than "fixing" it and moving on.
--
-- A function in `public` picks up TWO separate EXECUTE grants when
-- it is created:
--
--   =X/postgres        PUBLIC. Postgres itself grants EXECUTE on
--                      every new function to PUBLIC, and anon is a
--                      member of PUBLIC like everybody else.
--   anon=X/postgres    Supabase's default privilege rule, which
--                      names anon and authenticated explicitly.
--
-- Revoking one leaves the other, and has_function_privilege() still
-- answers yes. That is what went wrong:
--
--   * 0028 created throttle() and request_ip() with `revoke ... from
--     public`. Both were still callable by anon through Supabase's
--     explicit grant — which handed anyone a way to fill someone
--     else's rate-limit bucket and lock them out of the booking page.
--   * 0030 created three trigger functions. The anon-callable surface
--     went 12 -> 15. Revoking from anon and authenticated alone did
--     NOT bring it back down, because the PUBLIC grant was still
--     there.
--
-- WHAT THIS MIGRATION ACTUALLY DOES — verified, not assumed:
--
--   It removes Supabase's explicit anon/authenticated default grant.
--   A function created after this has ACL {=X, postgres=X,
--   service_role=X} instead of {=X, postgres=X, anon=X,
--   authenticated=X, service_role=X}.
--
-- WHAT IT DOES NOT DO:
--
--   It does not stop the PUBLIC grant. ALTER DEFAULT PRIVILEGES
--   records the revocation (pg_default_acl for postgres/public/f no
--   longer lists PUBLIC) and new functions still come out with =X
--   anyway. Probed directly: created a bare function afterwards and
--   read its proacl. So a new function IS still anon-reachable
--   unless its own migration revokes from PUBLIC.
--
-- THEREFORE the rule for every future migration, unchanged and now
-- load-bearing: a function is followed by
--
--     revoke execute on function public.x(...) from public;
--     revoke execute on function public.x(...) from anon, authenticated;
--
-- and only then, if it is meant to be public, an explicit grant.
--
-- And the control that actually catches a slip is not a default at
-- all, it is the check in spike/security-check.sql, which asserts
-- the anon-callable surface is exactly the twelve intended public
-- functions and nothing else. Run it after any migration.
-- =============================================================

alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;


-- The three from 0030 that slipped through. All return `trigger`, so
-- PostgREST would not have exposed them as RPCs and nothing was
-- actually reachable — but the surface should read as intended, not
-- as intended-plus-three.
revoke execute on function public.touch_feedback() from public;
revoke execute on function public.touch_feedback() from anon, authenticated;
revoke execute on function public.invoice_currency_from_studio() from public;
revoke execute on function public.invoice_currency_from_studio() from anon, authenticated;
revoke execute on function public.quotation_currency_from_studio() from public;
revoke execute on function public.quotation_currency_from_studio() from anon, authenticated;
