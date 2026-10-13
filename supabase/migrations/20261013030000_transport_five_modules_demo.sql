-- Transport ERP: additional two-month demo master and history data.
-- Period: 2026-08-14 to 2026-10-13 inclusive. Synthetic examples only.
-- Requires existing public.transport_records and exactly one business.
-- Does not overwrite existing records; each new row has a unique demo_key.
do $$
declare b uuid; n int; i int; k int; t text; drv text; d date; batch constant text := 'transport_demo_extra_2026_08_10_v1'; key text; amount_val numeric;
begin
 select count(*) into n from public.businesses;
 if n <> 1 then raise exception 'Expected exactly one business; found %. No data inserted.', n; end if;
 select id into b from public.businesses limit 1;
 for i in 1..30 loop
  t := 'UP80DT'||lpad(i::text,4,'0');
  drv := (array['Ramesh','Suresh','Mahesh','Dinesh','Mukesh','Rajesh','Naresh','Vijay','Ajay','Pankaj','Sunil','Anil','Ravi','Deepak','Manoj','Pradeep','Sanjay','Amit','Rohit','Sachin','Lokesh','Nitin','Arun','Harish','Kamal','Vikas','Ashok','Mohan','Karan','Yogesh'])[i]||' Kumar';
  -- Ensure 30 trucks and drivers exist even if original base seed wasn't executed.
  key := 'truck-'||i;
  if not exists(select 1 from public.transport_records where business_id=b and module='trucks' and truck_number=t) then
   insert into public.transport_records(business_id,module,title,truck_number,entry_date,details)
   values(b,'trucks',t,t,'2026-08-14',jsonb_build_object('registration',t,'model',(array['Tata Signa 4018','Ashok Leyland 2820','BharatBenz 2823'])[1+i%3],'capacity_ton',18+(i%4)*4,'ownership',case when i%5=0 then 'Leased' else 'Owned' end,'year',2020+i%6,'purchase_price',2800000+i*35000,'loan_emi',42000+i*300,'bank','Demo Bank','emi_end_date','2029-12-31','status','Available','demo_batch',batch,'demo_key',key));
  end if;
  key := 'driver-'||i;
  if not exists(select 1 from public.transport_records where business_id=b and module='drivers' and title=drv) then
   insert into public.transport_records(business_id,module,title,driver_name,entry_date,details)
   values(b,'drivers',drv,drv,'2026-08-14',jsonb_build_object('mobile','90000'||lpad(i::text,5,'0'),'address','Demo address, Uttar Pradesh','licence_number','DEMO-DL-'||i,'licence_expiry',(date '2026-10-13'+i*12)::text,'monthly_salary',22000+i%5*1000,'joining_date','2026-08-14','emergency_contact','91000'||lpad(i::text,5,'0'),'status','Active','demo_batch',batch,'demo_key',key));
  end if;
  -- Two maintenance/service events per truck, dated within the period.
  for k in 1..2 loop
   key := 'service-'||i||'-'||k;
   if not exists(select 1 from public.transport_records where business_id=b and module='maintenance' and details->>'demo_key'=key) then
    d := date '2026-08-18' + (i%12) + (k-1)*35;
    amount_val := 2500+(i%8)*625+k*1200;
    insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,amount,odometer,details)
    values(b,'maintenance',case when k=1 then 'Preventive engine oil and filters' else 'Brake, clutch and tyre inspection' end,t,drv,d,amount_val,52000+i*1800+k*3200,
      jsonb_build_object('service_type',case when k=1 then 'Scheduled Service' else 'Inspection / Repair' end,'garage','Demo Fleet Workshop','parts_replaced',case when k=1 then 'Oil filter, engine oil' else 'Brake lining' end,'next_service_date',(d+90)::text,'next_service_km',60000+i*1800+k*3200,'downtime_days',1,'invoice_number','DEMO-SRV-'||i||'-'||k,'demo_batch',batch,'demo_key',key));
   end if;
  end loop;
  -- 5 compliance/renewal entries for every truck.
  for k in 1..5 loop
   key := 'renewal-'||i||'-'||k;
   if not exists(select 1 from public.transport_records where business_id=b and module='documents' and details->>'demo_key'=key) then
    d := date '2026-08-14' + ((i*3+k*11)%61);
    insert into public.transport_records(business_id,module,title,truck_number,entry_date,details)
    values(b,'documents',(array['Insurance','Fitness Certificate','National Permit','PUC','Road Tax'])[k]||' - '||t,t,d,
      jsonb_build_object('document_type',(array['Insurance','Fitness Certificate','National Permit','PUC','Road Tax'])[k],'document_number','DEMO-REN-'||i||'-'||k,'issue_date',d::text,'expiry_date',(d+30+(i*7+k*9)%150)::text,'renewal_cost',1000+k*550,'remarks','Synthetic example, not a valid document','demo_batch',batch,'demo_key',key));
   end if;
  end loop;
 end loop;
 -- 20 transport parties (customers and hired truck vendors), with two-month dated onboarding.
 for i in 1..20 loop
  key := 'party-'||i;
  if not exists(select 1 from public.transport_records where business_id=b and module='customers' and details->>'demo_key'=key) then
   d := date '2026-08-14' + (i*3)%61;
   insert into public.transport_records(business_id,module,title,entry_date,details)
   values(b,'customers',case when i<=15 then 'Demo Freight Customer ' else 'Demo Hired Fleet Vendor ' end||lpad(i::text,2,'0'),d,
    jsonb_build_object('party_type',case when i<=15 then 'Customer' else 'Vendor' end,'mobile','92000'||lpad(i::text,5,'0'),'address',(array['Agra','Mathura','Jaipur','Gurugram','Delhi'])[1+i%5],'gstin','DEMO-NOT-VALID','payment_terms','30 days','credit_limit',75000+i*10000,'demo_batch',batch,'demo_key',key));
  end if;
 end loop;
 raise notice 'Supplement inserted where missing; all records marked as synthetic demo.';
end $$;
select module,count(*) filter (where details->>'demo_batch' in ('transport_demo_2026_08_10_v1','transport_demo_extra_2026_08_10_v1')) as demo_rows,
 min(entry_date) as earliest_date,max(entry_date) as latest_date
from public.transport_records
where module in ('trucks','drivers','maintenance','customers','documents')
group by module order by module;
