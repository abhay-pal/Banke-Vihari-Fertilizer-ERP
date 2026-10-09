-- Customer and invoice custom status/remarks. Run once in Supabase SQL Editor.
begin;
alter table public.customers add column if not exists customer_status text not null default 'active';
alter table public.customers add column if not exists remark text;
alter table public.sales add column if not exists bill_status text not null default 'completed';
alter table public.customers add constraint customers_customer_status_valid check (customer_status in ('active','follow_up','on_hold','blocked'));
alter table public.sales add constraint sales_bill_status_valid check (bill_status in ('completed','follow_up','on_hold'));

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
    insert into public.customers(business_id,customer_code,name,mobile,village,address,gstin,opening_balance,credit_limit,outstanding_balance,is_active,customer_status,remark)
    values(v_business,nullif(p_customer->>'customer_code',''),v_name,nullif(p_customer->>'mobile',''),nullif(p_customer->>'village',''),nullif(p_customer->>'address',''),nullif(p_customer->>'gstin',''),v_open,coalesce(nullif(p_customer->>'credit_limit','')::numeric,0),v_open,coalesce((p_customer->>'is_active')::boolean,true),coalesce(nullif(p_customer->>'customer_status',''),'active'),nullif(left(btrim(p_customer->>'remark'),1000),'')) returning * into v_row;
    if v_open>0 then insert into public.customer_ledger(business_id,customer_id,entry_type,description,debit,created_by) values(v_business,v_row.id,'opening_balance','Opening balance',v_open,auth.uid()); end if;
  else
    update public.customers set name=v_name,mobile=nullif(p_customer->>'mobile',''),village=nullif(p_customer->>'village',''),address=nullif(p_customer->>'address',''),gstin=nullif(p_customer->>'gstin',''),credit_limit=case when public.has_business_role(array['owner','manager']) then coalesce(nullif(p_customer->>'credit_limit','')::numeric,credit_limit) else credit_limit end,is_active=coalesce((p_customer->>'is_active')::boolean,is_active),customer_status=coalesce(nullif(p_customer->>'customer_status',''),customer_status),remark=nullif(left(btrim(coalesce(p_customer->>'remark','')),1000),'')
    where id=v_id and business_id=v_business returning * into v_row;
    if not found then raise exception 'Customer not found in this business'; end if;
  end if;
  return to_jsonb(v_row);
end $$;

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
  insert into public.sales(id,business_id,invoice_number,idempotency_key,customer_id,sold_at,due_date,status,origin,inventory_applied,payment_status,subtotal,discount_total,taxable_amount,gst_amount,total,amount_paid,credit_created,balance_due,created_by,note,bill_status)
  values(v_id,v_business,v_invoice,v_key,v_customer,now(),v_due_date,'posted','pos',true,case when v_due=0 then 'paid' when v_paid=0 then 'credit' else 'partial' end,round(v_subtotal,2),round(v_discount_total,2),round(v_taxable,2),round(v_gst,2),v_total,v_paid,v_due,v_due,v_user,nullif(left(btrim(p_payload->>'remark'),1000),''),coalesce(nullif(p_payload->>'bill_status',''),'completed'));
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

commit;
