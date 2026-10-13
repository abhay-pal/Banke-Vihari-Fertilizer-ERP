-- Transport module. Run in Supabase SQL editor after backup.
-- Transport records are scoped to the logged-in user's business_id.
create table if not exists public.transport_records (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 module text not null check (module in ('trucks','drivers','attendance','payroll','trips','diesel','maintenance','expenses','customers','receipts','documents')),
 title text not null,
 truck_number text,
 driver_name text,
 entry_date date not null default current_date,
 amount numeric(14,2) not null default 0,
 quantity numeric(14,2),
 odometer numeric(14,2),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists transport_records_business_module_date_idx on public.transport_records(business_id,module,entry_date desc);
create index if not exists transport_records_truck_idx on public.transport_records(business_id,truck_number,entry_date desc);
alter table public.transport_records enable row level security;
drop policy if exists transport_records_select on public.transport_records;
create policy transport_records_select on public.transport_records for select to authenticated using
 (exists(select 1 from public.profiles p where p.id=auth.uid() and p.business_id=transport_records.business_id and p.status='active'));
drop policy if exists transport_records_insert on public.transport_records;
create policy transport_records_insert on public.transport_records for insert to authenticated with check
 (exists(select 1 from public.profiles p where p.id=auth.uid() and p.business_id=transport_records.business_id and p.status='active' and p.role_code in ('owner','manager')));
drop policy if exists transport_records_update on public.transport_records;
create policy transport_records_update on public.transport_records for update to authenticated using
 (exists(select 1 from public.profiles p where p.id=auth.uid() and p.business_id=transport_records.business_id and p.status='active' and p.role_code in ('owner','manager')))
 with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.business_id=transport_records.business_id and p.status='active' and p.role_code in ('owner','manager')));
drop policy if exists transport_records_delete on public.transport_records;
create policy transport_records_delete on public.transport_records for delete to authenticated using
 (exists(select 1 from public.profiles p where p.id=auth.uid() and p.business_id=transport_records.business_id and p.status='active' and p.role_code='owner'));
grant select,insert,update,delete on public.transport_records to authenticated;
