-- =============================================================
-- Studio OS — Bucket 1: Foundation (function grants)
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default.
-- In Supabase that means every function in the `public` schema is
-- reachable as a REST endpoint at /rest/v1/rpc/<name> — including
-- ones that were only ever meant to run inside a trigger or a
-- policy. Supabase's own security linter flags this.
--
-- This file closes those endpoints.
-- =============================================================

-- Trigger functions: nobody calls these directly, ever.
revoke execute on function public.handle_new_user()  from public, anon, authenticated;
revoke execute on function public.set_updated_at()   from public, anon, authenticated;

-- Policy helpers: `authenticated` genuinely needs EXECUTE, because
-- RLS evaluates policy expressions as the calling role. `anon` does
-- not — it has no policies granted to it anywhere.
revoke execute on function public.current_workspace_id() from public, anon;
revoke execute on function public.is_owner()             from public, anon;

grant execute on function public.current_workspace_id() to authenticated;
grant execute on function public.is_owner()             to authenticated;
