-- =============================================================
-- Studio OS — an invoice takes its currency from the studio that
-- issued it, not from a hardcoded default.
--
-- Found by the Bucket 9 currency audit. No display anywhere in the
-- app hardcodes a symbol — every screen reads settings.currency or
-- invoice.currency, and the seeded templates carry none. But the
-- SCHEMA did:
--
--   invoices.currency   default 'EGP'
--
-- So a Riyadh studio with currency = 'SAR' that issues an invoice
-- without naming the currency gets EGP printed on a financial
-- document. Nothing is wrong today because every workspace is
-- currently EGP — which is exactly why it would not have been
-- noticed until the first Gulf studio was onboarded, and the first
-- thing they would see is an invoice in the wrong money.
--
-- A default cannot read another table, so this is a trigger. The
-- column default is dropped so there is only one answer to "what
-- currency is this invoice in", and it is the studio's.
-- =============================================================


alter table public.invoices alter column currency drop default;

create or replace function public.invoice_currency_from_studio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null or trim(new.currency) = '' then
    select s.currency into new.currency
    from public.studio_settings s
    where s.workspace_id = new.workspace_id;
  end if;

  -- A workspace with no settings row should be impossible — the signup
  -- trigger writes one. Fall back rather than fail an invoice, but do
  -- not invent a country: EGP is the product's home market and the
  -- studio can correct it on the invoice itself.
  new.currency := coalesce(nullif(trim(new.currency), ''), 'EGP');

  return new;
end;
$$;

drop trigger if exists invoice_currency_from_studio on public.invoices;
create trigger invoice_currency_from_studio
  before insert on public.invoices
  for each row execute function public.invoice_currency_from_studio();


-- Quotations already allow null, and the quotation card passes the
-- studio's currency explicitly. Same trigger so the two cannot drift.
create or replace function public.quotation_currency_from_studio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null or trim(new.currency) = '' then
    select s.currency into new.currency
    from public.studio_settings s
    where s.workspace_id = new.workspace_id;
  end if;

  return new;
end;
$$;

drop trigger if exists quotation_currency_from_studio on public.quotations;
create trigger quotation_currency_from_studio
  before insert on public.quotations
  for each row execute function public.quotation_currency_from_studio();
