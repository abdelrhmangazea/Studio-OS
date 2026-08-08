-- =============================================================
-- Studio OS — a studio can close its own account.
--
-- Item 24. Someone who signed up for a beta must be able to leave it
-- without emailing anyone and waiting.
--
-- This is the one genuinely irreversible thing in the product, so it
-- is built to be hard to do by accident and impossible to do to
-- somebody else:
--
--   * The caller proves intent by typing their studio's name. Not a
--     yes/no dialog — those get clicked through.
--   * It only ever deletes the CALLER's own workspace, read from the
--     session. There is no id parameter to get wrong or to forge.
--   * Only an owner may. A member cannot delete the studio they were
--     invited into.
--   * It refuses if there is more than one member, because one person
--     leaving is not the same as closing the studio. They have to
--     remove the others first, deliberately.
--
-- What goes: the workspace row, and everything hanging off it by
-- cascade — contacts, projects, invoices, documents, bookings,
-- portal links, tasks, the lot. Then the auth users.
--
-- What does NOT go: files in Storage. Nothing in the database can
-- reach them. They are orphaned, not removed, and that has to be
-- said out loud rather than implied — see DISASTER-RECOVERY.md.
-- =============================================================

create or replace function public.delete_my_account(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws          uuid := public.current_workspace_id();
  caller      uuid := auth.uid();
  studio      text;
  members     integer;
  is_owner    boolean;
  member_ids  uuid[];
begin
  if ws is null or caller is null then
    raise exception 'not signed in';
  end if;

  select p.role = 'owner' into is_owner
  from public.profiles p where p.id = caller;

  if not coalesce(is_owner, false) then
    raise exception 'only the studio owner can close the account';
  end if;

  select w.name into studio from public.workspaces w where w.id = ws;

  -- Typed, not clicked. Trimmed but case-sensitive: this should take
  -- a moment of attention.
  if trim(coalesce(p_confirmation, '')) <> trim(coalesce(studio, '')) then
    raise exception 'the studio name does not match';
  end if;

  select count(*) into members from public.profiles p where p.workspace_id = ws;

  if members > 1 then
    raise exception 'remove the other team members first';
  end if;

  select array_agg(p.id) into member_ids
  from public.profiles p where p.workspace_id = ws;

  -- The workspace takes everything with it by cascade.
  delete from public.workspaces where id = ws;

  -- Then the login itself, otherwise they can sign in to nothing.
  delete from auth.users where id = any(member_ids);

  return jsonb_build_object('ok', true, 'studio', studio);
end;
$$;

revoke execute on function public.delete_my_account(text) from public;
revoke execute on function public.delete_my_account(text) from anon;
grant  execute on function public.delete_my_account(text) to authenticated;
