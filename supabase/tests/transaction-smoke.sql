-- Run only against an isolated test database with the initial migration applied.
-- Auth is simulated here; this does not validate hosted Supabase login.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.bootstrap_business('TEST ONLY ERP','Test Owner');
do $$
declare p jsonb; c jsonb; s jsonb; sale jsonb; b uuid;
begin
  b := public.current_business_id();
  p := public.save_product('{"name":"TEST ONLY fertilizer","sku":"TEST-001","purchase_price":100,"selling_price":150,"gst_rate":0}');
  c := public.save_customer('{"name":"TEST ONLY customer","credit_limit":10000}');
  s := public.save_supplier('{"name":"TEST ONLY supplier"}');
  perform public.create_purchase(jsonb_build_object('supplier_id',s->>'id','items',jsonb_build_array(jsonb_build_object('product_id',p->>'id','quantity',20,'unit_cost',100)),'payments',jsonb_build_array(jsonb_build_object('method','cash','amount',2000))));
  sale := public.create_sale(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('product_id',p->>'id','quantity',2,'unit_price',150)),'payments',jsonb_build_array(jsonb_build_object('method','cash','amount',300))));
  if (sale->>'balance_due')::numeric <> 0 then raise exception 'Cash sale balance mismatch'; end if;
  sale := public.create_sale(jsonb_build_object('customer_id',c->>'id','items',jsonb_build_array(jsonb_build_object('product_id',p->>'id','quantity',4,'unit_price',150)),'payments','[]'::jsonb));
  if (sale->>'balance_due')::numeric <> 600 then raise exception 'Credit sale balance mismatch'; end if;
  perform public.receive_customer_payment(jsonb_build_object('customer_id',c->>'id','amount',200,'method','cash'));
  if (select outstanding_balance from public.customers where id=(c->>'id')::uuid) <> 400 then raise exception 'Customer balance mismatch'; end if;
  if (select balance_due from public.sales where id=(sale->>'sale_id')::uuid) <> 400 then raise exception 'Invoice allocation mismatch'; end if;
  if (select current_stock from public.management_products where id=(p->>'id')::uuid) <> 14 then raise exception 'Inventory mismatch'; end if;
  if (select sum(debit-credit) from public.customer_ledger where customer_id=(c->>'id')::uuid) <> 400 then raise exception 'Customer ledger mismatch'; end if;
  if (select sum(quantity_delta) from public.inventory_movements where product_id=(p->>'id')::uuid) <> 14 then raise exception 'Inventory ledger mismatch'; end if;
  perform public.get_pos_settings();
  raise notice 'PASS: owner bootstrap, products, purchases, cash/credit sales, partial payments, inventory and ledgers';
end $$;
rollback;
