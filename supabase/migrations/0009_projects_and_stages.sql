-- =============================================================
-- Studio OS — Bucket 4: Projects & Stage Engine
--
-- Every project runs the same ten stages, and every stage has the same
-- four blocks. The per-stage differences live in DATA — one row in
-- stage_definitions — not in ten screens and not in ten code paths.
--
-- The gate rules live here rather than in JavaScript, so that
-- "signed contract AND first payment, never one" holds no matter what
-- calls the database.
-- =============================================================

create type public.project_state as enum
  ('on_track', 'waiting_client', 'needs_attention', 'on_hold', 'closed');

create type public.stage_status as enum ('locked', 'active', 'complete');


-- -------------------------------------------------------------
-- 1. The ten stages — system-wide reference data
--
-- gate_flags is a list of the individual facts a stage needs before it
-- can close, each with its own label. A stage with two flags needs BOTH.
-- -------------------------------------------------------------

create table public.stage_definitions (
  stage_key       text primary key,
  sort_order      integer not null,
  title_en        text not null,
  title_ar        text not null,
  gate_flags      jsonb   not null default '[]'::jsonb,
  never_closes    boolean not null default false,
  skippable       boolean not null default false,
  expected_docs_en text,
  expected_docs_ar text,
  -- which templates.stage values feed this stage's Messages block
  template_stages text[] not null default '{}'
);

insert into public.stage_definitions
  (stage_key, sort_order, title_en, title_ar, gate_flags, never_closes, skippable,
   expected_docs_en, expected_docs_ar, template_stages)
values
('01_consultation', 1, 'Design Consultation', 'الاستشارة التصميمية',
 '[{"key":"consultation_held","label_en":"Consultation held","label_ar":"تمت الاستشارة"}]',
 false, false, 'Consultation prep sheet', 'ورقة تحضير الاستشارة', '{01_consultation}'),

('02_fee_proposal', 2, 'Fee Proposal', 'عرض الأتعاب',
 '[{"key":"proposal_sent","label_en":"Proposal sent","label_ar":"تم إرسال العرض"},
   {"key":"outcome_recorded","label_en":"Outcome recorded (accepted or declined)","label_ar":"تم تسجيل النتيجة (قبول أو اعتذار)"}]',
 false, false, 'Fee proposal', 'عرض الأتعاب', '{02_fee_proposal}'),

('03_contract', 3, 'Contract & First Payment', 'العقد والدفعة الأولى',
 '[{"key":"contract_signed","label_en":"Signed contract uploaded","label_ar":"تم رفع العقد الموقّع"},
   {"key":"first_payment","label_en":"First payment confirmed","label_ar":"تم تأكيد الدفعة الأولى"}]',
 false, false, 'Contract · Scope annex · Payment schedule · Invoice',
 'العقد · ملحق نطاق العمل · جدول الدفعات · الفاتورة', '{03_contract}'),

('04_onboarding', 4, 'Client Onboarding', 'استقبال العميل',
 '[{"key":"welcome_pack_sent","label_en":"Welcome pack sent","label_ar":"تم إرسال حقيبة الترحيب"},
   {"key":"questionnaire_returned","label_en":"Questionnaire returned","label_ar":"عادت الاستمارة"}]',
 false, false, 'Welcome pack · Client questionnaire', 'حقيبة الترحيب · استمارة العميل', '{04_onboarding}'),

('05_concept', 5, 'Concept', 'التصميم المبدئي',
 '[{"key":"client_approved","label_en":"Client approval recorded","label_ar":"تم تسجيل موافقة العميل"}]',
 false, false, 'Concept presentation', 'عرض التصميم المبدئي', '{execution}'),

('06_design_development', 6, 'Design Development', 'تطوير التصميم',
 '[{"key":"client_approved","label_en":"Client approval recorded","label_ar":"تم تسجيل موافقة العميل"}]',
 false, false, 'Working drawings · Material schedule', 'المخططات التنفيذية · جدول الخامات', '{execution}'),

('07_tender_ffe', 7, 'Tender & FF&E', 'المناقصة والأثاث',
 '[{"key":"drawings_complete","label_en":"Drawing set marked complete","label_ar":"اكتمل ملف الرسومات"}]',
 false, false, 'Tender package · FF&E schedule', 'ملف المناقصة · جدول الأثاث والتجهيزات', '{execution}'),

('08_construction', 8, 'Construction', 'التنفيذ',
 '[{"key":"construction_done","label_en":"Marked complete, or skipped","label_ar":"مكتملة، أو تم تخطّيها"}]',
 false, true, 'Site reports', 'تقارير الموقع', '{execution}'),

('09_delivered', 9, 'Delivered', 'التسليم',
 '[{"key":"handover_confirmed","label_en":"Handover confirmed","label_ar":"تم تأكيد التسليم"}]',
 false, false, 'Handover pack', 'حقيبة التسليم', '{}'),

('10_followup', 10, 'Follow-up', 'المتابعة',
 '[]', true, false, null, null, '{10_followup}');


-- -------------------------------------------------------------
-- 2. Project code counters
--
-- Codes are never reused, even if a project is deleted, so the number
-- comes from a counter that only ever increments — never from
-- max(code) + 1, which would hand out a deleted project's code again.
-- -------------------------------------------------------------

create table public.project_code_counters (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  year         integer not null,
  last_seq     integer not null default 0,
  primary key (workspace_id, year)
);


-- -------------------------------------------------------------
-- 3. Projects
-- -------------------------------------------------------------

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null default public.current_workspace_id()
                references public.workspaces (id) on delete cascade,
  contact_id    uuid not null references public.contacts (id) on delete cascade,
  code          text not null,
  name          text not null,
  address       text,
  area_sqm      numeric,
  project_type  text,
  requirements  text,
  current_stage text not null default '01_consultation'
                references public.stage_definitions (stage_key),
  state         public.project_state not null default 'on_track',

  -- "Delivered" means the design work is finished, NOT that the
  -- relationship ended. Follow-up and occasion reminders belong to the
  -- CONTACT, so a delivered project must never hide them.
  is_archived   boolean not null default false,

  started_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (workspace_id, code)
);

create index projects_workspace_idx on public.projects (workspace_id, is_archived);
create index projects_contact_idx   on public.projects (contact_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();


create table public.project_stages (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null default public.current_workspace_id()
                  references public.workspaces (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  stage_key       text not null references public.stage_definitions (stage_key),
  sort_order      integer not null,
  status          public.stage_status not null default 'locked',

  -- the individual gate facts, e.g. {"contract_signed":true,"first_payment":false}
  gate_state      jsonb   not null default '{}'::jsonb,
  gate_met        boolean not null default false,
  gate_override   boolean not null default false,
  override_reason text,
  overridden_at   timestamptz,
  completed_at    timestamptz,

  unique (project_id, stage_key)
);

create index project_stages_project_idx on public.project_stages (project_id, sort_order);


create table public.checklist_items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default public.current_workspace_id()
                   references public.workspaces (id) on delete cascade,
  project_id       uuid not null references public.projects (id) on delete cascade,
  stage_key        text not null,
  section_title_ar text,
  section_title_en text,
  label_ar         text,
  label_en         text,
  note_ar          text,
  note_en          text,
  sort_order       integer not null default 0,
  is_done          boolean not null default false,
  done_at          timestamptz,
  done_by          uuid references public.profiles (id)
);

create index checklist_items_project_idx on public.checklist_items (project_id, stage_key, sort_order);


-- Checklists are structured, so they need more than a body of text.
alter table public.templates add column structure jsonb;


-- -------------------------------------------------------------
-- 4. The gate rule, enforced in the database
--
-- A stage is closable only when EVERY flag it requires is true, or the
-- gate has been explicitly overridden with a reason. Stage 10 never
-- closes, whatever anyone writes into it.
-- -------------------------------------------------------------

create or replace function public.recompute_gate_met()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  definition public.stage_definitions%rowtype;
  flag       text;
  satisfied  boolean := true;
begin
  select * into definition
  from public.stage_definitions where stage_key = new.stage_key;

  if definition.never_closes then
    new.gate_met := false;
    return new;
  end if;

  if new.gate_override then
    new.gate_met := true;
    return new;
  end if;

  for flag in
    select value ->> 'key' from jsonb_array_elements(definition.gate_flags)
  loop
    if coalesce((new.gate_state ->> flag)::boolean, false) is not true then
      satisfied := false;
    end if;
  end loop;

  new.gate_met := satisfied;
  return new;
end;
$$;

create trigger project_stages_recompute_gate
  before insert or update on public.project_stages
  for each row execute function public.recompute_gate_met();


-- -------------------------------------------------------------
-- 5. Row Level Security
-- -------------------------------------------------------------

alter table public.stage_definitions     enable row level security;
alter table public.project_code_counters enable row level security;
alter table public.projects              enable row level security;
alter table public.project_stages        enable row level security;
alter table public.checklist_items       enable row level security;

create policy "stage_definitions_read" on public.stage_definitions
  for select to authenticated using (true);

-- Counters are touched only by next_project_code(), which is definer.
-- No policy at all: unreachable from the API.

create policy "projects_select" on public.projects for select
  to authenticated using (workspace_id = public.current_workspace_id());
create policy "projects_insert" on public.projects for insert
  to authenticated with check (workspace_id = public.current_workspace_id());
create policy "projects_update" on public.projects for update
  to authenticated
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
-- No DELETE: a project's code must never come back into circulation.

create policy "project_stages_select" on public.project_stages for select
  to authenticated using (workspace_id = public.current_workspace_id());
create policy "project_stages_update" on public.project_stages for update
  to authenticated
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "checklist_items_select" on public.checklist_items for select
  to authenticated using (workspace_id = public.current_workspace_id());
create policy "checklist_items_insert" on public.checklist_items for insert
  to authenticated with check (workspace_id = public.current_workspace_id());
create policy "checklist_items_update" on public.checklist_items for update
  to authenticated
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
create policy "checklist_items_delete" on public.checklist_items for delete
  to authenticated using (workspace_id = public.current_workspace_id());


-- -------------------------------------------------------------
-- 6. Project code allocation
-- -------------------------------------------------------------

create or replace function public.next_project_code(target_workspace uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  this_year integer := extract(year from now())::integer;
  prefix    text;
  seq       integer;
begin
  select coalesce(nullif(trim(s.project_code_prefix), ''), 'IZ') into prefix
  from public.studio_settings s where s.workspace_id = target_workspace;

  insert into public.project_code_counters (workspace_id, year, last_seq)
  values (target_workspace, this_year, 1)
  on conflict (workspace_id, year)
  do update set last_seq = public.project_code_counters.last_seq + 1
  returning last_seq into seq;

  return coalesce(prefix, 'IZ') || '-' || this_year || '-' || lpad(seq::text, 4, '0');
end;
$$;


-- -------------------------------------------------------------
-- 7. Creating a project
--
-- Allocates the code, builds all ten stages, instantiates the checklist
-- items from the workspace's OWN checklist templates, and opens stage 01.
--
-- The items are COPIES. Editing a checklist template afterwards changes
-- future projects only — a project in progress is never re-synced.
-- -------------------------------------------------------------

create or replace function public.create_project(
  p_contact_id  uuid,
  p_name        text,
  p_address     text default null,
  p_area        numeric default null,
  p_type        text default null,
  p_requirements text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws           uuid := public.current_workspace_id();
  new_project  uuid;
  new_code     text;
  definition   record;
  checklist    record;
  section      jsonb;
  item         jsonb;
  en_section   jsonb;
  en_item      jsonb;
  position     integer;
begin
  if ws is null then
    raise exception 'no workspace for the current user';
  end if;
  if not exists (select 1 from public.contacts c
                 where c.id = p_contact_id and c.workspace_id = ws) then
    raise exception 'that contact is not in your workspace';
  end if;

  new_code := public.next_project_code(ws);

  insert into public.projects
    (workspace_id, contact_id, code, name, address, area_sqm, project_type, requirements)
  values (ws, p_contact_id, new_code, p_name, p_address, p_area, p_type, p_requirements)
  returning id into new_project;

  -- All ten stages: the first is active, the rest are locked.
  insert into public.project_stages (workspace_id, project_id, stage_key, sort_order, status)
  select ws, new_project, d.stage_key, d.sort_order,
         case when d.sort_order = 1 then 'active' else 'locked' end::public.stage_status
  from public.stage_definitions d;

  -- Instantiate checklist items from this workspace's checklist
  -- templates, pairing Arabic and English by the item's stable id.
  for checklist in
    select ar.stage as stage_key, ar.structure as ar_struct, en.structure as en_struct
    from public.templates ar
    join public.templates en
      on en.workspace_id = ar.workspace_id and en.key = ar.key and en.language = 'en'
    where ar.workspace_id = ws
      and ar.type = 'checklist'
      and ar.language = 'ar'
      and ar.active
      and ar.stage is not null
  loop
    position := 0;

    for section in select * from jsonb_array_elements(checklist.ar_struct -> 'sections')
    loop
      select value into en_section
      from jsonb_array_elements(checklist.en_struct -> 'sections')
      where value ->> 'id' = section ->> 'id'
      limit 1;

      for item in select * from jsonb_array_elements(section -> 'items')
      loop
        select value into en_item
        from jsonb_array_elements(coalesce(en_section -> 'items', '[]'::jsonb))
        where value ->> 'id' = item ->> 'id'
        limit 1;

        position := position + 1;

        insert into public.checklist_items
          (workspace_id, project_id, stage_key,
           section_title_ar, section_title_en, label_ar, label_en,
           note_ar, note_en, sort_order)
        values
          (ws, new_project, checklist.stage_key,
           section ->> 'title', en_section ->> 'title',
           item ->> 'label',    en_item ->> 'label',
           section ->> 'note',  en_section ->> 'note',
           position);
      end loop;
    end loop;
  end loop;

  return new_project;
end;
$$;


-- -------------------------------------------------------------
-- 8. Working a stage
-- -------------------------------------------------------------

/** Sets one gate fact. The trigger recomputes gate_met from all of them. */
create or replace function public.set_gate_flag(p_stage_id uuid, p_flag text, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare ws uuid := public.current_workspace_id();
begin
  update public.project_stages
  set gate_state = jsonb_set(gate_state, array[p_flag], to_jsonb(p_value), true)
  where id = p_stage_id and workspace_id = ws;

  if not found then
    raise exception 'stage not found in your workspace';
  end if;
end;
$$;


/** Overriding a gate demands a written reason, and is permanent. */
create or replace function public.override_gate(p_stage_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare ws uuid := public.current_workspace_id();
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'an override needs a written reason';
  end if;

  update public.project_stages
  set gate_override = true,
      override_reason = trim(p_reason),
      overridden_at = now()
  where id = p_stage_id and workspace_id = ws;

  if not found then
    raise exception 'stage not found in your workspace';
  end if;
end;
$$;


/** Closes a stage and opens the next. Refuses if the gate is not met. */
create or replace function public.complete_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws      uuid := public.current_workspace_id();
  stage   public.project_stages%rowtype;
  nxt     public.project_stages%rowtype;
begin
  select * into stage from public.project_stages
  where id = p_stage_id and workspace_id = ws;

  if not found then
    raise exception 'stage not found in your workspace';
  end if;
  if not stage.gate_met then
    raise exception 'the gate for this stage is not satisfied';
  end if;

  update public.project_stages
  set status = 'complete', completed_at = now()
  where id = stage.id;

  select * into nxt from public.project_stages
  where project_id = stage.project_id and sort_order = stage.sort_order + 1;

  if found then
    update public.project_stages set status = 'active' where id = nxt.id;
    update public.projects set current_stage = nxt.stage_key where id = stage.project_id;
  end if;

  -- Delivered: the design work is finished. The project moves to the
  -- Delivered tab, and stage 10 keeps running on top of it.
  if stage.stage_key = '09_delivered' then
    update public.projects
    set delivered_at = now(), is_archived = true
    where id = stage.project_id;
  end if;
end;
$$;


revoke execute on function public.recompute_gate_met()               from public, anon, authenticated;
revoke execute on function public.next_project_code(uuid)            from public, anon, authenticated;
revoke execute on function public.create_project(uuid, text, text, numeric, text, text) from public, anon;
revoke execute on function public.set_gate_flag(uuid, text, boolean) from public, anon;
revoke execute on function public.override_gate(uuid, text)          from public, anon;
revoke execute on function public.complete_stage(uuid)               from public, anon;

grant execute on function public.create_project(uuid, text, text, numeric, text, text) to authenticated;
grant execute on function public.set_gate_flag(uuid, text, boolean) to authenticated;
grant execute on function public.override_gate(uuid, text)          to authenticated;
grant execute on function public.complete_stage(uuid)               to authenticated;
