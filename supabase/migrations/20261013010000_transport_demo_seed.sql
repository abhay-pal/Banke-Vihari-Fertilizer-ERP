-- DEMO ONLY: 30 synthetic trucks, September and October 2026 (through October 13).
-- This is sample data, not actual company transactions.
-- Safe guard: requires exactly ONE business in public.businesses.
-- Idempotent: rerunning does not duplicate a previously seeded dataset.
do $$
declare b uuid; n int; i int; d date; truck text; driver text; k int; tripdate date; freight numeric; liters numeric; distancekm numeric;
begin
 select count(*) into n from public.businesses;
 if n <> 1 then raise exception 'Demo seed stopped: expected exactly 1 business, found %. Select a specific business_id before seeding.', n; end if;
 select id into b from public.businesses limit 1;
 if exists(select 1 from public.transport_records where business_id=b and details->>'demo_batch'='transport_demo_2026_09_10_v1') then
   raise notice 'Demo data already present. No duplicate rows added.';
   return;
 end if;
 for i in 1..30 loop
  truck := 'UP80DT'||lpad(i::text,4,'0');
  driver := (array['Ramesh','Suresh','Mahesh','Dinesh','Mukesh','Rajesh','Naresh','Vijay','Ajay','Pankaj','Sunil','Anil','Ravi','Deepak','Manoj','Pradeep','Sanjay','Amit','Rohit','Sachin','Lokesh','Nitin','Arun','Harish','Kamal','Vikas','Ashok','Mohan','Karan','Yogesh'])[i]||' Kumar';
  insert into public.transport_records(business_id,module,title,truck_number,entry_date,details)
  values(b,'trucks',truck,truck,'2026-09-01',jsonb_build_object('registration',truck,'model',case when i%3=0 then 'Tata Signa 4018' when i%3=1 then 'Ashok Leyland 2820' else 'BharatBenz 2823' end,'capacity_ton',18+(i%4)*4,'status','Active','demo_batch','transport_demo_2026_09_10_v1'));
  insert into public.transport_records(business_id,module,title,driver_name,entry_date,details)
  values(b,'drivers',driver,driver,'2026-09-01',jsonb_build_object('mobile','90000'||lpad(i::text,5,'0'),'licence_number','UP-DL-DEMO-'||i,'licence_expiry','2027-12-31','monthly_salary',22000+(i%5)*1000,'demo_batch','transport_demo_2026_09_10_v1'));
  for k in 0..7 loop
   tripdate := date '2026-09-02' + k*5 + (i%3);
   if tripdate > '2026-10-13' then continue; end if;
   distancekm := 180 + (i*23+k*37)%670;
   freight := round(distancekm*(48+(i%7)*2),2);
   insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,amount,quantity,odometer,details)
   values(b,'trips','Demo LR '||i||'-'||k,truck,driver,tripdate,freight,18+(i%4)*4,42000+i*2500+k*distancekm,jsonb_build_object('origin',(array['Agra','Mathura','Delhi','Jaipur','Gurugram'])[1+(i+k)%5],'destination',(array['Lucknow','Kanpur','Noida','Aligarh','Faridabad'])[1+(i+2*k)%5],'lr_number','DEMO-LR-'||i||'-'||k,'distance_km',distancekm,'trip_status','Completed','demo_batch','transport_demo_2026_09_10_v1'));
   liters := round(distancekm/(3.4+(i%7)*0.15),2);
   insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,amount,quantity,odometer,details)
   values(b,'diesel','Demo diesel refill',truck,driver,tripdate,round(liters*(87+(i%4)),2),liters,42000+i*2500+k*distancekm,jsonb_build_object('pump','Demo Highway Fuel','rate_per_litre',87+(i%4),'demo_batch','transport_demo_2026_09_10_v1'));
   insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,amount,details)
   values(b,'expenses','Toll and trip allowance',truck,driver,tripdate,950+(i+k)%7*160,jsonb_build_object('expense_type','Toll / FASTag','trip_reference','DEMO-LR-'||i||'-'||k,'demo_batch','transport_demo_2026_09_10_v1'));
   insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,amount,details)
   values(b,'receipts','Demo freight receipt',truck,driver,tripdate+1,round(freight*0.82,2),jsonb_build_object('invoice_number','DEMO-LR-'||i||'-'||k,'payment_method','bank','demo_batch','transport_demo_2026_09_10_v1'));
  end loop;
  for k in 0..1 loop
   insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,amount,details)
   values(b,'maintenance',case when k=0 then 'Engine oil service' else 'Brake inspection and repairs' end,truck,driver,date '2026-09-12'+k*26+(i%5),3500+(i%6)*850,jsonb_build_object('service_type',case when k=0 then 'Routine Service' else 'Repair' end,'garage','Demo Fleet Workshop','next_service_date','2026-12-01','demo_batch','transport_demo_2026_09_10_v1'));
   insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,amount,details)
   values(b,'payroll','Driver monthly payment',truck,driver,date '2026-09-30'+k*13,22000+(i%5)*1000,jsonb_build_object('payment_type','Salary','payment_method','bank','demo_batch','transport_demo_2026_09_10_v1'));
  end loop;
  for k in 0..42 loop
   d := date '2026-09-01'+k;
   insert into public.transport_records(business_id,module,title,truck_number,driver_name,entry_date,details)
   values(b,'attendance','Driver attendance',truck,driver,d,jsonb_build_object('status',case when (i+k)%9=0 then 'Leave' else 'Present' end,'shift','Day','demo_batch','transport_demo_2026_09_10_v1'));
  end loop;
 end loop;
 raise notice 'Transport demo seeded for 30 trucks, Sep 1-Oct 13, 2026.';
end $$;
