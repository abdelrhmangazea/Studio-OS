-- =============================================================
-- Studio OS — Bucket 5 follow-up: the 'file' booking question
--
-- The question builder always offered a 'file' type, but the public
-- page rendered it as a text box. This makes it real.
--
-- WHY THE UPLOAD HAPPENS AFTER THE BOOKING, NOT BEFORE:
--
-- The storage policy for receipts is safe because every path must
-- resolve to a real booking — that is the whole guard. While the form
-- is still being filled there is no booking yet, so an upload-first
-- design would mean letting anon write files under a workspace with
-- nothing behind them. That is an open drop-box on the designer's
-- storage, so we do not do it.
--
-- Instead: the booking commits first (one transaction, unchanged),
-- and the files go up immediately afterwards against the token it
-- returns. If an upload fails, the booking still stands and the
-- confirmation page asks for that file again — public_booking_status
-- reports exactly which ones are still missing.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Where the paths live
--
-- Keyed by question id, NOT by the answer label: the label changes
-- with the page language, so keying on it would silently split one
-- question into two entries.
-- -------------------------------------------------------------

alter table public.bookings
  add column if not exists answer_files jsonb not null default '{}'::jsonb;

comment on column public.bookings.answer_files is
  'Uploaded answers to file questions: {question_id: {path, name}}';


-- -------------------------------------------------------------
-- 2. The bucket
--
-- Private, size-capped, mime-whitelisted — all three enforced by the
-- bucket itself, which no policy can do.
-- -------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-files', 'booking-files', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


/**
 * Validates a path of the form {workspace_id}/{booking_token}/answers/…
 *
 * SECURITY DEFINER for the same reason receipt_upload_allowed is: anon
 * cannot read `bookings`, so the check has to run somewhere that can.
 */
create or replace function public.booking_file_upload_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(object_name, '/', 3) = 'answers'
     and exists (
    select 1
    from public.bookings b
    where b.workspace_id::text = split_part(object_name, '/', 1)
      and b.public_token::text = split_part(object_name, '/', 2)
      and b.status <> 'cancelled'
  );
$$;

revoke execute on function public.booking_file_upload_allowed(text) from public;
grant  execute on function public.booking_file_upload_allowed(text) to anon, authenticated;


-- anon may ONLY insert, and only under a path that resolves to a real
-- booking. No select, no update, no delete.
create policy "booking_files_anon_insert" on storage.objects for insert
  to anon
  with check (
    bucket_id = 'booking-files'
    and public.booking_file_upload_allowed(name)
  );

create policy "booking_files_owner_read" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'booking-files'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "booking_files_owner_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'booking-files'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );


-- -------------------------------------------------------------
-- 3. Recording an uploaded answer file
-- -------------------------------------------------------------

create or replace function public.public_attach_answer_file(
  p_token    uuid,
  p_question uuid,
  p_path     text,
  p_name     text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking  public.bookings%rowtype;
  question public.booking_questions%rowtype;
begin
  select * into booking from public.bookings where public_token = p_token;
  if not found then
    raise exception 'unknown booking';
  end if;

  -- The path must sit inside this booking's own folder.
  if split_part(p_path, '/', 1) <> booking.workspace_id::text
     or split_part(p_path, '/', 2) <> booking.public_token::text
     or split_part(p_path, '/', 3) <> 'answers' then
    raise exception 'that file does not belong to this booking';
  end if;

  -- And the question must be a real file question on this same page.
  select * into question from public.booking_questions
  where id = p_question
    and workspace_id = booking.workspace_id
    and field_type = 'file';
  if not found then
    raise exception 'that question does not take a file';
  end if;

  update public.bookings
  set answer_files = answer_files || jsonb_build_object(
        p_question::text,
        jsonb_build_object('path', p_path, 'name', left(coalesce(p_name, ''), 200))
      )
  where id = booking.id;

  return jsonb_build_object('ok', true);
end;
$$;


-- -------------------------------------------------------------
-- 4. The confirmation page needs to know what is still missing
--
-- Same shape as before plus `pending_files`, so a failed upload can be
-- retried without the client having to book again.
-- -------------------------------------------------------------

create or replace function public.public_booking_status(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'client_name', b.client_name,
    'slot_start',  b.slot_start,
    'slot_end',    b.slot_end,
    'status',      b.status,
    'timezone',    cfg.timezone,
    'session',     jsonb_build_object('label_ar', t.label_ar, 'label_en', t.label_en, 'mode', t.mode),
    'studio',      jsonb_build_object('name', s.studio_name, 'logo_url', s.logo_url,
                                      'accent_color', s.accent_color,
                                      'language', s.default_language),
    'invoice', (
      select jsonb_build_object('id', i.id, 'amount', i.amount, 'currency', i.currency,
                                'status', i.status)
      from public.invoices i
      where i.booking_id = b.id and i.status <> 'draft'
      order by i.created_at desc limit 1
    ),
    'receipt_uploaded', exists (
      select 1 from public.receipts r
      join public.invoices i on i.id = r.invoice_id
      where i.booking_id = b.id
    ),
    -- File questions this booking has not delivered a file for yet.
    'pending_files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'label_ar', q.label_ar, 'label_en', q.label_en
      ) order by q.sort_order)
      from public.booking_questions q
      where q.workspace_id = b.workspace_id
        and q.active
        and q.field_type = 'file'
        and not (b.answer_files ? q.id::text)
    ), '[]'::jsonb),
    'upload_prefix', b.workspace_id::text || '/' || b.public_token::text
  )
  from public.bookings b
  join public.booking_settings cfg on cfg.workspace_id = b.workspace_id
  left join public.session_types t on t.id = b.session_type_id
  join public.studio_settings s on s.workspace_id = b.workspace_id
  where b.public_token = p_token;
$$;


-- -------------------------------------------------------------
-- 5. Grants — one more public function, and nothing else
-- -------------------------------------------------------------

revoke execute on function public.public_attach_answer_file(uuid, uuid, text, text) from public;
grant  execute on function public.public_attach_answer_file(uuid, uuid, text, text) to anon, authenticated;

revoke execute on function public.public_booking_status(uuid) from public;
grant  execute on function public.public_booking_status(uuid) to anon, authenticated;
