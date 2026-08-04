-- =============================================================
-- Studio OS — Bucket 5: Booking (tables)
--
-- The public booking page is unauthenticated, so nothing here grants
-- `anon` a single policy. The public surface is four SECURITY DEFINER
-- functions in the next migration, each returning a hand-picked column
-- list. RLS on these tables stays shut to anon entirely.
-- =============================================================

create extension if not exists btree_gist with schema extensions;

create type public.session_mode    as enum ('zoom', 'onsite', 'office');
create type public.booking_status  as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type public.invoice_status  as enum ('draft', 'sent', 'paid');
create type public.question_type   as enum ('short_text', 'long_text', 'dropdown', 'checkbox', 'file');


-- -------------------------------------------------------------
-- 1. Settings
-- -------------------------------------------------------------

create table public.booking_settings (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid unique not null default public.current_workspace_id()
                       references public.workspaces (id) on delete cascade,

  -- [{ "day": 0-6, "start": "09:00", "end": "17:00" }] in the studio's own
  -- timezone. Day 0 is Sunday, which is the working week here.
  availability         jsonb   not null default '[]'::jsonb,

  session_duration_minutes integer not null default 60,
  buffer_minutes           integer not null default 15,
  minimum_notice_hours     integer not null default 24,
  maximum_days_ahead       integer not null default 60,
  timezone                 text    not null default 'Africa/Cairo',

  -- The public URL. Unique across every workspace, because it IS the URL.
  public_slug          text unique not null,
  is_active            boolean not null default false,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger booking_settings_set_updated_at
  before update on public.booking_settings
  for each row execute function public.set_updated_at();


create table public.blocked_dates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  date         date not null,
  reason       text,
  unique (workspace_id, date)
);


create table public.session_types (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null default public.current_workspace_id()
                   references public.workspaces (id) on delete cascade,
  label_ar         text not null,
  label_en         text not null,
  mode             public.session_mode not null default 'zoom',
  duration_minutes integer not null default 60,
  fee              numeric,
  active           boolean not null default true,
  sort_order       integer not null default 0
);


create table public.booking_questions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  label_ar     text not null,
  label_en     text not null,
  field_type   public.question_type not null default 'short_text',
  options      jsonb not null default '[]'::jsonb,
  is_required  boolean not null default false,
  sort_order   integer not null default 0,
  active       boolean not null default true
);


-- -------------------------------------------------------------
-- 2. Bookings
--
-- The exclusion constraint is the whole answer to "a slot must never be
-- offered twice". Two people submitting the same slot at the same moment
-- do not both succeed: one commits, the other is REFUSED by Postgres.
-- Checking for a clash before inserting cannot do this — it races.
--
-- Cancelled bookings fall outside the WHERE clause, so cancelling a
-- booking frees its slot again.
-- -------------------------------------------------------------

create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  session_type_id   uuid references public.session_types (id),

  slot_start        timestamptz not null,
  slot_end          timestamptz not null,
  status            public.booking_status not null default 'pending',

  client_name       text not null,
  client_email      text,
  client_phone_code text,
  client_phone      text,
  project_brief     text,
  answers           jsonb not null default '{}'::jsonb,

  contact_id        uuid references public.contacts (id) on delete set null,
  project_id        uuid references public.projects (id) on delete set null,

  -- The confirmation page's URL key. Unguessable, and the only thing the
  -- public side is ever given back.
  public_token      uuid not null default gen_random_uuid(),

  -- Unseen until the designer opens it. This is the whole notification.
  seen_at           timestamptz,
  created_at        timestamptz not null default now(),

  constraint bookings_slot_valid check (slot_end > slot_start),
  constraint bookings_no_overlap exclude using gist (
    workspace_id with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status in ('pending', 'confirmed'))
);

create index bookings_workspace_idx on public.bookings (workspace_id, slot_start desc);
create unique index bookings_public_token_idx on public.bookings (public_token);


-- -------------------------------------------------------------
-- 3. Invoices and receipts — no gateway anywhere
-- -------------------------------------------------------------

create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
               references public.workspaces (id) on delete cascade,
  contact_id   uuid references public.contacts (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  booking_id   uuid references public.bookings (id) on delete set null,
  stage_key    text,
  amount       numeric not null,
  currency     text not null default 'EGP',
  status       public.invoice_status not null default 'draft',
  issued_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index invoices_workspace_idx on public.invoices (workspace_id, created_at desc);


create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  file_url     text not null,
  uploaded_at  timestamptz not null default now(),

  -- Nothing is verified automatically. This flag, set by a human, is the
  -- only source of truth that money arrived.
  confirmed    boolean not null default false,
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz
);

create index receipts_invoice_idx on public.receipts (invoice_id);


-- -------------------------------------------------------------
-- 4. Row Level Security — authenticated only, workspace scoped
-- -------------------------------------------------------------

alter table public.booking_settings  enable row level security;
alter table public.blocked_dates     enable row level security;
alter table public.session_types     enable row level security;
alter table public.booking_questions enable row level security;
alter table public.bookings          enable row level security;
alter table public.invoices          enable row level security;
alter table public.receipts          enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'booking_settings','blocked_dates','session_types','booking_questions',
    'bookings','invoices','receipts'
  ]
  loop
    execute format($f$
      create policy %1$I on public.%2$I for select
        to authenticated using (workspace_id = public.current_workspace_id());
      create policy %3$I on public.%2$I for insert
        to authenticated with check (workspace_id = public.current_workspace_id());
      create policy %4$I on public.%2$I for update
        to authenticated
        using      (workspace_id = public.current_workspace_id())
        with check (workspace_id = public.current_workspace_id());
      create policy %5$I on public.%2$I for delete
        to authenticated using (workspace_id = public.current_workspace_id());
    $f$, tbl||'_select', tbl, tbl||'_insert', tbl||'_update', tbl||'_delete');
  end loop;
end;
$$;


-- -------------------------------------------------------------
-- 5. Receipt storage
--
-- Private bucket: no public read at all. The size cap and mime
-- whitelist are enforced by the bucket itself, which a policy cannot do.
-- -------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


/**
 * Validates an upload path of the form {workspace_id}/{booking_token}/…
 *
 * Used inside the storage policy. It has to be SECURITY DEFINER because
 * anon cannot read `bookings` — that is the point — so the check has to
 * happen somewhere that can.
 */
create or replace function public.receipt_upload_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    where b.workspace_id::text = split_part(object_name, '/', 1)
      and b.public_token::text = split_part(object_name, '/', 2)
      and b.status <> 'cancelled'
  );
$$;

revoke execute on function public.receipt_upload_allowed(text) from public;
grant  execute on function public.receipt_upload_allowed(text) to anon, authenticated;

-- anon may ONLY insert, and only under a path that resolves to a real
-- booking. No select, no update, no delete.
create policy "receipts_anon_insert" on storage.objects for insert
  to anon
  with check (bucket_id = 'receipts' and public.receipt_upload_allowed(name));

create policy "receipts_owner_read" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "receipts_owner_write" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );
