-- Run AFTER seed_2026_jul_sep.sql succeeds.
-- Extra demo records for supporting operational tables.
-- No authentication users or production business settings are fabricated.
begin;
do $$
declare b uuid; p uuid; v uuid; adj uuid; job uuid; n int; m int; dt date;
begin
 select count(*) into n from public.user_profiles where role_code='owner' and status='active';
 if n<>1 then raise exception 'Exactly one active owner required'; end if;
 select business_id into b from public.user_profiles where role_code='owner' and status='active';
 if not exists(select 1 from public.sales where business_id=b and invoice_number='DEMO-2026-S-0-001') then
   raise exception 'Run the main 3-month demo seed first';
 end if;
 if exists(select 1 from public.import_jobs where business_id=b and file_name='DEMO-2026-TEST-IMPORT.csv') then
   raise exception 'Supporting demo data already exists';
 end if;
 for n in 1..12 loop
   select id into p from public.products where business_id=b and sku='DEMO-PROD-'||lpad(n::text,2,'0');
   if p is null then raise exception 'Missing demo product %',n; end if;
   insert into public.inventory_batches(business_id,product_id,batch_number,manufactured_on,expires_on,qty_on_hand,unit_cost)
   values(b,p,'DEMO-BATCH-'||n,date '2026-06-01',date '2027-06-01',0,700+n*20)
   on conflict(business_id,product_id,batch_number) do nothing;
 end loop;
 for m in 0..2 loop
   dt := (date '2026-07-01'+(m||' months')::interval)::date;
   for n in 1..10 loop
     select id into p from public.products where business_id=b and sku='DEMO-PROD-'||lpad(n::text,2,'0');
     insert into public.stock_adjustments(business_id,adjustment_number,reason,status)
     values(b,'DEMO-ADJ-'||m||'-'||n,'DEMO stock review only - no stock movement','pending')
     returning id into adj;
     insert into public.stock_adjustment_items(business_id,adjustment_id,product_id,quantity_delta,unit_cost,note)
     values(b,adj,p,1,700+n*20,'DEMO pending adjustment: does not change live stock');
   end loop;
   for n in 1..10 loop
     insert into public.cash_closings(business_id,closing_date,expected_cash,counted_cash,note)
     values(b,dt+(n*2),0,0,'DEMO cash closing - no actual cash counted')
     on conflict(business_id,closing_date) do nothing;
   end loop;
   for n in 1..10 loop
     insert into public.audit_logs(business_id,action,entity_type,new_data,created_at)
     values(b,'demo_review','demo_test',jsonb_build_object('demo',true,'month',m,'row',n),dt::timestamptz+(n||' days')::interval);
   end loop;
 end loop;
 insert into public.import_jobs(business_id,file_name,kind,status,row_count,imported_count,metadata)
 values(b,'DEMO-2026-TEST-IMPORT.csv','legacy_workbook','staged',30,0,'{"demo":true}'::jsonb)
 returning id into job;
 for n in 1..30 loop
   insert into public.import_job_rows(business_id,job_id,row_number,sheet_name,source_key,raw_data,mapped_data,status)
   values(b,job,n,'DEMO', 'DEMO-ROW-'||n,jsonb_build_object('demo',true,'name','DEMO Import Row '||n),'{}'::jsonb,'ready');
 end loop;
end $$;
commit;
