-- Banke Vihari ERP | 3-month DEMO data | July–September 2026
-- REVIEW BEFORE RUNNING. Inserts TEST data into the currently selected owner's business.
-- Safe to re-run: exits if any DEMO-2026 invoice already exists.
-- Does not modify/delete real transactions. Remove demo data only with a separately reviewed cleanup script.
begin;
do $$
declare
  v_business uuid;
  v_owner uuid;
  v_category uuid;
  v_product uuid;
  v_customer uuid;
  v_supplier uuid;
  v_sale uuid;
  v_purchase uuid;
  v_payment uuid;
  v_date date;
  v_qty numeric;
  v_rate numeric;
  v_total numeric;
  v_paid numeric;
  v_due numeric;
  v_month int;
  v_i int;
  v_stock numeric;
  v_cost numeric;
begin
  -- Pick a single owner workspace. Refuse to guess when there are multiple businesses.
  select count(*) into v_i from public.user_profiles where role_code='owner' and status='active';
  if v_i <> 1 then
    raise exception 'Expected exactly one active owner profile, found %. Do not run until target business is selected explicitly.',v_i;
  end if;
  select business_id,id into v_business,v_owner
  from public.user_profiles where role_code='owner' and status='active';
  if exists(select 1 from public.sales where business_id=v_business and invoice_number like 'DEMO-2026-%') then
    raise exception 'Demo sales already exist. Seeder stopped to avoid duplicates.';
  end if;
  insert into public.product_categories(business_id,name)
  values(v_business,'DEMO Fertilizers')
  on conflict(business_id,name) do nothing;
  select id into v_category from public.product_categories where business_id=v_business and name='DEMO Fertilizers';
  for v_i in 1..12 loop
    insert into public.products(business_id,name,sku,category_id,brand,hsn_code,gst_rate,
      purchase_unit,sales_unit,opening_stock,current_stock,min_stock,avg_cost,purchase_price,selling_price)
    values(v_business,'DEMO Fertilizer Product '||v_i,'DEMO-PROD-'||lpad(v_i::text,2,'0'),
      v_category,'DEMO Brand','3105',0,'bag','bag',150,150,20,700+v_i*20,700+v_i*20,850+v_i*25);
  end loop;
  for v_i in 1..12 loop
    insert into public.customers(business_id,customer_code,name,village,credit_limit)
    values(v_business,'DEMO-C-'||lpad(v_i::text,2,'0'),'DEMO Customer '||v_i,'Demo Village',30000);
  end loop;
  for v_i in 1..10 loop
    insert into public.suppliers(business_id,supplier_code,name,address)
    values(v_business,'DEMO-SUP-'||lpad(v_i::text,2,'0'),'DEMO Supplier '||v_i,'TEST DATA');
  end loop;
  -- Monthly: 12 purchases, 20 sales, 10 expenses = 42 rows in main transaction tables.
  for v_month in 0..2 loop
    for v_i in 1..12 loop
      v_date := (date '2026-07-01' + (v_month||' months')::interval)::date + (v_i*2-1);
      select id,current_stock,avg_cost into v_product,v_stock,v_cost from public.products
      where business_id=v_business and sku='DEMO-PROD-'||lpad(((v_i-1)%12+1)::text,2,'0');
      select id into v_supplier from public.suppliers
      where business_id=v_business and supplier_code='DEMO-SUP-'||lpad(((v_i-1)%10+1)::text,2,'0');
      v_qty := 20+(v_i%4)*5;
      v_rate := 700+v_i*20;
      v_total := v_qty*v_rate;
      v_paid := case when v_i%3=0 then v_total/2 else v_total end;
      v_due := v_total-v_paid;
      insert into public.purchases(business_id,purchase_number,supplier_id,purchased_at,status,origin,
        inventory_applied,payment_status,subtotal,taxable_amount,total,amount_paid,balance_due,note,created_by)
      values(v_business,'DEMO-2026-P-'||v_month||'-'||lpad(v_i::text,3,'0'),v_supplier,v_date::timestamptz,
        'posted','manual',true,case when v_due>0 then 'partial' else 'paid' end,
        v_total,v_total,v_total,v_paid,v_due,'DEMO TEST DATA - not a real purchase',v_owner)
      returning id into v_purchase;
      insert into public.purchase_items(business_id,purchase_id,product_id,product_name,quantity,unit,
        unit_cost,landed_unit_cost,taxable_amount,line_total)
      values(v_business,v_purchase,v_product,'DEMO Fertilizer Product '||v_i,v_qty,'bag',
        v_rate,v_rate,v_total,v_total);
      update public.products set current_stock=current_stock+v_qty,
        avg_cost=((current_stock*avg_cost)+(v_qty*v_rate))/(current_stock+v_qty)
      where id=v_product;
      insert into public.inventory_movements(business_id,product_id,moved_at,movement_type,
        quantity_delta,unit_cost,reference_type,reference_id,note,created_by)
      values(v_business,v_product,v_date::timestamptz,'purchase',v_qty,v_rate,'purchase',v_purchase,'DEMO',v_owner);
      if v_due>0 then
        update public.suppliers set outstanding_balance=outstanding_balance+v_due where id=v_supplier;
        insert into public.supplier_ledger(business_id,supplier_id,txn_at,entry_type,reference_type,reference_id,description,credit,created_by)
        values(v_business,v_supplier,v_date::timestamptz,'purchase','purchase',v_purchase,'DEMO purchase credit',v_due,v_owner);
      end if;
      if v_paid>0 then
        insert into public.payments(business_id,party_type,source_type,supplier_id,direction,method,amount,reference,note,created_by,created_at)
        values(v_business,'supplier','purchase',v_supplier,'out','bank',v_paid,'DEMO-PAY-'||v_month||'-'||v_i,'DEMO TEST',v_owner,v_date::timestamptz)
        returning id into v_payment;
        insert into public.payment_allocations(business_id,payment_id,purchase_id,amount)
        values(v_business,v_payment,v_purchase,v_paid);
      end if;
    end loop;
    for v_i in 1..20 loop
      v_date := (date '2026-07-01' + (v_month||' months')::interval)::date + ((v_i*3)%27);
      select id,current_stock,avg_cost,selling_price into v_product,v_stock,v_cost,v_rate
      from public.products where business_id=v_business
      and sku='DEMO-PROD-'||lpad(((v_i-1)%12+1)::text,2,'0');
      select id into v_customer from public.customers where business_id=v_business
      and customer_code='DEMO-C-'||lpad(((v_i-1)%12+1)::text,2,'0');
      v_qty := 1+(v_i%5);
      if v_stock<v_qty then raise exception 'Insufficient DEMO stock'; end if;
      v_total := v_qty*v_rate;
      v_paid := case when v_i%4=0 then 0 when v_i%4=1 then v_total/2 else v_total end;
      v_due := v_total-v_paid;
      insert into public.sales(business_id,invoice_number,customer_id,sold_at,status,origin,
        inventory_applied,payment_status,subtotal,taxable_amount,total,amount_paid,credit_created,balance_due,note,created_by)
      values(v_business,'DEMO-2026-S-'||v_month||'-'||lpad(v_i::text,3,'0'),v_customer,v_date::timestamptz,
        'posted','pos',true,case when v_due=0 then 'paid' when v_paid=0 then 'credit' else 'partial' end,
        v_total,v_total,v_total,v_paid,v_due,v_due,'DEMO TEST DATA - not a real sale',v_owner)
      returning id into v_sale;
      insert into public.sale_items(business_id,sale_id,product_id,product_name,sku_snapshot,quantity,unit,
        unit_price,taxable_amount,line_total,unit_cost,gross_profit)
      values(v_business,v_sale,v_product,'DEMO Fertilizer Product '||((v_i-1)%12+1),
        'DEMO-PROD-'||lpad(((v_i-1)%12+1)::text,2,'0'),v_qty,'bag',
        v_rate,v_total,v_total,v_cost,(v_rate-v_cost)*v_qty);
      update public.products set current_stock=current_stock-v_qty where id=v_product;
      insert into public.inventory_movements(business_id,product_id,moved_at,movement_type,
        quantity_delta,unit_cost,reference_type,reference_id,note,created_by)
      values(v_business,v_product,v_date::timestamptz,'sale',-v_qty,v_cost,'sale',v_sale,'DEMO',v_owner);
      update public.customers set outstanding_balance=outstanding_balance+v_due,
        last_purchase_at=greatest(coalesce(last_purchase_at,v_date::timestamptz),v_date::timestamptz)
      where id=v_customer;
      if v_due>0 then
        insert into public.customer_ledger(business_id,customer_id,txn_at,entry_type,reference_type,reference_id,description,debit,created_by)
        values(v_business,v_customer,v_date::timestamptz,'sale','sale',v_sale,'DEMO credit sale',v_due,v_owner);
      end if;
      if v_paid>0 then
        insert into public.payments(business_id,party_type,source_type,customer_id,direction,method,amount,reference,note,created_by,created_at)
        values(v_business,'customer','sale',v_customer,'in',case when v_i%2=0 then 'cash' else 'upi' end,
          v_paid,'DEMO-RECEIPT-'||v_month||'-'||v_i,'DEMO TEST',v_owner,v_date::timestamptz)
        returning id into v_payment;
        insert into public.payment_allocations(business_id,payment_id,sale_id,amount)
        values(v_business,v_payment,v_sale,v_paid);
      end if;
    end loop;
    for v_i in 1..10 loop
      v_date := (date '2026-07-01' + (v_month||' months')::interval)::date + v_i*2;
      insert into public.expenses(business_id,category,description,amount,method,reference,spent_at,created_by)
      values(v_business,'DEMO Operations','DEMO test expense '||v_i,150+v_i*25,
        case when v_i%2=0 then 'cash' else 'upi' end,'DEMO-EXP-'||v_month||'-'||v_i,v_date,v_owner);
    end loop;
  end loop;
  raise notice 'Created 12 demo products, 12 customers, 10 suppliers, 36 purchases, 60 sales and 30 expenses in business %',v_business;
end $$;
commit;
