-- =============================================================
-- Studio OS — locked templates are visible, not hidden.
--
-- A locked template a designer can SEE is what makes them upgrade.
-- One they cannot see does not exist to them. So every template is
-- seeded and listed as normal; the lock is a state, not an absence.
--
-- Locked means: cannot generate from, cannot export. Preview is fine
-- — reading the words is what tells them whether it is worth paying
-- for.
--
-- THREE THINGS ARE NEVER LOCKED
--
--   is_system = false   They wrote it. Locking a person's own work
--                       behind a paywall is taking, not withholding.
--   type = checklist    The stage checklists ARE the product. A Free
--                       workspace with locked stages has no product.
--   already generated   Past work survives every downgrade, enforced
--                       by this gate not existing on reads at all.
-- =============================================================

create or replace function public.template_locked(p_template_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tpl  public.templates%rowtype;
  keys text[];
begin
  select * into tpl from public.templates where id = p_template_id;
  if not found then return false; end if;

  if not tpl.is_system then return false; end if;
  if tpl.type = 'checklist' then return false; end if;

  select usable_template_keys into keys
    from public.plans
   where key = public.effective_plan_key(tpl.workspace_id);

  -- null means the plan names no subset, so everything is usable.
  if keys is null then return false; end if;

  return not (tpl.key = any(keys));
end;
$$;

revoke execute on function public.template_locked(uuid) from public;
revoke execute on function public.template_locked(uuid) from anon;
grant  execute on function public.template_locked(uuid) to authenticated;


/** One call for the whole library, so it does not ask per row. */
create or replace function public.my_template_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ws   uuid := public.current_workspace_id();
  keys text[];
  pk   text;
begin
  if ws is null then return null; end if;

  pk := public.effective_plan_key(ws);
  select usable_template_keys into keys from public.plans where key = pk;

  return jsonb_build_object(
    'plan_key', pk,
    'unlimited', keys is null,
    'usable_keys', coalesce(to_jsonb(keys), 'null'::jsonb),
    'max_usable', (select max_usable_templates from public.plans where key = pk),
    'total_system', (select count(distinct key) from public.templates
                     where workspace_id = ws and is_system and type <> 'checklist')
  );
end;
$$;

revoke execute on function public.my_template_access() from public;
revoke execute on function public.my_template_access() from anon;
grant  execute on function public.my_template_access() to authenticated;


-- The gate that cannot be walked around.
--
-- Generating is the only way a template becomes something a client
-- sees, so this is the only place the rule has to hold. Greying out
-- a button is a courtesy; this is the control.
create or replace function public.generated_within_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pk   text;
  keys text[];
  gen  boolean;
begin
  pk := public.effective_plan_key(new.workspace_id);

  select document_generator_enabled, usable_template_keys
    into gen, keys
    from public.plans where key = pk;

  -- Their own template. Never locked, so a workspace with no
  -- generator at all can still produce from what it wrote itself.
  if exists (
    select 1 from public.templates t
     where t.workspace_id = new.workspace_id
       and t.key = new.template_key
       and not t.is_system
  ) then
    return new;
  end if;

  if not coalesce(gen, false) then
    raise exception 'FEATURE_LOCKED:document_generator_enabled:%', pk;
  end if;

  if keys is not null and not (new.template_key = any(keys)) then
    raise exception 'TEMPLATE_LOCKED:%:%', new.template_key, pk;
  end if;

  return new;
end;
$$;

drop trigger if exists generated_within_plan on public.generated_documents;
create trigger generated_within_plan before insert on public.generated_documents
  for each row execute function public.generated_within_plan();
