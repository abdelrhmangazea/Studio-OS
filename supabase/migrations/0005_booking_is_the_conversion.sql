-- =============================================================
-- Studio OS — Bucket 2 correction: booking is the conversion
--
-- Rule: a contact is a client exactly when their status is a won
-- one. There is no separate "convert" action. Booking the
-- consultation is what makes someone a client, which is what F1 in
-- the spec says: "Booking is the conversion trigger."
--
-- This is enforced here, in one trigger, rather than in the four
-- places the UI can change a status. That way it also holds for the
-- CSV importer, for the public booking page in Bucket 5, and for
-- anything written directly through the API.
--
-- Everything keys off the is_won flag, never the label "Booked" —
-- the studio can rename or translate that status from Settings.
-- =============================================================

create or replace function public.sync_client_from_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  status_is_won boolean := false;
begin
  if new.status_id is not null then
    select s.is_won into status_is_won
    from public.lead_statuses s
    where s.id = new.status_id;
  end if;

  status_is_won := coalesce(status_is_won, false);

  if status_is_won and not new.is_client then
    -- Booked: becomes a client, stamped once.
    new.is_client := true;
    new.converted_at := coalesce(new.converted_at, now());

  elsif not status_is_won and new.is_client then
    -- Moved off a booked status: back to being a lead.
    new.is_client := false;
    new.converted_at := null;
  end if;

  return new;
end;
$$;

create trigger contacts_sync_client
  before insert or update on public.contacts
  for each row execute function public.sync_client_from_status();

revoke execute on function public.sync_client_from_status() from public, anon, authenticated;


-- -------------------------------------------------------------
-- Backfill existing data — both directions.
--
-- Records written before this trigger existed can be inconsistent
-- either way round, so both are repaired.
-- -------------------------------------------------------------

-- 1. Marked as a client but not on a booked status.
--    They were marked deliberately, so give them the booked status
--    rather than demoting them back to a lead.
update public.contacts c
set status_id = (
  select s.id
  from public.lead_statuses s
  where s.workspace_id = c.workspace_id
    and s.is_won
  order by s.sort_order
  limit 1
)
where c.is_client
  and not exists (
    select 1
    from public.lead_statuses s
    where s.id = c.status_id
      and s.is_won
  );

-- 2. On a booked status but never marked as a client.
update public.contacts c
set is_client = true,
    converted_at = coalesce(c.converted_at, now())
where not c.is_client
  and exists (
    select 1
    from public.lead_statuses s
    where s.id = c.status_id
      and s.is_won
  );
