-- Transport ERP phase 2: normalized relational core for booking-to-payment workflow.
-- Run AFTER existing ERP base migrations. This does not remove transport_records.
begin;
create table if not exists public.transport_parties (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 party_type text not null check(party_type in ('customer','vendor','broker','fuel_pump')),
 name text not null, mobile text, gstin text, address text,
 credit_limit numeric(14,2) not null default 0, credit_days int not null default 0,
 bank_details jsonb not null default '{}'::jsonb, is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,business_id)
);
create table if not exists public.transport_fleet (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 registration text not null, vehicle_type text, capacity_ton numeric(9,2), make_model text, manufacture_year int,
 ownership text not null default 'owned' check(ownership in ('owned','hired','attached','leased')),
 status text not null default 'available' check(status in ('available','on_trip','workshop','breakdown','inactive')),
 purchase_price numeric(14,2), emi_amount numeric(14,2), emi_end_date date, financier text,
 fastag_id text, gps_url text, odometer_km numeric(12,2), details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), unique(business_id,registration),unique(id,business_id)
);
create table if not exists public.transport_drivers (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 full_name text not null, phone text, address text, licence_number text, licence_expiry date,
 aadhaar_last4 text, salary_monthly numeric(12,2), allowance_daily numeric(12,2),
 assigned_vehicle_id uuid, status text not null default 'active',
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 unique(id,business_id), foreign key(assigned_vehicle_id,business_id) references public.transport_fleet(id,business_id)
);
create table if not exists public.transport_bookings (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 booking_number text not null, customer_id uuid not null, origin text not null,destination text not null,
 material text, packages int, weight_ton numeric(12,3), rate_type text not null default 'fixed',
 agreed_freight numeric(14,2) not null default 0, advance_received numeric(14,2) not null default 0,
 eway_bill text, status text not null default 'enquiry' check(status in ('enquiry','quoted','confirmed','cancelled')),
 created_at timestamptz not null default now(), unique(business_id,booking_number),unique(id,business_id),
 foreign key(customer_id,business_id) references public.transport_parties(id,business_id)
);
create table if not exists public.transport_trips (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 trip_number text not null, booking_id uuid not null, vehicle_id uuid, driver_id uuid, hired_vendor_id uuid,
 lr_number text, status text not null default 'planned' check(status in ('planned','loaded','in_transit','delivered','pod_received','billed','paid','cancelled')),
 planned_km numeric(12,2),actual_km numeric(12,2),empty_km numeric(12,2),
 loaded_at timestamptz,delivered_at timestamptz,pod_url text,
 hired_cost numeric(14,2) not null default 0, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),unique(business_id,trip_number),unique(id,business_id),
 foreign key(booking_id,business_id) references public.transport_bookings(id,business_id),
 foreign key(vehicle_id,business_id) references public.transport_fleet(id,business_id),
 foreign key(driver_id,business_id) references public.transport_drivers(id,business_id),
 foreign key(hired_vendor_id,business_id) references public.transport_parties(id,business_id)
);
create table if not exists public.transport_financial_entries (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 trip_id uuid,vehicle_id uuid,party_id uuid,driver_id uuid,
 entry_date date not null default current_date,
 entry_type text not null check(entry_type in ('freight_invoice','receipt','vendor_bill','vendor_payment','driver_advance','driver_salary','diesel','toll','maintenance','tyre','repair','loading','detention','challan','office','emi','other')),
 amount numeric(14,2) not null check(amount>=0), quantity numeric(12,3), odometer_km numeric(12,2),
 reference text, notes text, approval_status text not null default 'pending' check(approval_status in ('pending','approved','rejected')),
 created_by uuid default auth.uid(), created_at timestamptz not null default now(),
 foreign key(trip_id,business_id) references public.transport_trips(id,business_id),
 foreign key(vehicle_id,business_id) references public.transport_fleet(id,business_id),
 foreign key(party_id,business_id) references public.transport_parties(id,business_id),
 foreign key(driver_id,business_id) references public.transport_drivers(id,business_id)
);
create table if not exists public.transport_compliance (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),
 vehicle_id uuid,driver_id uuid,document_type text not null,document_number text,issue_date date,expiry_date date,
 document_url text,renewal_cost numeric(14,2),created_at timestamptz not null default now(),
 foreign key(vehicle_id,business_id) references public.transport_fleet(id,business_id),
 foreign key(driver_id,business_id) references public.transport_drivers(id,business_id),
 check(vehicle_id is not null or driver_id is not null)
);
create table if not exists public.transport_audit_log (
 id bigint generated always as identity primary key,business_id uuid not null references public.businesses(id),
 actor_id uuid default auth.uid(),entity_type text not null,entity_id uuid,action text not null,
 before_data jsonb,after_data jsonb,created_at timestamptz not null default now()
);
create index if not exists idx_transport_trips_business_status on public.transport_trips(business_id,status);
create index if not exists idx_transport_entries_business_date on public.transport_financial_entries(business_id,entry_date);
create index if not exists idx_transport_compliance_expiry on public.transport_compliance(business_id,expiry_date);
-- RLS: all reads scoped to same business; writes only active owner/manager.
do $policies$
declare t text;
begin
 foreach t in array array['transport_parties','transport_fleet','transport_drivers','transport_bookings','transport_trips','transport_financial_entries','transport_compliance','transport_audit_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I',t||'_read',t);
  execute format('create policy %I on public.%I for select to authenticated using (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.business_id=business_id and p.status=''active''))',t||'_read',t);
  execute format('drop policy if exists %I on public.%I',t||'_insert',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.business_id=business_id and p.status=''active'' and p.role_code in (''owner'',''manager'')))',t||'_insert',t);
  execute format('drop policy if exists %I on public.%I',t||'_update',t);
  execute format('create policy %I on public.%I for update to authenticated using (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.business_id=business_id and p.status=''active'' and p.role_code in (''owner'',''manager''))) with check (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.business_id=business_id and p.status=''active'' and p.role_code in (''owner'',''manager'')))',t||'_update',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
end $policies$;
commit;
