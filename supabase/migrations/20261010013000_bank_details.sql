-- Run once in Supabase SQL Editor after finishing ERP UI changes.
-- Bank information is stored as text to preserve leading zeros in account numbers.
begin;
alter table public.businesses add column if not exists bank_name text;
alter table public.businesses add column if not exists bank_account_name text;
alter table public.businesses add column if not exists bank_account_number text;
alter table public.businesses add column if not exists bank_ifsc text;
alter table public.businesses add column if not exists bank_branch text;
alter table public.businesses add column if not exists bank_upi_id text;
alter table public.suppliers add column if not exists bank_name text;
alter table public.suppliers add column if not exists bank_account_name text;
alter table public.suppliers add column if not exists bank_account_number text;
alter table public.suppliers add column if not exists bank_ifsc text;
alter table public.suppliers add column if not exists bank_branch text;
alter table public.suppliers add column if not exists bank_upi_id text;
-- Existing RLS policies still apply; do not disable RLS.
-- Supplier bank fields are updated by the authenticated owner/manager after save_supplier RPC.
grant update (bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id) on public.suppliers to authenticated;
grant select (bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id) on public.suppliers to authenticated;
grant update (bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id) on public.businesses to authenticated;
grant select (bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id) on public.businesses to authenticated;
commit;
