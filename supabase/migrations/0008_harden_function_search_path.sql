-- =============================================================
-- Studio OS — harden every function's search_path
--
-- All nine functions already set `search_path = public`. This tightens
-- them to the empty path. No function body is touched — these are
-- ALTER FUNCTION statements, so behaviour cannot change by construction.
--
-- WHY THIS MATTERS
--
-- Postgres searches the temporary schema (pg_temp) for relation names
-- BEFORE anything listed in search_path, and any user may create temp
-- tables. So with `search_path = public`, an unqualified reference such
-- as `profiles` inside a SECURITY DEFINER function could be hijacked by
-- a user creating `pg_temp.profiles` — the function would then read the
-- attacker's table while running with the definer's privileges.
--
-- Today that is not exploitable here: every reference in all nine
-- bodies is schema-qualified, and neither `anon` nor `authenticated`
-- holds CREATE on the public schema. But both of those are conventions
-- that a future edit could quietly break — a single unqualified table
-- name, or someone re-granting CREATE on public, which Supabase used to
-- do by default.
--
-- With `search_path = ''` the guarantee moves out of coding discipline
-- and into the database: an unqualified reference stops resolving at
-- all, so the mistake fails loudly instead of becoming a privilege
-- escalation. pg_catalog is still searched implicitly, so built-in
-- types, functions and operators continue to resolve normally.
-- =============================================================

-- Policy helpers, called by RLS as the invoking role
alter function public.current_workspace_id()            set search_path = '';
alter function public.is_owner()                        set search_path = '';

-- Trigger functions
alter function public.set_updated_at()                  set search_path = '';
alter function public.bump_last_contact()               set search_path = '';
alter function public.sync_client_from_status()         set search_path = '';
alter function public.handle_new_user()                 set search_path = '';

-- Seeding and maintenance
alter function public.seed_workspace_lists(uuid)        set search_path = '';
alter function public.seed_workspace_templates(uuid)    set search_path = '';
alter function public.reset_system_templates()          set search_path = '';
