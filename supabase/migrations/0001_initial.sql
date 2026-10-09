-- Banke Vihari Fertilizer ERP · initial tenant-safe schema
-- Apply with: supabase db push  (or paste into Supabase SQL Editor for a new project)
begin;

create extension if not exists pgcrypto;

create table if not exists public.roles (
  code text primary key check (code in ('owner','manager','cashier')),
  label text not null
);
insert into public.roles(code,label) values
  ('owner','Owner'),('manager','Manager'),('cashier','Cashier')
on conflict (code) do update set label=excluded.label;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  gstin text,
  invoice_prefix text not null default 'BVF',
  invoice_seq bigint not null default 0 check (invoice_seq >= 0),
  purchase_prefix text not null default 'PUR',
  purchase_seq bigint not null default 0 check (purchase_seq >= 0),
  adjustment_seq bigint not null default 0 check (adjustment_seq >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null,
  role_code text not null references public.roles(code) default 'cashier',
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_profiles_business_idx on public.user_profiles(business_id,role_code);

create table public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  language text not null default 'en' check (language in ('en','hi')),
  currency text not null default 'INR',
  time_zone text not null default 'Asia/Kolkata',
  gst_enabled boolean not null default true,
  default_gst_rate numeric(5,2) not null default 0 check (default_gst_rate between 0 and 100),
  opening_cash numeric(14,2) not null default 0,
  allow_negative_stock boolean not null default false,
  invoice_terms text,
  updated_at timestamptz not null default now()
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (business_id,name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text,
  category_id uuid references public.product_categories(id) on delete set null,
  brand text,
  manufacturer text,
  hsn_code text,
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  purchase_unit text not null default 'bag',
  sales_unit text not null default 'bag',
  pack_size text,
  opening_stock numeric(14,3) not null default 0 check (opening_stock >= 0),
  current_stock numeric(14,3) not null default 0 check (current_stock >= 0),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  avg_cost numeric(14,4) not null default 0 check (avg_cost >= 0),
  purchase_price numeric(14,4) not null default 0 check (purchase_price >= 0),
  selling_price numeric(14,4) not null default 0 check (selling_price >= 0),
  barcode text,
  batch_tracking boolean not null default false,
  expiry_tracking boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_sku_unique on public.products(business_id,lower(sku)) where sku is not null and btrim(sku) <> '';
create unique index products_barcode_unique on public.products(business_id,barcode) where barcode is not null and btrim(barcode) <> '';
create index products_search_idx on public.products(business_id,is_active,name);
create index products_stock_idx on public.products(business_id,current_stock,min_stock);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_code text,
  name text not null,
  mobile text,
  village text,
  address text,
  gstin text,
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  outstanding_balance numeric(14,2) not null default 0 check (outstanding_balance >= 0),
  last_purchase_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_search_idx on public.customers(business_id,name);
create index customers_mobile_idx on public.customers(business_id,mobile);
create index customers_outstanding_idx on public.customers(business_id,outstanding_balance desc);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_code text,
  name text not null,
  contact_number text,
  address text,
  gstin text,
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  outstanding_balance numeric(14,2) not null default 0 check (outstanding_balance >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suppliers_search_idx on public.suppliers(business_id,name);
create index suppliers_outstanding_idx on public.suppliers(business_id,outstanding_balance desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_number text not null,
  external_invoice_number text,
  idempotency_key text,
  customer_id uuid references public.customers(id) on delete restrict,
  historical_customer_name text,
  sold_at timestamptz not null default now(),
  due_date date,
  status text not null default 'posted' check (status in ('posted','reversed')),
  origin text not null default 'pos' check (origin in ('pos','import')),
  inventory_applied boolean not null default true,
  payment_status text not null default 'paid' check (payment_status in ('paid','partial','credit','historical_unverified','reversed')),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  gst_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  credit_created numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id,invoice_number),
  unique (business_id,idempotency_key),
  check (subtotal >= 0 and discount_total >= 0 and taxable_amount >= 0 and gst_amount >= 0 and total >= 0 and amount_paid >= 0 and credit_created >= 0 and balance_due >= 0)
);
create index sales_business_date_idx on public.sales(business_id,sold_at desc) where status='posted';
create index sales_customer_due_idx on public.sales(business_id,customer_id,balance_due) where status='posted';

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku_snapshot text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text,
  unit_price numeric(14,4) not null check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  taxable_amount numeric(14,2) not null default 0,
  gst_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  gross_profit numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create index sale_items_sale_idx on public.sale_items(business_id,sale_id);
create index sale_items_product_idx on public.sale_items(business_id,product_id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_number text not null,
  external_invoice_number text,
  idempotency_key text,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  historical_supplier_name text,
  purchased_at timestamptz not null default now(),
  due_date date,
  status text not null default 'posted' check (status in ('posted','reversed')),
  origin text not null default 'manual' check (origin in ('manual','import')),
  inventory_applied boolean not null default true,
  payment_status text not null default 'paid' check (payment_status in ('paid','partial','credit','historical_unverified','reversed')),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  gst_amount numeric(14,2) not null default 0,
  freight numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  attachment_path text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id,purchase_number),
  unique (business_id,idempotency_key)
);
create index purchases_business_date_idx on public.purchases(business_id,purchased_at desc) where status='posted';
create index purchases_supplier_idx on public.purchases(business_id,supplier_id,balance_due) where status='posted';

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text,
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  landed_unit_cost numeric(14,4) not null default 0,
  discount numeric(14,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  gst_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  batch_id uuid,
  batch_number text,
  manufactured_on date,
  expires_on date,
  created_at timestamptz not null default now()
);
create index purchase_items_purchase_idx on public.purchase_items(business_id,purchase_id);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  batch_number text not null,
  manufactured_on date,
  expires_on date,
  qty_on_hand numeric(14,3) not null default 0 check (qty_on_hand >= 0),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id,product_id,batch_number)
);
create index inventory_batches_expiry_idx on public.inventory_batches(business_id,expires_on) where qty_on_hand > 0;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  party_type text not null check (party_type in ('customer','supplier','walkin')),
  source_type text not null default 'manual' check (source_type in ('sale','customer_collection','purchase','supplier_payment','sale_refund','purchase_refund','manual')),
  customer_id uuid references public.customers(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  direction text not null check (direction in ('in','out')),
  method text not null check (method in ('cash','upi','bank','other')),
  amount numeric(14,2) not null check (amount > 0),
  reference text,
  idempotency_key text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check ((party_type='customer' and customer_id is not null and supplier_id is null and direction in ('in','out')) or
         (party_type='supplier' and supplier_id is not null and customer_id is null and direction in ('in','out')) or
         (party_type='walkin' and customer_id is null and supplier_id is null)),
  unique (business_id,idempotency_key)
);
create index payments_business_date_idx on public.payments(business_id,created_at desc);
create index payments_party_idx on public.payments(business_id,customer_id,supplier_id);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  check ((sale_id is not null and purchase_id is null) or (sale_id is null and purchase_id is not null))
);
create index payment_alloc_sale_idx on public.payment_allocations(business_id,sale_id);
create index payment_alloc_purchase_idx on public.payment_allocations(business_id,purchase_id);

create table public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  txn_at timestamptz not null default now(),
  entry_type text not null,
  reference_type text,
  reference_id uuid,
  description text not null,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (debit=0 or credit=0)
);
create index customer_ledger_customer_date_idx on public.customer_ledger(business_id,customer_id,txn_at,id);

create table public.supplier_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  txn_at timestamptz not null default now(),
  entry_type text not null,
  reference_type text,
  reference_id uuid,
  description text not null,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (debit=0 or credit=0)
);
create index supplier_ledger_supplier_date_idx on public.supplier_ledger(business_id,supplier_id,txn_at,id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  moved_at timestamptz not null default now(),
  movement_type text not null check (movement_type in ('opening','purchase','sale','sale_return','purchase_return','damage','adjustment','import_snapshot','reversal')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost numeric(14,4) not null default 0,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_movements_product_date_idx on public.inventory_movements(business_id,product_id,moved_at desc);
create index inventory_movements_reference_idx on public.inventory_movements(business_id,reference_type,reference_id);

create table public.sale_item_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null default 0
);

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  adjustment_number text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id,adjustment_number)
);
create table public.stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  adjustment_id uuid not null references public.stock_adjustments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost numeric(14,4) not null default 0,
  note text
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash','upi','bank','other')),
  reference text,
  spent_at date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses(business_id,spent_at desc);

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  closing_date date not null,
  expected_cash numeric(14,2) not null,
  counted_cash numeric(14,2) not null check (counted_cash >= 0),
  difference numeric(14,2) generated always as (counted_cash - expected_cash) stored,
  note text,
  counted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id,closing_date)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_business_date_idx on public.audit_logs(business_id,created_at desc);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  file_name text not null,
  kind text not null default 'legacy_workbook',
  status text not null default 'staged' check (status in ('staged','committed','committed_with_errors','failed')),
  row_count integer not null default 0,
  imported_count integer not null default 0,
  error_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  committed_at timestamptz
);
create table public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number integer not null,
  sheet_name text,
  source_key text,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('ready','imported','error','skipped')),
  error_message text,
  created_at timestamptz not null default now(),
  unique (job_id,row_number)
);
create index import_rows_job_idx on public.import_job_rows(business_id,job_id,row_number);
create unique index import_rows_source_key_unique on public.import_job_rows(business_id,source_key) where source_key is not null;

-- updated_at helper and audit trail. Audit is database-side; clients cannot erase the record.
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.business_settings for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger sales_updated_at before update on public.sales for each row execute function public.set_updated_at();
create trigger purchases_updated_at before update on public.purchases for each row execute function public.set_updated_at();
create trigger batches_updated_at before update on public.inventory_batches for each row execute function public.set_updated_at();

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row jsonb; v_old jsonb; v_new jsonb; v_business uuid; v_id uuid;
begin
  if tg_op='INSERT' then v_new=to_jsonb(new); v_business=(v_new->>'business_id')::uuid; v_id=(v_new->>'id')::uuid;
  elsif tg_op='UPDATE' then v_old=to_jsonb(old); v_new=to_jsonb(new); v_business=(v_new->>'business_id')::uuid; v_id=(v_new->>'id')::uuid;
  else v_old=to_jsonb(old); v_business=(v_old->>'business_id')::uuid; v_id=(v_old->>'id')::uuid; end if;
  insert into public.audit_logs(business_id,actor_id,action,entity_type,entity_id,old_data,new_data)
  values(v_business,auth.uid(),tg_table_name||'.'||lower(tg_op),tg_table_name,v_id,v_old,v_new);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger audit_product_changes after insert or update or delete on public.products for each row execute function public.audit_row_change();
create trigger audit_profile_changes after insert or update or delete on public.user_profiles for each row execute function public.audit_row_change();
create trigger audit_sale_changes after insert or update or delete on public.sales for each row execute function public.audit_row_change();
create trigger audit_purchase_changes after insert or update or delete on public.purchases for each row execute function public.audit_row_change();
create trigger audit_payment_changes after insert or update or delete on public.payments for each row execute function public.audit_row_change();
create trigger audit_expense_changes after insert or update or delete on public.expenses for each row execute function public.audit_row_change();
create trigger audit_cash_closing_changes after insert or update or delete on public.cash_closings for each row execute function public.audit_row_change();
create trigger audit_adjustment_changes after insert or update or delete on public.stock_adjustments for each row execute function public.audit_row_change();

-- A profile lookup is the tenant boundary; callers cannot supply a business_id to a privileged RPC.
create or replace function public.current_business_id() returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
  select business_id from public.user_profiles where id=auth.uid() and status='active' limit 1
$$;
create or replace function public.has_business_role(p_roles text[]) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.user_profiles where id=auth.uid() and status='active' and role_code=any(p_roles))
$$;

create or replace function public.bootstrap_business(p_business_name text, p_full_name text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_business uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.user_profiles where id=v_user) then raise exception 'This account already has a business profile'; end if;
  if nullif(btrim(p_business_name),'') is null or nullif(btrim(p_full_name),'') is null then raise exception 'Business name and owner name are required'; end if;
  insert into public.businesses(name) values(btrim(p_business_name)) returning id into v_business;
  insert into public.user_profiles(id,business_id,full_name,role_code,status) values(v_user,v_business,btrim(p_full_name),'owner','active');
  insert into public.business_settings(business_id) values(v_business);
  return v_business;
end $$;

create or replace function public.create_category(p_name text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_row public.product_categories;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'Category name is required'; end if;
  insert into public.product_categories(business_id,name) values(v_business,btrim(p_name)) on conflict(business_id,name) do update set name=excluded.name returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.get_pos_settings() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_gst boolean;
begin
  if v_business is null or not public.has_business_role(array['owner','manager','cashier']) then raise exception 'Business access required'; end if;
  select gst_enabled into v_gst from public.business_settings where business_id=v_business;
  return jsonb_build_object('gst_enabled',coalesce(v_gst,true));
end $$;

-- Secure, role-checked product and party upserts.
create or replace function public.save_product(p_product jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_id uuid; v_name text; v_sku text; v_open numeric; v_cost numeric; v_sale numeric; v_cat uuid; v_row public.products;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  v_id=nullif(p_product->>'id','')::uuid; v_name=nullif(btrim(p_product->>'name'),''); v_sku=nullif(btrim(p_product->>'sku'),'');
  if v_name is null then raise exception 'Product name is required'; end if;
  v_cost=coalesce(nullif(p_product->>'purchase_price','')::numeric,0); v_sale=coalesce(nullif(p_product->>'selling_price','')::numeric,0);
  v_cat=nullif(p_product->>'category_id','')::uuid;
  if v_cat is not null and not exists(select 1 from public.product_categories where id=v_cat and business_id=v_business) then raise exception 'Category is outside this business'; end if;
  if v_cost<0 or v_sale<0 then raise exception 'Product prices cannot be negative'; end if;
  if v_id is null then
    v_open=coalesce(nullif(p_product->>'opening_stock','')::numeric,0);
    if v_open<0 then raise exception 'Opening stock cannot be negative'; end if;
    insert into public.products(business_id,name,sku,category_id,brand,manufacturer,hsn_code,gst_rate,purchase_unit,sales_unit,pack_size,opening_stock,current_stock,min_stock,avg_cost,purchase_price,selling_price,barcode,batch_tracking,expiry_tracking,is_active)
    values(v_business,v_name,v_sku,v_cat,nullif(p_product->>'brand',''),nullif(p_product->>'manufacturer',''),nullif(p_product->>'hsn_code',''),coalesce(nullif(p_product->>'gst_rate','')::numeric,0),coalesce(nullif(p_product->>'purchase_unit',''), 'bag'),coalesce(nullif(p_product->>'sales_unit',''), 'bag'),nullif(p_product->>'pack_size',''),v_open,v_open,coalesce(nullif(p_product->>'min_stock','')::numeric,0),v_cost,v_cost,v_sale,nullif(p_product->>'barcode',''),coalesce((p_product->>'batch_tracking')::boolean,false),coalesce((p_product->>'expiry_tracking')::boolean,false),coalesce((p_product->>'is_active')::boolean,true)) returning * into v_row;
    if v_open>0 then
      insert into public.inventory_batches(business_id,product_id,batch_number,qty_on_hand,unit_cost) values(v_business,v_row.id,'OPENING',v_open,v_cost) on conflict(business_id,product_id,batch_number) do update set qty_on_hand=excluded.qty_on_hand,unit_cost=excluded.unit_cost;
      insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by)
      select v_business,v_row.id,b.id,'opening',v_open,v_cost,'product',v_row.id,'Opening stock',auth.uid() from public.inventory_batches b where b.business_id=v_business and b.product_id=v_row.id and b.batch_number='OPENING';
    end if;
  else
    select * into v_row from public.products where id=v_id and business_id=v_business for update;
    if not found then raise exception 'Product not found in this business'; end if;
    update public.products set name=v_name,sku=v_sku,category_id=v_cat,brand=nullif(p_product->>'brand',''),manufacturer=nullif(p_product->>'manufacturer',''),hsn_code=nullif(p_product->>'hsn_code',''),gst_rate=coalesce(nullif(p_product->>'gst_rate','')::numeric,gst_rate),purchase_unit=coalesce(nullif(p_product->>'purchase_unit',''),purchase_unit),sales_unit=coalesce(nullif(p_product->>'sales_unit',''),sales_unit),pack_size=nullif(p_product->>'pack_size',''),min_stock=coalesce(nullif(p_product->>'min_stock','')::numeric,min_stock),purchase_price=v_cost,selling_price=v_sale,barcode=nullif(p_product->>'barcode',''),batch_tracking=coalesce((p_product->>'batch_tracking')::boolean,batch_tracking),expiry_tracking=coalesce((p_product->>'expiry_tracking')::boolean,expiry_tracking),is_active=coalesce((p_product->>'is_active')::boolean,is_active)
    where id=v_id and business_id=v_business returning * into v_row;
  end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.save_customer(p_customer jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_id uuid; v_name text; v_open numeric; v_row public.customers;
begin
  if v_business is null or not public.has_business_role(array['owner','manager','cashier']) then raise exception 'Business access required'; end if;
  v_id=nullif(p_customer->>'id','')::uuid; v_name=nullif(btrim(p_customer->>'name'),'');
  if v_name is null then raise exception 'Customer name is required'; end if;
  if v_id is null then
    v_open=coalesce(nullif(p_customer->>'opening_balance','')::numeric,0);
    if v_open<0 then raise exception 'Opening balance cannot be negative'; end if;
    if not public.has_business_role(array['owner','manager']) and (v_open>0 or coalesce(nullif(p_customer->>'credit_limit','')::numeric,0)>0) then raise exception 'Only an owner or manager can set an opening balance or credit limit'; end if;
    insert into public.customers(business_id,customer_code,name,mobile,village,address,gstin,opening_balance,credit_limit,outstanding_balance,is_active)
    values(v_business,nullif(p_customer->>'customer_code',''),v_name,nullif(p_customer->>'mobile',''),nullif(p_customer->>'village',''),nullif(p_customer->>'address',''),nullif(p_customer->>'gstin',''),v_open,coalesce(nullif(p_customer->>'credit_limit','')::numeric,0),v_open,coalesce((p_customer->>'is_active')::boolean,true)) returning * into v_row;
    if v_open>0 then insert into public.customer_ledger(business_id,customer_id,entry_type,description,debit,created_by) values(v_business,v_row.id,'opening_balance','Opening balance',v_open,auth.uid()); end if;
  else
    update public.customers set name=v_name,mobile=nullif(p_customer->>'mobile',''),village=nullif(p_customer->>'village',''),address=nullif(p_customer->>'address',''),gstin=nullif(p_customer->>'gstin',''),credit_limit=case when public.has_business_role(array['owner','manager']) then coalesce(nullif(p_customer->>'credit_limit','')::numeric,credit_limit) else credit_limit end,is_active=coalesce((p_customer->>'is_active')::boolean,is_active)
    where id=v_id and business_id=v_business returning * into v_row;
    if not found then raise exception 'Customer not found in this business'; end if;
  end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.save_supplier(p_supplier jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_id uuid; v_name text; v_open numeric; v_row public.suppliers;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  v_id=nullif(p_supplier->>'id','')::uuid; v_name=nullif(btrim(p_supplier->>'name'),'');
  if v_name is null then raise exception 'Supplier name is required'; end if;
  if v_id is null then
    v_open=coalesce(nullif(p_supplier->>'opening_balance','')::numeric,0);
    if v_open<0 then raise exception 'Opening balance cannot be negative'; end if;
    insert into public.suppliers(business_id,supplier_code,name,contact_number,address,gstin,opening_balance,outstanding_balance,is_active)
    values(v_business,nullif(p_supplier->>'supplier_code',''),v_name,nullif(p_supplier->>'contact_number',''),nullif(p_supplier->>'address',''),nullif(p_supplier->>'gstin',''),v_open,v_open,coalesce((p_supplier->>'is_active')::boolean,true)) returning * into v_row;
    if v_open>0 then insert into public.supplier_ledger(business_id,supplier_id,entry_type,description,credit,created_by) values(v_business,v_row.id,'opening_balance','Opening balance',v_open,auth.uid()); end if;
  else
    update public.suppliers set name=v_name,contact_number=nullif(p_supplier->>'contact_number',''),address=nullif(p_supplier->>'address',''),gstin=nullif(p_supplier->>'gstin',''),is_active=coalesce((p_supplier->>'is_active')::boolean,is_active)
    where id=v_id and business_id=v_business returning * into v_row;
    if not found then raise exception 'Supplier not found in this business'; end if;
  end if;
  return to_jsonb(v_row);
end $$;

-- Atomic checkout. Locks all products in a stable order, checks stock, creates ledger/payment rows,
-- allocates earliest-expiry batches, then commits as one PostgreSQL transaction.
create or replace function public.create_sale(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_business uuid:=public.current_business_id(); v_user uuid:=auth.uid(); v_role text; v_id uuid:=gen_random_uuid(); v_invoice text; v_seq bigint;
  v_customer uuid:=nullif(p_payload->>'customer_id','')::uuid; v_due_date date:=nullif(p_payload->>'due_date','')::date; v_key text:=nullif(p_payload->>'idempotency_key','');
  v_item jsonb; v_product public.products; v_product_id uuid; v_qty numeric; v_price numeric; v_discount numeric; v_tax numeric; v_base numeric; v_line_total numeric; v_cost numeric; v_profit numeric;
  v_subtotal numeric:=0; v_discount_total numeric:=0; v_taxable numeric:=0; v_gst numeric:=0; v_total numeric:=0; v_paid numeric:=0; v_due numeric:=0;
  v_method text; v_amount numeric; v_payment_id uuid; v_item_id uuid; v_batch public.inventory_batches; v_remaining numeric; v_take numeric; v_gst_rate numeric; v_gst_enabled boolean;
  v_existing public.sales;
begin
  if v_business is null or v_user is null then raise exception 'Sign in to the business workspace'; end if;
  if not public.has_business_role(array['owner','manager','cashier']) then raise exception 'You do not have permission to create a sale'; end if;
  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items')=0 then raise exception 'Add at least one product'; end if;
  if v_key is not null then select * into v_existing from public.sales where business_id=v_business and idempotency_key=v_key; if found then return jsonb_build_object('sale_id',v_existing.id,'invoice_number',v_existing.invoice_number,'sold_at',v_existing.sold_at,'subtotal',v_existing.subtotal,'discount_total',v_existing.discount_total,'gst_amount',v_existing.gst_amount,'total',v_existing.total,'amount_paid',v_existing.amount_paid,'balance_due',v_existing.balance_due,'duplicate',true); end if; end if;
  select role_code into v_role from public.user_profiles where id=v_user and business_id=v_business and status='active';
  select gst_enabled into v_gst_enabled from public.business_settings where business_id=v_business;
  v_gst_enabled=coalesce(v_gst_enabled,true);
  if v_customer is not null and not exists(select 1 from public.customers where id=v_customer and business_id=v_business and is_active) then raise exception 'Selected customer is inactive or outside this business'; end if;
  -- Stable row lock order prevents two tills from deadlocking on the same products.
  for v_product_id in select distinct (x->>'product_id')::uuid from jsonb_array_elements(p_payload->'items') x order by 1 loop
    perform 1 from public.products where id=v_product_id and business_id=v_business for update;
    if not found then raise exception 'A selected product was not found'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_product_id=(v_item->>'product_id')::uuid; v_qty=round(coalesce(nullif(v_item->>'quantity','')::numeric,0),3); v_price=round(coalesce(nullif(v_item->>'unit_price','')::numeric,0),4); v_discount=round(coalesce(nullif(v_item->>'discount','')::numeric,0),2);
    select * into v_product from public.products where id=v_product_id and business_id=v_business and is_active;
    if not found then raise exception 'Product is inactive'; end if;
    if v_qty<=0 or v_price<0 or v_discount<0 or v_discount>v_qty*v_price then raise exception 'Invalid quantity, rate or discount for %',v_product.name; end if;
    if v_role='cashier' and (abs(v_price-v_product.selling_price)>0.005 or v_discount>0) then raise exception 'Cashier cannot override the price or discount for %',v_product.name; end if;
    if v_product.current_stock<v_qty then raise exception 'Insufficient stock for %. Available: % %',v_product.name,v_product.current_stock,v_product.sales_unit; end if;
    v_gst_rate=case when v_gst_enabled then v_product.gst_rate else 0 end;
    v_base=round(v_qty*v_price-v_discount,2); v_tax=round(v_base*v_gst_rate/100,2); v_line_total=v_base+v_tax;
    v_subtotal=v_subtotal+round(v_qty*v_price,2); v_discount_total=v_discount_total+v_discount; v_taxable=v_taxable+v_base; v_gst=v_gst+v_tax;
  end loop;
  v_total=round(v_taxable+v_gst,2);
  if jsonb_typeof(coalesce(p_payload->'payments','[]'::jsonb))<>'array' then raise exception 'Payments must be a list'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'payments','[]'::jsonb)) loop
    v_amount=round(coalesce(nullif(v_item->>'amount','')::numeric,0),2); v_method=coalesce(v_item->>'method','cash');
    if v_amount<0 or v_method not in ('cash','upi','bank','other') then raise exception 'Invalid payment method or amount'; end if;
    v_paid=v_paid+v_amount;
  end loop;
  v_paid=round(v_paid,2);
  if v_paid>v_total then raise exception 'Payments exceed invoice total'; end if;
  v_due=round(v_total-v_paid,2);
  if v_due>0 and v_customer is null then raise exception 'A customer is required for a credit or partially paid sale'; end if;
  if v_customer is not null and v_due>0 then
    perform 1 from public.customers where id=v_customer and business_id=v_business for update;
    if exists(select 1 from public.customers c where c.id=v_customer and c.business_id=v_business and c.credit_limit>0 and c.outstanding_balance+v_due>c.credit_limit) then raise exception 'This sale exceeds the customer credit limit'; end if;
  end if;
  update public.businesses set invoice_seq=invoice_seq+1 where id=v_business returning invoice_seq,invoice_prefix into v_seq,v_invoice;
  v_invoice=v_invoice||'-'||to_char(now(),'YYYY')||'-'||lpad(v_seq::text,6,'0');
  insert into public.sales(id,business_id,invoice_number,idempotency_key,customer_id,sold_at,due_date,status,origin,inventory_applied,payment_status,subtotal,discount_total,taxable_amount,gst_amount,total,amount_paid,credit_created,balance_due,created_by)
  values(v_id,v_business,v_invoice,v_key,v_customer,now(),v_due_date,'posted','pos',true,case when v_due=0 then 'paid' when v_paid=0 then 'credit' else 'partial' end,round(v_subtotal,2),round(v_discount_total,2),round(v_taxable,2),round(v_gst,2),v_total,v_paid,v_due,v_due,v_user);
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_product_id=(v_item->>'product_id')::uuid; v_qty=round(coalesce(nullif(v_item->>'quantity','')::numeric,0),3); v_price=round(coalesce(nullif(v_item->>'unit_price','')::numeric,0),4); v_discount=round(coalesce(nullif(v_item->>'discount','')::numeric,0),2);
    select * into v_product from public.products where id=v_product_id and business_id=v_business;
    v_gst_rate=case when v_gst_enabled then v_product.gst_rate else 0 end;
    v_base=round(v_qty*v_price-v_discount,2); v_tax=round(v_base*v_gst_rate/100,2); v_line_total=v_base+v_tax; v_cost=coalesce(v_product.avg_cost,v_product.purchase_price,0); v_profit=round(v_base-v_qty*v_cost,2);
    insert into public.sale_items(business_id,sale_id,product_id,product_name,sku_snapshot,quantity,unit,unit_price,discount,gst_rate,taxable_amount,gst_amount,line_total,unit_cost,gross_profit)
    values(v_business,v_id,v_product_id,v_product.name,v_product.sku,v_qty,v_product.sales_unit,v_price,v_discount,v_gst_rate,v_base,v_tax,v_line_total,v_cost,v_profit) returning id into v_item_id;
    update public.products set current_stock=current_stock-v_qty where id=v_product_id and business_id=v_business;
    v_remaining=v_qty;
    for v_batch in select * from public.inventory_batches where business_id=v_business and product_id=v_product_id and qty_on_hand>0 order by expires_on nulls last,created_at,id for update loop
      exit when v_remaining<=0;
      v_take=least(v_remaining,v_batch.qty_on_hand);
      update public.inventory_batches set qty_on_hand=qty_on_hand-v_take where id=v_batch.id;
      insert into public.sale_item_batches(business_id,sale_item_id,batch_id,quantity,unit_cost) values(v_business,v_item_id,v_batch.id,v_take,v_batch.unit_cost);
      insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_product_id,v_batch.id,'sale',-v_take,v_batch.unit_cost,'sale',v_id,'POS sale',v_user);
      v_remaining=v_remaining-v_take;
    end loop;
    if v_remaining>0 then
      if v_product.batch_tracking then raise exception 'Batch stock does not reconcile for %',v_product.name; end if;
      insert into public.inventory_movements(business_id,product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_product_id,'sale',-v_remaining,v_cost,'sale',v_id,'Unbatched stock',v_user);
    end if;
  end loop;
  if v_customer is not null then
    insert into public.customer_ledger(business_id,customer_id,entry_type,reference_type,reference_id,description,debit,created_by) values(v_business,v_customer,'sale','sale',v_id,'Sale invoice '||v_invoice,v_total,v_user);
    update public.customers set outstanding_balance=outstanding_balance+v_due,last_purchase_at=now() where id=v_customer and business_id=v_business;
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'payments','[]'::jsonb)) loop
    v_amount=round(coalesce(nullif(v_item->>'amount','')::numeric,0),2); if v_amount<=0 then continue; end if;
    v_method=coalesce(v_item->>'method','cash');
    insert into public.payments(business_id,party_type,source_type,customer_id,direction,method,amount,reference,created_by,note)
    values(v_business,case when v_customer is null then 'walkin' else 'customer' end,'sale',v_customer,'in',v_method,v_amount,nullif(v_item->>'reference',''),v_user,'Sale invoice '||v_invoice) returning id into v_payment_id;
    insert into public.payment_allocations(business_id,payment_id,sale_id,amount) values(v_business,v_payment_id,v_id,v_amount);
    if v_customer is not null then insert into public.customer_ledger(business_id,customer_id,entry_type,reference_type,reference_id,description,credit,created_by) values(v_business,v_customer,'payment','payment',v_payment_id,'Payment received · '||upper(v_method),v_amount,v_user); end if;
  end loop;
  return jsonb_build_object('sale_id',v_id,'invoice_number',v_invoice,'sold_at',now(),'subtotal',round(v_subtotal,2),'discount_total',round(v_discount_total,2),'gst_amount',round(v_gst,2),'total',v_total,'amount_paid',v_paid,'balance_due',v_due,'duplicate',false);
end $$;

create or replace function public.create_purchase(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_business uuid:=public.current_business_id(); v_user uuid:=auth.uid(); v_id uuid:=gen_random_uuid(); v_number text; v_seq bigint;
  v_supplier uuid:=nullif(p_payload->>'supplier_id','')::uuid; v_item jsonb; v_product public.products; v_pid uuid; v_qty numeric; v_rate numeric; v_disc numeric; v_base numeric; v_tax numeric; v_total numeric; v_gst_rate numeric; v_gst_enabled boolean;
  v_sub numeric:=0; v_disc_total numeric:=0; v_taxable numeric:=0; v_gst numeric:=0; v_freight numeric:=0; v_paid numeric:=0; v_due numeric; v_method text; v_amt numeric; v_pay uuid;
  v_weight numeric; v_share numeric; v_landed numeric; v_batch_no text; v_batch_id uuid; v_batch public.inventory_batches; v_existing public.purchases;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  if v_supplier is null or not exists(select 1 from public.suppliers where id=v_supplier and business_id=v_business and is_active) then raise exception 'Choose an active supplier'; end if;
  select gst_enabled into v_gst_enabled from public.business_settings where business_id=v_business; v_gst_enabled=coalesce(v_gst_enabled,true);
  if jsonb_typeof(p_payload->'items')<>'array' or jsonb_array_length(p_payload->'items')=0 then raise exception 'Add at least one product'; end if;
  if nullif(p_payload->>'idempotency_key','') is not null then select * into v_existing from public.purchases where business_id=v_business and idempotency_key=p_payload->>'idempotency_key'; if found then return jsonb_build_object('purchase_id',v_existing.id,'purchase_number',v_existing.purchase_number,'total',v_existing.total,'amount_paid',v_existing.amount_paid,'balance_due',v_existing.balance_due,'duplicate',true); end if; end if;
  for v_pid in select distinct (x->>'product_id')::uuid from jsonb_array_elements(p_payload->'items') x order by 1 loop perform 1 from public.products where id=v_pid and business_id=v_business for update; if not found then raise exception 'A selected product was not found'; end if; end loop;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_pid=(v_item->>'product_id')::uuid; v_qty=round(coalesce(nullif(v_item->>'quantity','')::numeric,0),3); v_rate=round(coalesce(nullif(v_item->>'unit_cost','')::numeric,0),4); v_disc=round(coalesce(nullif(v_item->>'discount','')::numeric,0),2);
    select * into v_product from public.products where id=v_pid and business_id=v_business and is_active;
    if not found or v_qty<=0 or v_rate<0 or v_disc<0 or v_disc>v_qty*v_rate then raise exception 'Invalid purchase line'; end if;
    v_gst_rate=case when v_gst_enabled then v_product.gst_rate else 0 end;
    v_base=round(v_qty*v_rate-v_disc,2); v_tax=round(v_base*v_gst_rate/100,2); v_sub=v_sub+round(v_qty*v_rate,2); v_disc_total=v_disc_total+v_disc; v_taxable=v_taxable+v_base; v_gst=v_gst+v_tax;
  end loop;
  v_freight=round(coalesce(nullif(p_payload->>'freight','')::numeric,0),2); if v_freight<0 then raise exception 'Freight cannot be negative'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'payments','[]'::jsonb)) loop v_amt=round(coalesce(nullif(v_item->>'amount','')::numeric,0),2); v_method=coalesce(v_item->>'method','cash'); if v_amt<0 or v_method not in ('cash','upi','bank','other') then raise exception 'Invalid supplier payment'; end if; v_paid=v_paid+v_amt; end loop;
  v_total=round(v_taxable+v_gst+v_freight,2); v_paid=round(v_paid,2); if v_paid>v_total then raise exception 'Payments exceed purchase total'; end if; v_due=round(v_total-v_paid,2);
  perform 1 from public.suppliers where id=v_supplier and business_id=v_business for update;
  update public.businesses set purchase_seq=purchase_seq+1 where id=v_business returning purchase_seq,purchase_prefix into v_seq,v_number;
  v_number=v_number||'-'||to_char(now(),'YYYY')||'-'||lpad(v_seq::text,6,'0');
  insert into public.purchases(id,business_id,purchase_number,external_invoice_number,idempotency_key,supplier_id,purchased_at,due_date,status,origin,inventory_applied,payment_status,subtotal,discount_total,taxable_amount,gst_amount,freight,total,amount_paid,balance_due,created_by,note)
  values(v_id,v_business,v_number,nullif(p_payload->>'supplier_invoice_number',''),nullif(p_payload->>'idempotency_key',''),v_supplier,coalesce(nullif(p_payload->>'purchased_at','')::timestamptz,now()),nullif(p_payload->>'due_date','')::date,'posted','manual',true,case when v_due=0 then 'paid' when v_paid=0 then 'credit' else 'partial' end,round(v_sub,2),round(v_disc_total,2),round(v_taxable,2),round(v_gst,2),v_freight,v_total,v_paid,v_due,v_user,nullif(p_payload->>'note',''));
  v_weight=greatest(v_taxable,0.01);
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_pid=(v_item->>'product_id')::uuid; v_qty=round(coalesce(nullif(v_item->>'quantity','')::numeric,0),3); v_rate=round(coalesce(nullif(v_item->>'unit_cost','')::numeric,0),4); v_disc=round(coalesce(nullif(v_item->>'discount','')::numeric,0),2); select * into v_product from public.products where id=v_pid and business_id=v_business;
    v_gst_rate=case when v_gst_enabled then v_product.gst_rate else 0 end;
    v_base=round(v_qty*v_rate-v_disc,2); v_tax=round(v_base*v_gst_rate/100,2); v_share=round(v_freight*(v_base/v_weight),2); v_landed=round((v_base+v_share)/v_qty,4); v_total=v_base+v_tax;
    v_batch_no=coalesce(nullif(btrim(v_item->>'batch_number'),''),'LOT-'||upper(substr(replace(v_id::text,'-',''),1,8))||'-'||upper(substr(replace(v_pid::text,'-',''),1,4)));
    insert into public.inventory_batches(business_id,product_id,batch_number,manufactured_on,expires_on,qty_on_hand,unit_cost)
    values(v_business,v_pid,v_batch_no,nullif(v_item->>'manufactured_on','')::date,nullif(v_item->>'expires_on','')::date,v_qty,v_landed)
    on conflict(business_id,product_id,batch_number) do update set qty_on_hand=inventory_batches.qty_on_hand+excluded.qty_on_hand,unit_cost=case when inventory_batches.qty_on_hand+excluded.qty_on_hand=0 then excluded.unit_cost else (inventory_batches.qty_on_hand*inventory_batches.unit_cost+excluded.qty_on_hand*excluded.unit_cost)/(inventory_batches.qty_on_hand+excluded.qty_on_hand) end
    returning id into v_batch_id;
    update public.products set current_stock=current_stock+v_qty,avg_cost=case when current_stock+v_qty=0 then v_landed else (current_stock*avg_cost+v_qty*v_landed)/(current_stock+v_qty) end,purchase_price=v_rate where id=v_pid and business_id=v_business;
    insert into public.purchase_items(business_id,purchase_id,product_id,product_name,quantity,unit,unit_cost,landed_unit_cost,discount,gst_rate,taxable_amount,gst_amount,line_total,batch_id,batch_number,manufactured_on,expires_on)
    values(v_business,v_id,v_pid,v_product.name,v_qty,v_product.purchase_unit,v_rate,v_landed,v_disc,v_gst_rate,v_base,v_tax,v_total,v_batch_id,v_batch_no,nullif(v_item->>'manufactured_on','')::date,nullif(v_item->>'expires_on','')::date);
    insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_pid,v_batch_id,'purchase',v_qty,v_landed,'purchase',v_id,'Purchase inward',v_user);
  end loop;
  insert into public.supplier_ledger(business_id,supplier_id,entry_type,reference_type,reference_id,description,credit,created_by) values(v_business,v_supplier,'purchase','purchase',v_id,'Purchase '||v_number,v_total,v_user);
  update public.suppliers set outstanding_balance=outstanding_balance+v_due where id=v_supplier and business_id=v_business;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'payments','[]'::jsonb)) loop
    v_amt=round(coalesce(nullif(v_item->>'amount','')::numeric,0),2); if v_amt<=0 then continue; end if; v_method=coalesce(v_item->>'method','cash');
    insert into public.payments(business_id,party_type,source_type,supplier_id,direction,method,amount,reference,created_by,note) values(v_business,'supplier','purchase',v_supplier,'out',v_method,v_amt,nullif(v_item->>'reference',''),v_user,'Purchase '||v_number) returning id into v_pay;
    insert into public.payment_allocations(business_id,payment_id,purchase_id,amount) values(v_business,v_pay,v_id,v_amt);
    insert into public.supplier_ledger(business_id,supplier_id,entry_type,reference_type,reference_id,description,debit,created_by) values(v_business,v_supplier,'payment','payment',v_pay,'Payment made · '||upper(v_method),v_amt,v_user);
  end loop;
  return jsonb_build_object('purchase_id',v_id,'purchase_number',v_number,'total',round(v_taxable+v_gst+v_freight,2),'amount_paid',v_paid,'balance_due',v_due,'duplicate',false);
end $$;

create or replace function public.receive_customer_payment(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_business uuid:=public.current_business_id(); v_user uuid:=auth.uid(); v_customer uuid:=nullif(p_payload->>'customer_id','')::uuid; v_amount numeric:=round(coalesce(nullif(p_payload->>'amount','')::numeric,0),2); v_method text:=coalesce(p_payload->>'method','cash');
  v_id uuid; v_key text:=nullif(p_payload->>'idempotency_key',''); v_remaining numeric; v_sale record; v_take numeric; v_alloc jsonb; v_total_alloc numeric:=0;
begin
  if v_business is null or not public.has_business_role(array['owner','manager','cashier']) then raise exception 'Business access required'; end if;
  if v_customer is null or v_amount<=0 or v_method not in ('cash','upi','bank','other') then raise exception 'Choose a customer, valid amount and payment method'; end if;
  if v_key is not null and exists(select 1 from public.payments where business_id=v_business and idempotency_key=v_key) then return jsonb_build_object('duplicate',true); end if;
  perform 1 from public.customers where id=v_customer and business_id=v_business for update;
  if not found then raise exception 'Customer not found'; end if;
  if (select outstanding_balance from public.customers where id=v_customer and business_id=v_business)<v_amount then raise exception 'Payment exceeds current outstanding balance'; end if;
  insert into public.payments(business_id,party_type,source_type,customer_id,direction,method,amount,reference,idempotency_key,note,created_by)
  values(v_business,'customer','customer_collection',v_customer,'in',v_method,v_amount,nullif(p_payload->>'reference',''),v_key,nullif(p_payload->>'note',''),v_user) returning id into v_id;
  if jsonb_typeof(coalesce(p_payload->'allocations','[]'::jsonb))='array' and jsonb_array_length(coalesce(p_payload->'allocations','[]'::jsonb))>0 then
    for v_alloc in select value from jsonb_array_elements(p_payload->'allocations') loop
      v_take=round(coalesce(nullif(v_alloc->>'amount','')::numeric,0),2); if v_take<=0 then continue; end if;
      if v_total_alloc+v_take>v_amount then raise exception 'Invoice allocations cannot exceed payment amount'; end if;
      update public.sales set amount_paid=amount_paid+v_take,balance_due=balance_due-v_take,payment_status=case when balance_due-v_take<=0 then 'paid' else 'partial' end
      where id=(v_alloc->>'sale_id')::uuid and business_id=v_business and customer_id=v_customer and status='posted' and balance_due>=v_take;
      if not found then raise exception 'A selected invoice is invalid or has insufficient balance'; end if;
      insert into public.payment_allocations(business_id,payment_id,sale_id,amount) values(v_business,v_id,(v_alloc->>'sale_id')::uuid,v_take);
      v_total_alloc=v_total_alloc+v_take;
    end loop;
  end if;
  -- Apply the remainder FIFO to other posted invoices. Any remainder after that settles an opening/legacy balance.
  v_remaining=v_amount-v_total_alloc;
  for v_sale in select * from public.sales where business_id=v_business and customer_id=v_customer and status='posted' and balance_due>0 order by sold_at,id for update loop
    exit when v_remaining<=0;
    v_take=least(v_remaining,v_sale.balance_due);
    update public.sales set amount_paid=amount_paid+v_take,balance_due=balance_due-v_take,payment_status=case when balance_due-v_take<=0 then 'paid' else 'partial' end where id=v_sale.id;
    insert into public.payment_allocations(business_id,payment_id,sale_id,amount) values(v_business,v_id,v_sale.id,v_take);
    v_remaining=v_remaining-v_take;
  end loop;
  update public.customers set outstanding_balance=outstanding_balance-v_amount where id=v_customer and business_id=v_business;
  insert into public.customer_ledger(business_id,customer_id,entry_type,reference_type,reference_id,description,credit,created_by) values(v_business,v_customer,'payment','payment',v_id,'Payment received · '||upper(v_method),v_amount,v_user);
  return jsonb_build_object('payment_id',v_id,'amount',v_amount,'customer_id',v_customer,'unallocated_amount',greatest(0,v_remaining),'duplicate',false);
end $$;

create or replace function public.receive_supplier_payment(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_user uuid:=auth.uid(); v_supplier uuid:=nullif(p_payload->>'supplier_id','')::uuid; v_amount numeric:=round(coalesce(nullif(p_payload->>'amount','')::numeric,0),2); v_method text:=coalesce(p_payload->>'method','cash'); v_id uuid; v_key text:=nullif(p_payload->>'idempotency_key',''); v_remaining numeric; v_purchase record; v_take numeric; v_alloc jsonb; v_allocated numeric:=0;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  if v_supplier is null or v_amount<=0 or v_method not in ('cash','upi','bank','other') then raise exception 'Choose a supplier, valid amount and payment method'; end if;
  if v_key is not null and exists(select 1 from public.payments where business_id=v_business and idempotency_key=v_key) then return jsonb_build_object('duplicate',true); end if;
  perform 1 from public.suppliers where id=v_supplier and business_id=v_business for update;
  if not found then raise exception 'Supplier not found'; end if;
  if (select outstanding_balance from public.suppliers where id=v_supplier and business_id=v_business)<v_amount then raise exception 'Payment exceeds supplier outstanding'; end if;
  insert into public.payments(business_id,party_type,source_type,supplier_id,direction,method,amount,reference,idempotency_key,note,created_by) values(v_business,'supplier','supplier_payment',v_supplier,'out',v_method,v_amount,nullif(p_payload->>'reference',''),v_key,nullif(p_payload->>'note',''),v_user) returning id into v_id;
  if jsonb_typeof(coalesce(p_payload->'allocations','[]'::jsonb))='array' and jsonb_array_length(coalesce(p_payload->'allocations','[]'::jsonb))>0 then
    for v_alloc in select value from jsonb_array_elements(p_payload->'allocations') loop
      v_take=round(coalesce(nullif(v_alloc->>'amount','')::numeric,0),2); if v_take<=0 then continue; end if;
      if v_allocated+v_take>v_amount then raise exception 'Invoice allocations cannot exceed payment amount'; end if;
      update public.purchases set amount_paid=amount_paid+v_take,balance_due=balance_due-v_take,payment_status=case when balance_due-v_take<=0 then 'paid' else 'partial' end where id=(v_alloc->>'purchase_id')::uuid and business_id=v_business and supplier_id=v_supplier and status='posted' and balance_due>=v_take;
      if not found then raise exception 'A selected purchase invoice is invalid or has insufficient balance'; end if;
      insert into public.payment_allocations(business_id,payment_id,purchase_id,amount) values(v_business,v_id,(v_alloc->>'purchase_id')::uuid,v_take); v_allocated=v_allocated+v_take;
    end loop;
  end if;
  -- Apply any unselected remainder to the oldest invoices; a final remainder can settle an opening balance.
  v_remaining=v_amount-v_allocated;
  for v_purchase in select * from public.purchases where business_id=v_business and supplier_id=v_supplier and status='posted' and balance_due>0 order by purchased_at,id for update loop
    exit when v_remaining<=0; v_take=least(v_remaining,v_purchase.balance_due);
    update public.purchases set amount_paid=amount_paid+v_take,balance_due=balance_due-v_take,payment_status=case when balance_due-v_take<=0 then 'paid' else 'partial' end where id=v_purchase.id;
    insert into public.payment_allocations(business_id,payment_id,purchase_id,amount) values(v_business,v_id,v_purchase.id,v_take); v_remaining=v_remaining-v_take;
  end loop;
  update public.suppliers set outstanding_balance=outstanding_balance-v_amount where id=v_supplier and business_id=v_business;
  insert into public.supplier_ledger(business_id,supplier_id,entry_type,reference_type,reference_id,description,debit,created_by) values(v_business,v_supplier,'payment','payment',v_id,'Payment made · '||upper(v_method),v_amount,v_user);
  return jsonb_build_object('payment_id',v_id,'amount',v_amount,'supplier_id',v_supplier,'unallocated_amount',greatest(0,v_remaining),'duplicate',false);
end $$;

create or replace function public.record_expense(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_row public.expenses; v_amount numeric:=coalesce(nullif(p_payload->>'amount','')::numeric,0); v_method text:=coalesce(p_payload->>'method','cash');
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  if v_amount<=0 or nullif(btrim(p_payload->>'description'),'') is null then raise exception 'Enter a description and positive amount'; end if;
  if v_method not in ('cash','upi','bank','other') then raise exception 'Invalid expense payment method'; end if;
  insert into public.expenses(business_id,category,description,amount,method,reference,spent_at,created_by) values(v_business,coalesce(nullif(p_payload->>'category',''),'Miscellaneous'),btrim(p_payload->>'description'),round(v_amount,2),v_method,nullif(p_payload->>'reference',''),coalesce(nullif(p_payload->>'spent_at','')::date,current_date),auth.uid()) returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.get_cashbook(p_date date default current_date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_date date:=coalesce(p_date,(now() at time zone 'Asia/Kolkata')::date); v_tz text; v_open numeric; v_sale numeric; v_collection numeric; v_purchase numeric; v_supplier numeric; v_refund numeric; v_purchase_refund numeric; v_expense numeric; v_upi_in numeric; v_upi_out numeric; v_upi_expenses numeric; v_expected numeric; v_closing numeric;
begin
  if v_business is null then raise exception 'Business profile is not configured'; end if;
  if not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  select coalesce(time_zone,'Asia/Kolkata'),opening_cash into v_tz,v_open from public.business_settings where business_id=v_business;
  v_open=coalesce((select counted_cash from public.cash_closings where business_id=v_business and closing_date<v_date order by closing_date desc limit 1),v_open,0);
  select
    coalesce(sum(case when source_type='sale' and direction='in' and method='cash' then amount else 0 end),0),
    coalesce(sum(case when source_type='customer_collection' and direction='in' and method='cash' then amount else 0 end),0),
    coalesce(sum(case when source_type='purchase' and direction='out' and method='cash' then amount else 0 end),0),
    coalesce(sum(case when source_type='supplier_payment' and direction='out' and method='cash' then amount else 0 end),0),
    coalesce(sum(case when source_type='sale_refund' and direction='out' and method='cash' then amount else 0 end),0),
    coalesce(sum(case when source_type='purchase_refund' and direction='in' and method='cash' then amount else 0 end),0),
    coalesce(sum(case when direction='in' and method='upi' then amount else 0 end),0),
    coalesce(sum(case when direction='out' and method='upi' then amount else 0 end),0)
  into v_sale,v_collection,v_purchase,v_supplier,v_refund,v_purchase_refund,v_upi_in,v_upi_out
  from public.payments where business_id=v_business and (created_at at time zone coalesce(v_tz,'Asia/Kolkata'))::date=v_date;
  select coalesce(sum(amount),0) into v_upi_expenses from public.expenses where business_id=v_business and spent_at=v_date and method='upi';
  v_upi_out=coalesce(v_upi_out,0)+coalesce(v_upi_expenses,0);
  select coalesce(sum(amount),0) into v_expense from public.expenses where business_id=v_business and spent_at=v_date and method='cash';
  v_expected=coalesce(v_open,0)+v_sale+v_collection+v_purchase_refund-v_purchase-v_supplier-v_refund-v_expense;
  select counted_cash into v_closing from public.cash_closings where business_id=v_business and closing_date=v_date;
  return jsonb_build_object('date',v_date,'opening_cash',v_open,'cash_sales',v_sale,'cash_collections',v_collection,'cash_purchases',v_purchase,'cash_supplier_payments',v_supplier,'cash_refunds',v_refund,'supplier_refunds',v_purchase_refund,'cash_expenses',v_expense,'upi_in',v_upi_in,'upi_out',v_upi_out,'expected_closing',v_expected,'counted_closing',v_closing,'difference',case when v_closing is null then null else v_closing-v_expected end);
end $$;

create or replace function public.record_cash_closing(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_date date:=coalesce(nullif(p_payload->>'closing_date','')::date,(now() at time zone 'Asia/Kolkata')::date); v_counted numeric:=coalesce(nullif(p_payload->>'counted_cash','')::numeric,0); v_expected numeric; v_book jsonb; v_row public.cash_closings;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  v_book=public.get_cashbook(v_date);
  v_expected=coalesce((v_book->>'expected_closing')::numeric,0);
  insert into public.cash_closings(business_id,closing_date,expected_cash,counted_cash,note,counted_by) values(v_business,v_date,v_expected,v_counted,nullif(p_payload->>'note',''),auth.uid())
  on conflict(business_id,closing_date) do update set expected_cash=excluded.expected_cash,counted_cash=excluded.counted_cash,note=excluded.note,counted_by=excluded.counted_by,created_at=now() returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.reverse_sale(p_sale_id uuid, p_refund_method text default 'cash') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_user uuid:=auth.uid(); v_sale public.sales; v_line record; v_batch public.inventory_batches; v_refund uuid;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager approval is required to reverse a sale'; end if;
  if p_refund_method not in ('cash','upi','bank','other') then raise exception 'Invalid refund method'; end if;
  select * into v_sale from public.sales where id=p_sale_id and business_id=v_business for update;
  if not found or v_sale.status<>'posted' then raise exception 'Sale is not available for reversal'; end if;
  if not v_sale.inventory_applied then raise exception 'Historical imported sales do not affect current inventory and cannot be reversed here'; end if;
  if v_sale.customer_id is not null then perform 1 from public.customers where id=v_sale.customer_id and business_id=v_business for update; end if;
  for v_line in select si.*,p.batch_tracking from public.sale_items si left join public.products p on p.id=si.product_id where si.business_id=v_business and si.sale_id=v_sale.id loop
    if v_line.product_id is null then continue; end if;
    update public.products set current_stock=current_stock+v_line.quantity where id=v_line.product_id and business_id=v_business;
    for v_batch in select b.* from public.sale_item_batches sb join public.inventory_batches b on b.id=sb.batch_id where sb.business_id=v_business and sb.sale_item_id=v_line.id for update of b loop
      update public.inventory_batches set qty_on_hand=qty_on_hand+(select quantity from public.sale_item_batches where sale_item_id=v_line.id and batch_id=v_batch.id) where id=v_batch.id;
      insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by)
      select v_business,v_line.product_id,v_batch.id,'reversal',sb.quantity,v_batch.unit_cost,'sale_reversal',v_sale.id,'Sale reversal',v_user from public.sale_item_batches sb where sb.sale_item_id=v_line.id and sb.batch_id=v_batch.id;
    end loop;
    if not exists(select 1 from public.sale_item_batches where sale_item_id=v_line.id) then
      insert into public.inventory_movements(business_id,product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_line.product_id,'reversal',v_line.quantity,v_line.unit_cost,'sale_reversal',v_sale.id,'Sale reversal',v_user);
    end if;
  end loop;
  if v_sale.customer_id is not null then
    update public.customers set outstanding_balance=greatest(0,outstanding_balance-v_sale.balance_due) where id=v_sale.customer_id and business_id=v_business;
    insert into public.customer_ledger(business_id,customer_id,entry_type,reference_type,reference_id,description,credit,created_by) values(v_business,v_sale.customer_id,'sale_reversal','sale',v_sale.id,'Reversal of invoice '||v_sale.invoice_number,v_sale.total,v_user);
  end if;
  if v_sale.amount_paid>0 then
    insert into public.payments(business_id,party_type,source_type,customer_id,direction,method,amount,note,created_by)
    values(v_business,case when v_sale.customer_id is null then 'walkin' else 'customer' end,'sale_refund',v_sale.customer_id,'out',p_refund_method,v_sale.amount_paid,'Refund for invoice '||v_sale.invoice_number,v_user) returning id into v_refund;
    if v_sale.customer_id is not null then insert into public.customer_ledger(business_id,customer_id,entry_type,reference_type,reference_id,description,debit,created_by) values(v_business,v_sale.customer_id,'refund','payment',v_refund,'Refund issued · '||upper(p_refund_method),v_sale.amount_paid,v_user); end if;
  end if;
  update public.sales set status='reversed',payment_status='reversed',balance_due=0 where id=v_sale.id and business_id=v_business;
  return jsonb_build_object('sale_id',v_sale.id,'invoice_number',v_sale.invoice_number,'reversed',true);
end $$;

create or replace function public.reverse_purchase(p_purchase_id uuid,p_refund_method text default 'cash') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_user uuid:=auth.uid(); v_purchase public.purchases; v_line record; v_batch public.inventory_batches; v_refund uuid; v_remaining numeric;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access is required to return a purchase'; end if;
  if p_refund_method not in ('cash','upi','bank','other') then raise exception 'Invalid refund method'; end if;
  select * into v_purchase from public.purchases where id=p_purchase_id and business_id=v_business for update;
  if not found or v_purchase.status<>'posted' then raise exception 'Purchase is not available for reversal'; end if;
  if not v_purchase.inventory_applied then raise exception 'Historical imported purchases do not affect current inventory and cannot be reversed here'; end if;
  if v_purchase.supplier_id is not null then perform 1 from public.suppliers where id=v_purchase.supplier_id and business_id=v_business for update; end if;
  for v_line in select * from public.purchase_items where business_id=v_business and purchase_id=v_purchase.id loop
    if v_line.product_id is null then continue; end if;
    perform 1 from public.products where id=v_line.product_id and business_id=v_business for update;
    if v_line.batch_id is not null then
      select * into v_batch from public.inventory_batches where id=v_line.batch_id and business_id=v_business for update;
      if not found or v_batch.qty_on_hand<v_line.quantity then raise exception 'Not enough stock in batch % to return %',v_line.batch_number,v_line.product_name; end if;
      update public.inventory_batches set qty_on_hand=qty_on_hand-v_line.quantity where id=v_line.batch_id;
    elsif (select current_stock from public.products where id=v_line.product_id)=0 or (select current_stock from public.products where id=v_line.product_id)<v_line.quantity then
      raise exception 'Not enough stock to return %',v_line.product_name;
    end if;
    update public.products set current_stock=current_stock-v_line.quantity,avg_cost=case when current_stock-v_line.quantity<=0 then avg_cost else greatest(0,(current_stock*avg_cost-v_line.quantity*v_line.landed_unit_cost)/(current_stock-v_line.quantity)) end where id=v_line.product_id and business_id=v_business;
    insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by)
    values(v_business,v_line.product_id,v_line.batch_id,'purchase_return',-v_line.quantity,v_line.landed_unit_cost,'purchase_reversal',v_purchase.id,'Purchase return',v_user);
  end loop;
  if v_purchase.supplier_id is not null then
    update public.suppliers set outstanding_balance=greatest(0,outstanding_balance-v_purchase.balance_due) where id=v_purchase.supplier_id and business_id=v_business;
    insert into public.supplier_ledger(business_id,supplier_id,entry_type,reference_type,reference_id,description,debit,created_by) values(v_business,v_purchase.supplier_id,'purchase_reversal','purchase',v_purchase.id,'Reversal of purchase '||v_purchase.purchase_number,v_purchase.total,v_user);
  end if;
  if v_purchase.amount_paid>0 and v_purchase.supplier_id is not null then
    insert into public.payments(business_id,party_type,source_type,supplier_id,direction,method,amount,note,created_by) values(v_business,'supplier','purchase_refund',v_purchase.supplier_id,'in',p_refund_method,v_purchase.amount_paid,'Supplier refund for purchase '||v_purchase.purchase_number,v_user) returning id into v_refund;
    insert into public.supplier_ledger(business_id,supplier_id,entry_type,reference_type,reference_id,description,credit,created_by) values(v_business,v_purchase.supplier_id,'refund','payment',v_refund,'Refund received · '||upper(p_refund_method),v_purchase.amount_paid,v_user);
  end if;
  update public.purchases set status='reversed',payment_status='reversed',balance_due=0 where id=v_purchase.id and business_id=v_business;
  return jsonb_build_object('purchase_id',v_purchase.id,'purchase_number',v_purchase.purchase_number,'reversed',true);
end $$;

create or replace function public.adjust_stock(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_user uuid:=auth.uid(); v_adj uuid:=gen_random_uuid(); v_number text; v_seq bigint; v_reason text:=nullif(btrim(p_payload->>'reason'),''); v_item jsonb; v_product public.products; v_pid uuid; v_delta numeric; v_rem numeric; v_take numeric; v_batch public.inventory_batches;
begin
  if v_business is null or not public.has_business_role(array['owner']) then raise exception 'Owner approval is required for stock adjustments'; end if;
  if v_reason is null or jsonb_typeof(p_payload->'items')<>'array' or jsonb_array_length(p_payload->'items')=0 then raise exception 'A reason and at least one adjustment line are required'; end if;
  for v_pid in select distinct (x->>'product_id')::uuid from jsonb_array_elements(p_payload->'items') x order by 1 loop perform 1 from public.products where id=v_pid and business_id=v_business for update; if not found then raise exception 'Product is outside this business'; end if; end loop;
  update public.businesses set adjustment_seq=adjustment_seq+1 where id=v_business returning adjustment_seq into v_seq;
  v_number='ADJ-'||to_char(now(),'YYYY')||'-'||lpad(v_seq::text,6,'0');
  insert into public.stock_adjustments(business_id,adjustment_number,reason,status,requested_by,approved_by,approved_at) values(v_business,v_number,v_reason,'approved',v_user,v_user,now()) returning id into v_adj;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_pid=(v_item->>'product_id')::uuid; v_delta=round(coalesce(nullif(v_item->>'quantity_delta','')::numeric,0),3); if v_delta=0 then raise exception 'Adjustment quantity cannot be zero'; end if;
    select * into v_product from public.products where id=v_pid and business_id=v_business for update;
    if v_product.current_stock+v_delta<0 then raise exception 'Adjustment would make % stock negative',v_product.name; end if;
    insert into public.stock_adjustment_items(business_id,adjustment_id,product_id,quantity_delta,unit_cost,note) values(v_business,v_adj,v_pid,v_delta,v_product.avg_cost,nullif(v_item->>'note',''));
    if v_delta>0 then
      insert into public.inventory_batches(business_id,product_id,batch_number,qty_on_hand,unit_cost) values(v_business,v_pid,'ADJ-'||substr(replace(v_adj::text,'-',''),1,10),v_delta,v_product.avg_cost) on conflict(business_id,product_id,batch_number) do update set qty_on_hand=inventory_batches.qty_on_hand+excluded.qty_on_hand;
      select id into v_batch from public.inventory_batches where business_id=v_business and product_id=v_pid and batch_number='ADJ-'||substr(replace(v_adj::text,'-',''),1,10);
      update public.products set current_stock=current_stock+v_delta where id=v_pid;
      insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_pid,v_batch,case when lower(coalesce(v_item->>'movement_type',''))='damage' then 'damage' else 'adjustment' end,v_delta,v_product.avg_cost,'stock_adjustment',v_adj,v_reason,v_user);
    else
      v_rem=abs(v_delta);
      for v_batch in select * from public.inventory_batches where business_id=v_business and product_id=v_pid and qty_on_hand>0 order by expires_on nulls last,created_at for update loop
        exit when v_rem<=0; v_take=least(v_rem,v_batch.qty_on_hand); update public.inventory_batches set qty_on_hand=qty_on_hand-v_take where id=v_batch.id;
        insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_pid,v_batch.id,case when lower(coalesce(v_item->>'movement_type',''))='damage' then 'damage' else 'adjustment' end,-v_take,v_batch.unit_cost,'stock_adjustment',v_adj,v_reason,v_user);
        v_rem=v_rem-v_take;
      end loop;
      if v_rem>0 then insert into public.inventory_movements(business_id,product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_pid,case when lower(coalesce(v_item->>'movement_type',''))='damage' then 'damage' else 'adjustment' end,-v_rem,v_product.avg_cost,'stock_adjustment',v_adj,v_reason,v_user); end if;
      update public.products set current_stock=current_stock+v_delta where id=v_pid;
    end if;
  end loop;
  return jsonb_build_object('adjustment_id',v_adj,'adjustment_number',v_number,'status','approved');
end $$;

-- Dashboard values are computed from posted, tenant-filtered records; no seeded/sample figures.
create or replace function public.get_dashboard(p_from date default current_date,p_to date default current_date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_from date:=coalesce(p_from,(now() at time zone 'Asia/Kolkata')::date); v_to date:=coalesce(p_to,(now() at time zone 'Asia/Kolkata')::date); v_month_start date; v_today date; v_result jsonb; v_tz text:='Asia/Kolkata';
begin
  if v_business is null then raise exception 'Business profile is not configured'; end if;
  if not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required for financial dashboards'; end if;
  if v_to<v_from then raise exception 'Date range is invalid'; end if;
  select coalesce(time_zone,'Asia/Kolkata') into v_tz from public.business_settings where business_id=v_business;
  v_today=(now() at time zone v_tz)::date;
  v_month_start=date_trunc('month',v_today)::date;
  with
  sales_range as (select * from public.sales where business_id=v_business and status='posted' and sold_at >= (v_from::timestamp at time zone v_tz) and sold_at < ((v_to+1)::timestamp at time zone v_tz)),
  pmt as (select p.* from public.payments p where p.business_id=v_business),
  summary as (
    select
      coalesce((select sum(total) from sales_range),0) as sales,
      coalesce((select sum(p.amount) from pmt p where p.source_type='sale' and p.direction='in' and p.method='cash' and p.created_at >= (v_from::timestamp at time zone v_tz) and p.created_at < ((v_to+1)::timestamp at time zone v_tz)),0) as cash_sales,
      coalesce((select sum(p.amount) from pmt p where p.source_type='sale' and p.direction='in' and p.method='upi' and p.created_at >= (v_from::timestamp at time zone v_tz) and p.created_at < ((v_to+1)::timestamp at time zone v_tz)),0) as upi_sales,
      coalesce((select sum(credit_created) from sales_range where origin='pos'),0) as credit_sales,
      coalesce((select sum(amount) from pmt where party_type in ('customer','walkin') and direction='in' and created_at >= (v_from::timestamp at time zone v_tz) and created_at < ((v_to+1)::timestamp at time zone v_tz)),0) as collections,
      coalesce((select sum(si.gross_profit) from public.sale_items si join sales_range s on s.id=si.sale_id where s.origin='pos'),0) as gross_profit,
      coalesce((select sum(total) from public.sales where business_id=v_business and status='posted' and sold_at >= (v_month_start::timestamp at time zone v_tz) and sold_at < ((v_today+1)::timestamp at time zone v_tz)),0) as month_sales,
      coalesce((select sum(si.gross_profit) from public.sale_items si join public.sales s on s.id=si.sale_id where s.business_id=v_business and s.status='posted' and s.origin='pos' and s.sold_at >= (v_month_start::timestamp at time zone v_tz) and s.sold_at < ((v_today+1)::timestamp at time zone v_tz)),0) as month_profit,
      coalesce((select sum(outstanding_balance) from public.customers where business_id=v_business and is_active),0) as customer_outstanding,
      coalesce((select sum(outstanding_balance) from public.suppliers where business_id=v_business and is_active),0) as supplier_outstanding,
      coalesce((select sum(current_stock*avg_cost) from public.products where business_id=v_business and is_active),0) as inventory_value,
      (select count(*) from public.products where business_id=v_business and is_active and current_stock<=min_stock and min_stock>0) as low_stock,
      (select count(distinct id) from public.inventory_batches where business_id=v_business and qty_on_hand>0 and expires_on between v_today and v_today+90) as expiring,
      coalesce((select sum(amount) from public.expenses where business_id=v_business and spent_at between v_from and v_to),0) as expenses
  ),
  day_series as (select d::date as day from generate_series(v_from::timestamp,v_to::timestamp,interval '1 day') d),
  daily as (
    select ds.day,
      coalesce((select sum(s.total) from public.sales s where s.business_id=v_business and s.status='posted' and (s.sold_at at time zone v_tz)::date=ds.day),0) sales,
      coalesce((select sum(p.total) from public.purchases p where p.business_id=v_business and p.status='posted' and (p.purchased_at at time zone v_tz)::date=ds.day),0) purchase,
      coalesce((select sum(si.gross_profit) from public.sale_items si join public.sales s on s.id=si.sale_id where s.business_id=v_business and s.status='posted' and s.origin='pos' and (s.sold_at at time zone v_tz)::date=ds.day),0) profit
    from day_series ds
  ),
  mix as (
    select 'Cash'::text name,coalesce(sum(p.amount),0) value from pmt p where p.source_type='sale' and p.direction='in' and p.method='cash' and p.created_at >= (v_from::timestamp at time zone v_tz) and p.created_at < ((v_to+1)::timestamp at time zone v_tz)
    union all select 'UPI',coalesce(sum(p.amount),0) from pmt p where p.source_type='sale' and p.direction='in' and p.method='upi' and p.created_at >= (v_from::timestamp at time zone v_tz) and p.created_at < ((v_to+1)::timestamp at time zone v_tz)
    union all select 'Credit',coalesce(sum(s.credit_created),0) from sales_range s where s.origin='pos'
    union all select 'Bank / other',coalesce(sum(p.amount),0) from pmt p where p.source_type='sale' and p.direction='in' and p.method in ('bank','other') and p.created_at >= (v_from::timestamp at time zone v_tz) and p.created_at < ((v_to+1)::timestamp at time zone v_tz)
  ),
  top_prod as (
    select coalesce(si.product_name,'Unknown product') name, sum(si.quantity) quantity, sum(si.line_total) revenue
    from public.sale_items si join sales_range s on s.id=si.sale_id group by si.product_name order by sum(si.quantity) desc limit 10
  ),
  cats as (
    select coalesce(c.name,'Uncategorized') name,sum(si.line_total) sales from public.sale_items si join sales_range s on s.id=si.sale_id left join public.products p on p.id=si.product_id left join public.product_categories c on c.id=p.category_id group by 1 order by 2 desc limit 10
  ),
  age as (
    select '0–30 days' name,coalesce(sum(balance_due),0) value from public.sales where business_id=v_business and status='posted' and balance_due>0 and (sold_at at time zone v_tz)::date>=v_today-30
    union all select '31–60 days',coalesce(sum(balance_due),0) from public.sales where business_id=v_business and status='posted' and balance_due>0 and (sold_at at time zone v_tz)::date<v_today-30 and (sold_at at time zone v_tz)::date>=v_today-60
    union all select '61–90 days',coalesce(sum(balance_due),0) from public.sales where business_id=v_business and status='posted' and balance_due>0 and (sold_at at time zone v_tz)::date<v_today-60 and (sold_at at time zone v_tz)::date>=v_today-90
    union all select '90+ days',coalesce(sum(balance_due),0) from public.sales where business_id=v_business and status='posted' and balance_due>0 and (sold_at at time zone v_tz)::date<v_today-90
  ),
  slow as (
    select p.name,p.current_stock stock,p.current_stock*p.avg_cost value,coalesce(v_today-max((s.sold_at at time zone v_tz)::date),v_today-min((p.created_at at time zone v_tz)::date)) days
    from public.products p left join public.sale_items si on si.product_id=p.id left join public.sales s on s.id=si.sale_id and s.status='posted'
    where p.business_id=v_business and p.is_active and p.current_stock>0 group by p.id having max((s.sold_at at time zone v_tz)::date) is null or max((s.sold_at at time zone v_tz)::date)<v_today-60 order by p.current_stock*p.avg_cost desc limit 10
  )
  select jsonb_build_object(
    'summary',(select to_jsonb(summary) from summary),
    'daily_sales',(select coalesce(jsonb_agg(jsonb_build_object('label',to_char(day,'DD Mon'),'sales',sales,'purchase',purchase,'profit',profit) order by day),'[]'::jsonb) from daily),
    'payment_mix',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'value',value) order by name),'[]'::jsonb) from mix where value>0),
    'top_products',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'quantity',quantity,'revenue',revenue)),'[]'::jsonb) from top_prod),
    'category_sales',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'sales',sales)),'[]'::jsonb) from cats),
    'aging',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'value',value)),'[]'::jsonb) from age),
    'slow_moving',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'stock',stock,'value',value,'days',days)),'[]'::jsonb) from slow)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.stage_import_rows(p_file_name text,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_business uuid:=public.current_business_id(); v_job uuid; v_count integer; v_row jsonb; v_i integer:=0;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required to import data'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Import data must be a list'; end if;
  v_count=jsonb_array_length(p_rows); if v_count<1 or v_count>10000 then raise exception 'Import must contain between 1 and 10,000 rows'; end if;
  insert into public.import_jobs(business_id,file_name,kind,status,row_count,created_by,metadata) values(v_business,coalesce(nullif(p_file_name,''),'workbook.xlsx'),'legacy_workbook','staged',v_count,auth.uid(),jsonb_build_object('source','Excel migration wizard')) returning id into v_job;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_i=v_i+1;
    insert into public.import_job_rows(business_id,job_id,row_number,sheet_name,source_key,raw_data,mapped_data,status)
    values(v_business,v_job,v_i,nullif(v_row->>'sheet_name',''),nullif(v_row->>'source_key',''),coalesce(v_row->'raw_data','{}'::jsonb),coalesce(v_row->'mapped_data','{}'::jsonb),coalesce(nullif(v_row->>'status',''),'ready'));
  end loop;
  return jsonb_build_object('job_id',v_job,'row_count',v_count,'status','staged');
end $$;

-- Imports are intentionally historical: sales/purchases never create credit or mutate current stock.
-- Closing-sheet rows become the verified stock snapshot; historic sales without names stay unallocated.
create or replace function public.commit_import_job(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_business uuid:=public.current_business_id(); v_job public.import_jobs; v_row record; v_data jsonb; v_kind text; v_name text; v_sku text; v_product public.products; v_pid uuid;
  v_qty numeric; v_rate numeric; v_amount numeric; v_gst_rate numeric; v_base numeric; v_tax numeric; v_total numeric; v_date timestamptz; v_invoice text; v_id uuid; v_batch uuid; v_old numeric;
  v_done integer:=0; v_errors integer:=0; v_new_rows integer:=0;
begin
  if v_business is null or not public.has_business_role(array['owner','manager']) then raise exception 'Owner or manager access required'; end if;
  select * into v_job from public.import_jobs where id=p_job_id and business_id=v_business for update;
  if not found then raise exception 'Import job not found'; end if;
  if v_job.status='committed' then raise exception 'This workbook was already committed'; end if;
  for v_row in select * from public.import_job_rows where business_id=v_business and job_id=p_job_id and status in ('ready','error') order by row_number for update loop
    begin
      v_data=v_row.mapped_data; v_kind=lower(coalesce(v_data->>'kind','')); v_name=nullif(btrim(v_data->>'product_name'),''); v_sku=nullif(btrim(v_data->>'sku'),'');
      if v_kind in ('closing','product','products','opening') then
        if v_name is null then raise exception 'Product name is required'; end if;
        select * into v_product from public.products where business_id=v_business and ((v_sku is not null and lower(sku)=lower(v_sku)) or (v_sku is null and lower(name)=lower(v_name))) order by created_at limit 1 for update;
        if not found then
          insert into public.products(business_id,name,sku,gst_rate,purchase_unit,sales_unit,opening_stock,current_stock,min_stock,purchase_price,avg_cost,selling_price,batch_tracking,expiry_tracking)
          values(v_business,v_name,v_sku,coalesce(nullif(v_data->>'gst_rate','')::numeric,0),coalesce(nullif(v_data->>'unit',''),'bag'),coalesce(nullif(v_data->>'unit',''),'bag'),0,0,coalesce(nullif(v_data->>'min_stock','')::numeric,0),coalesce(nullif(v_data->>'purchase_price','')::numeric,0),coalesce(nullif(v_data->>'purchase_price','')::numeric,0),coalesce(nullif(v_data->>'selling_price','')::numeric,0),coalesce((v_data->>'batch_tracking')::boolean,false),coalesce((v_data->>'expiry_tracking')::boolean,false)) returning * into v_product;
          v_new_rows=v_new_rows+1;
        else
          if v_kind in ('product','products') then update public.products set purchase_price=coalesce(nullif(v_data->>'purchase_price','')::numeric,purchase_price),selling_price=coalesce(nullif(v_data->>'selling_price','')::numeric,selling_price),gst_rate=coalesce(nullif(v_data->>'gst_rate','')::numeric,gst_rate),min_stock=coalesce(nullif(v_data->>'min_stock','')::numeric,min_stock) where id=v_product.id returning * into v_product; end if;
        end if;
        if v_kind in ('closing','opening') then
          v_qty=coalesce(nullif(v_data->>'quantity','')::numeric,nullif(v_data->>'closing_stock','')::numeric,nullif(v_data->>'stock','')::numeric);
          if v_qty is null or v_qty<0 then raise exception 'Closing stock must be a non-negative number'; end if;
          v_old=v_product.current_stock;
          if v_qty<>v_old then
            update public.products set current_stock=v_qty,opening_stock=v_qty where id=v_product.id and business_id=v_business;
            -- A verified closing snapshot replaces the current batch picture; historical purchases/sales remain non-posting.
            update public.inventory_batches set qty_on_hand=0 where business_id=v_business and product_id=v_product.id and qty_on_hand>0;
            insert into public.inventory_batches(business_id,product_id,batch_number,qty_on_hand,unit_cost) values(v_business,v_product.id,'IMPORT-SNAPSHOT-'||substr(replace(p_job_id::text,'-',''),1,8),v_qty,v_product.avg_cost) on conflict(business_id,product_id,batch_number) do update set qty_on_hand=excluded.qty_on_hand,unit_cost=excluded.unit_cost returning id into v_batch;
            insert into public.inventory_movements(business_id,product_id,batch_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,note,created_by) values(v_business,v_product.id,v_batch,'import_snapshot',v_qty-v_old,v_product.avg_cost,'import_job',p_job_id,'Verified closing-stock snapshot',auth.uid());
          end if;
        end if;
      elsif v_kind='sale' then
        if v_name is null then raise exception 'Product name is required'; end if;
        select * into v_product from public.products where business_id=v_business and ((v_sku is not null and lower(sku)=lower(v_sku)) or (v_sku is null and lower(name)=lower(v_name))) order by created_at limit 1;
        if not found then raise exception 'Product not matched: %',v_name; end if;
        v_qty=coalesce(nullif(v_data->>'quantity','')::numeric,0); if v_qty<=0 then raise exception 'Quantity must be positive'; end if;
        v_gst_rate=coalesce(nullif(v_data->>'gst_rate','')::numeric,v_product.gst_rate);
        v_rate=coalesce(nullif(v_data->>'rate','')::numeric,nullif(v_data->>'unit_price','')::numeric);
        if v_rate is null and nullif(v_data->>'amount','') is not null then v_rate=round((v_data->>'amount')::numeric/(v_qty*(1+v_gst_rate/100)),4); end if;
        if v_rate is null or v_rate<0 then raise exception 'A valid rate or amount is required'; end if;
        v_base=round(v_rate*v_qty,2); v_tax=round(v_base*v_gst_rate/100,2); v_total=v_base+v_tax;
        v_date=coalesce(nullif(v_data->>'date','')::timestamptz,now()); v_invoice='LEG-'||substr(replace(p_job_id::text,'-',''),1,6)||'-S'||lpad(v_row.row_number::text,5,'0');
        insert into public.sales(business_id,invoice_number,external_invoice_number,historical_customer_name,sold_at,status,origin,inventory_applied,payment_status,subtotal,taxable_amount,gst_amount,total,amount_paid,balance_due,note,created_by)
        values(v_business,v_invoice,nullif(v_data->>'invoice_no',''),nullif(v_data->>'customer_name',''),v_date,'posted','import',false,'historical_unverified',v_base,v_base,v_tax,v_total,0,0,'Imported historical sale; settlement and customer allocation were not inferred.',auth.uid()) returning id into v_id;
        insert into public.sale_items(business_id,sale_id,product_id,product_name,sku_snapshot,quantity,unit,unit_price,gst_rate,taxable_amount,gst_amount,line_total,unit_cost,gross_profit)
        values(v_business,v_id,v_product.id,v_product.name,v_product.sku,v_qty,v_product.sales_unit,v_rate,v_gst_rate,v_base,v_tax,v_total,0,0);
      elsif v_kind='purchase' then
        if v_name is null then raise exception 'Product name is required'; end if;
        select * into v_product from public.products where business_id=v_business and ((v_sku is not null and lower(sku)=lower(v_sku)) or (v_sku is null and lower(name)=lower(v_name))) order by created_at limit 1;
        if not found then raise exception 'Product not matched: %',v_name; end if;
        v_qty=coalesce(nullif(v_data->>'quantity','')::numeric,0); v_rate=coalesce(nullif(v_data->>'rate','')::numeric,nullif(v_data->>'unit_cost','')::numeric);
        if v_qty<=0 or v_rate is null or v_rate<0 then raise exception 'Valid quantity and purchase rate are required'; end if;
        v_gst_rate=coalesce(nullif(v_data->>'gst_rate','')::numeric,v_product.gst_rate); v_base=round(v_qty*v_rate,2); v_tax=round(v_base*v_gst_rate/100,2); v_total=v_base+v_tax;
        v_date=coalesce(nullif(v_data->>'date','')::timestamptz,now()); v_invoice='LEG-'||substr(replace(p_job_id::text,'-',''),1,6)||'-P'||lpad(v_row.row_number::text,5,'0');
        insert into public.purchases(business_id,purchase_number,external_invoice_number,historical_supplier_name,purchased_at,status,origin,inventory_applied,payment_status,subtotal,taxable_amount,gst_amount,total,amount_paid,balance_due,note,created_by)
        values(v_business,v_invoice,nullif(v_data->>'invoice_no',''),nullif(v_data->>'supplier_name',''),v_date,'posted','import',false,'historical_unverified',v_base,v_base,v_tax,v_total,0,0,'Imported historical purchase; supplier settlement was not inferred.',auth.uid()) returning id into v_id;
        insert into public.purchase_items(business_id,purchase_id,product_id,product_name,quantity,unit,unit_cost,landed_unit_cost,gst_rate,taxable_amount,gst_amount,line_total,batch_number)
        values(v_business,v_id,v_product.id,v_product.name,v_qty,v_product.purchase_unit,v_rate,v_rate,v_gst_rate,v_base,v_tax,v_total,nullif(v_data->>'batch_number',''));
      else
        raise exception 'Choose a row type: Closing, Product, Sale or Purchase';
      end if;
      update public.import_job_rows set status='imported',error_message=null where id=v_row.id;
      v_done=v_done+1;
    exception when others then
      update public.import_job_rows set status='error',error_message=left(sqlerrm,500) where id=v_row.id;
      v_errors=v_errors+1;
    end;
  end loop;
  select count(*) filter(where status='imported'),count(*) filter(where status='error') into v_done,v_errors from public.import_job_rows where business_id=v_business and job_id=p_job_id;
  update public.import_jobs set status=case when v_errors=0 then 'committed' else 'committed_with_errors' end,imported_count=v_done,error_count=v_errors,committed_at=case when v_errors=0 then now() else null end where id=p_job_id;
  return jsonb_build_object('job_id',p_job_id,'imported',v_done,'errors',v_errors,'new_products',v_new_rows,'status',case when v_errors=0 then 'committed' else 'committed_with_errors' end);
end $$;

-- A tenant's own records are visible only to active members of that tenant.
create or replace function public.role_can_manage() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.has_business_role(array['owner','manager'])
$$;

-- Cost/profit columns are deliberately unavailable to cashiers. These owner-rights views re-check
-- the caller's tenant and role on every query before exposing management-only values.
create or replace view public.management_products with (security_barrier=true) as
select p.*,c.name as category_name from public.products p left join public.product_categories c on c.id=p.category_id
where p.business_id=public.current_business_id() and public.role_can_manage();
create or replace view public.management_sale_items with (security_barrier=true) as
select si.* from public.sale_items si where si.business_id=public.current_business_id() and public.role_can_manage();

alter table public.roles enable row level security;
create policy roles_read on public.roles for select to authenticated using (true);

alter table public.businesses enable row level security;
create policy businesses_read on public.businesses for select to authenticated using (id=public.current_business_id());
create policy businesses_update_owner on public.businesses for update to authenticated using (id=public.current_business_id() and public.has_business_role(array['owner'])) with check (id=public.current_business_id() and public.has_business_role(array['owner']));

-- Business-scoped tables: SELECT access is tenant-filtered. Writes are intentionally RPC-only unless noted.
do $$
declare t text;
begin
  foreach t in array array['product_categories','products','customers','sales','sale_items','customer_ledger'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select to authenticated using (business_id=public.current_business_id())',t||'_tenant_read',t);
  end loop;
end $$;

create policy categories_manage on public.product_categories for all to authenticated using (business_id=public.current_business_id() and public.role_can_manage()) with check (business_id=public.current_business_id() and public.role_can_manage());
create policy products_manage on public.products for all to authenticated using (business_id=public.current_business_id() and public.role_can_manage()) with check (business_id=public.current_business_id() and public.role_can_manage());
create policy customers_manage on public.customers for all to authenticated using (business_id=public.current_business_id() and public.has_business_role(array['owner','manager','cashier'])) with check (business_id=public.current_business_id() and public.has_business_role(array['owner','manager','cashier']));

-- Sensitive purchasing, supplier and finance tables are not exposed to cashier sessions.
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.supplier_ledger enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sale_item_batches enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.expenses enable row level security;
create policy suppliers_read_manage_role on public.suppliers for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy suppliers_manage on public.suppliers for all to authenticated using (business_id=public.current_business_id() and public.role_can_manage()) with check (business_id=public.current_business_id() and public.role_can_manage());
create policy purchases_read_manage_role on public.purchases for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy purchase_items_read_manage_role on public.purchase_items for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy batches_read_manage_role on public.inventory_batches for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy payments_customer_or_management_read on public.payments for select to authenticated using (business_id=public.current_business_id() and (public.role_can_manage() or (party_type in ('customer','walkin') and public.has_business_role(array['cashier']))));
create policy payment_alloc_sales_or_management_read on public.payment_allocations for select to authenticated using (business_id=public.current_business_id() and (public.role_can_manage() or (sale_id is not null and public.has_business_role(array['cashier']))));
create policy supplier_ledger_read_manage_role on public.supplier_ledger for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy movements_read_manage_role on public.inventory_movements for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy sale_batches_read_manage_role on public.sale_item_batches for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy stock_adjustments_read_manage_role on public.stock_adjustments for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy stock_adjustment_items_read_manage_role on public.stock_adjustment_items for select to authenticated using (business_id=public.current_business_id() and public.role_can_manage());
create policy expenses_manage_owner_manager on public.expenses for all to authenticated using (business_id=public.current_business_id() and public.role_can_manage()) with check (business_id=public.current_business_id() and public.role_can_manage());
create policy settings_owner_all on public.business_settings for all to authenticated using (business_id=public.current_business_id() and public.has_business_role(array['owner'])) with check (business_id=public.current_business_id() and public.has_business_role(array['owner']));
alter table public.audit_logs enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;
alter table public.cash_closings enable row level security;
alter table public.business_settings enable row level security;
create policy audit_owner_read on public.audit_logs for select to authenticated using (business_id=public.current_business_id() and public.has_business_role(array['owner']));
create policy import_owner_read on public.import_jobs for select to authenticated using (business_id=public.current_business_id() and public.has_business_role(array['owner','manager']));
create policy import_rows_owner_read on public.import_job_rows for select to authenticated using (business_id=public.current_business_id() and public.has_business_role(array['owner','manager']));
create policy cash_closing_read_write on public.cash_closings for all to authenticated using (business_id=public.current_business_id() and public.role_can_manage()) with check (business_id=public.current_business_id() and public.role_can_manage());
create policy business_settings_owner_read on public.business_settings for select to authenticated using (business_id=public.current_business_id() and public.has_business_role(array['owner']));

alter table public.user_profiles enable row level security;
create policy profile_self_or_owner_read on public.user_profiles for select to authenticated using (id=auth.uid() or (business_id=public.current_business_id() and public.has_business_role(array['owner','manager'])));
create policy profile_owner_update on public.user_profiles for update to authenticated using (business_id=public.current_business_id() and public.has_business_role(array['owner'])) with check (business_id=public.current_business_id() and public.has_business_role(array['owner']));

-- Privileged transaction procedures are callable only by signed-in users; each checks profile, role and tenant.
revoke all on function public.bootstrap_business(text,text) from public,anon;
revoke all on function public.create_category(text) from public,anon;
revoke all on function public.get_pos_settings() from public,anon;
revoke all on function public.save_product(jsonb) from public,anon;
revoke all on function public.save_customer(jsonb) from public,anon;
revoke all on function public.save_supplier(jsonb) from public,anon;
revoke all on function public.create_sale(jsonb) from public,anon;
revoke all on function public.create_purchase(jsonb) from public,anon;
revoke all on function public.receive_customer_payment(jsonb) from public,anon;
revoke all on function public.receive_supplier_payment(jsonb) from public,anon;
revoke all on function public.record_expense(jsonb) from public,anon;
revoke all on function public.record_cash_closing(jsonb) from public,anon;
revoke all on function public.get_cashbook(date) from public,anon;
revoke all on function public.reverse_sale(uuid,text) from public,anon;
revoke all on function public.reverse_purchase(uuid,text) from public,anon;
revoke all on function public.adjust_stock(jsonb) from public,anon;
revoke all on function public.get_dashboard(date,date) from public,anon;
revoke all on function public.stage_import_rows(text,jsonb) from public,anon;
revoke all on function public.commit_import_job(uuid) from public,anon;
revoke all on function public.current_business_id() from public,anon;
revoke all on function public.has_business_role(text[]) from public,anon;
revoke all on function public.role_can_manage() from public,anon;
revoke all on function public.set_updated_at() from public,anon;
revoke all on function public.audit_row_change() from public,anon;
grant execute on function public.current_business_id(),public.has_business_role(text[]),public.role_can_manage() to authenticated;
grant execute on function public.bootstrap_business(text,text) to authenticated;
grant execute on function public.get_pos_settings() to authenticated;
grant execute on function public.create_category(text),public.save_product(jsonb),public.save_customer(jsonb),public.save_supplier(jsonb),public.create_sale(jsonb),public.create_purchase(jsonb),public.receive_customer_payment(jsonb),public.receive_supplier_payment(jsonb),public.record_expense(jsonb),public.record_cash_closing(jsonb),public.get_cashbook(date),public.get_dashboard(date,date),public.stage_import_rows(text,jsonb),public.commit_import_job(uuid) to authenticated;
grant execute on function public.reverse_sale(uuid,text),public.reverse_purchase(uuid,text),public.adjust_stock(jsonb) to authenticated;

-- Remove Supabase/default grants first; add only the privileges needed by the browser.
revoke all on all tables in schema public from anon,authenticated;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
-- Column-level product and sale-line grants keep cost/profit details out of cashier sessions.
revoke select on public.products from authenticated;
grant select (id,business_id,name,sku,category_id,brand,manufacturer,hsn_code,gst_rate,purchase_unit,sales_unit,pack_size,current_stock,min_stock,selling_price,barcode,batch_tracking,expiry_tracking,is_active,created_at,updated_at) on public.products to authenticated;
revoke select on public.sale_items from authenticated;
grant select (id,business_id,sale_id,product_id,product_name,sku_snapshot,quantity,unit,unit_price,discount,gst_rate,taxable_amount,gst_amount,line_total,created_at) on public.sale_items to authenticated;
grant select on public.management_products,public.management_sale_items to authenticated;
grant insert,update,delete on public.product_categories,public.businesses,public.user_profiles,public.business_settings to authenticated;

commit;
