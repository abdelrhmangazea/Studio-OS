-- =============================================================
-- Studio OS — Legal & Contract layer
--
-- An addition on top of Buckets 1–7, not a new bucket.
--
-- Everything here is OPTIONAL. A studio that never opens the Legal
-- tab keeps working exactly as before; the contract simply shows
-- [[markers]] where a detail is missing, the same as any other
-- unfilled merge field.
--
-- Two things deliberately do NOT become columns:
--
--   working_days / working_hours  derived at generation time from
--     booking_settings.availability, which Bucket 5 already owns.
--     Storing them again would let the contract and the booking page
--     disagree about when the studio is open.
--
--   revision_allowance            reads studio_settings.default_revision_allowance
--     from Bucket 6. The contract and the portal counter read the
--     same row, so they can never quote different numbers.
-- =============================================================


-- -------------------------------------------------------------
-- 1. The studio as a legal entity
-- -------------------------------------------------------------

alter table public.studio_settings
  add column if not exists legal_name               text,
  add column if not exists registration_number      text,
  add column if not exists registered_address       text,
  add column if not exists country                  text,
  add column if not exists representative_name      text,
  add column if not exists representative_id        text,
  add column if not exists representative_id_type   text,
  add column if not exists representative_issuer    text,
  add column if not exists governing_law            text,
  add column if not exists dispute_venue            text,
  add column if not exists vat_rate                 numeric,
  add column if not exists vat_treatment            text
    check (vat_treatment is null or vat_treatment in ('inclusive', 'exclusive')),
  add column if not exists minimum_project_value    numeric,
  -- {lead_designer, senior_assistant, design_manager, office_designer, office_admin}
  add column if not exists hourly_rates             jsonb not null default '{}'::jsonb;

comment on column public.studio_settings.hourly_rates is
  'Optional hourly rates by role, merged into the contract fee clause.';


-- -------------------------------------------------------------
-- 2. The client as a signing party
-- -------------------------------------------------------------

alter table public.contacts
  add column if not exists id_number text,
  add column if not exists id_type   text
    check (id_type is null or id_type in ('national_id', 'passport', 'residency', 'commercial_registration')),
  add column if not exists id_issuer text;


-- -------------------------------------------------------------
-- 3. Documents that carry a legal caveat
--
-- Both columns are data rather than a hard-coded template key, so any
-- future document inherits the same behaviour without touching code:
--
--   needs_legal_review  this language version must NOT be handed to a
--                       client. The generator falls back to the paired
--                       language that is safe to use.
--   legal_notice        shown above the document while generating.
-- -------------------------------------------------------------

alter table public.template_library
  add column if not exists legal_notice       text,
  add column if not exists needs_legal_review boolean not null default false;

alter table public.templates
  add column if not exists legal_notice       text,
  add column if not exists needs_legal_review boolean not null default false;


-- Carry the two new columns through into every workspace's copy.
create or replace function public.seed_workspace_templates(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.templates
    (workspace_id, key, type, channel, stage, language, title, subject, body,
     is_system, sort_order, legal_notice, needs_legal_review)
  select target_workspace, l.key, l.type, l.channel, l.stage, l.language,
         l.title, l.subject, l.body, true, l.sort_order,
         l.legal_notice, l.needs_legal_review
  from public.template_library l
  on conflict (workspace_id, key, language) do nothing;

  insert into public.questionnaire_templates (workspace_id, key, structure)
  select target_workspace, q.key, q.structure
  from public.questionnaire_library q
  on conflict (workspace_id, key) do nothing;
end;
$$;
