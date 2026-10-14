-- Repair missing Fleet / Trucks and Drivers master using existing attendance data.
-- Run in Supabase SQL Editor. Safe to rerun; only creates missing masters.
-- Business-scoped: uses each attendance record's business_id, not a global business.
begin;
with source_trucks as (
 select distinct on (business_id,truck_number) business_id,truck_number,driver_name
 from public.transport_records
 where module='attendance' and nullif(trim(truck_number),'') is not null
 order by business_id,truck_number,entry_date desc
)
insert into public.transport_records(business_id,module,title,truck_number,entry_date,details)
select s.business_id,'trucks',s.truck_number,s.truck_number,date '2026-08-14',
 jsonb_build_object(
  'registration',s.truck_number,
  'model',(array['Tata Signa 4018','Ashok Leyland 2820','BharatBenz 2823'])[1+((right(s.truck_number,2))::int%3)],
  'capacity_ton',18+((right(s.truck_number,2))::int%4)*4,
  'ownership','Owned','status','Available','year',2022,
  'demo_batch','transport_master_repair_2026_10_14',
  'assigned_driver',s.driver_name)
from source_trucks s
where not exists(select 1 from public.transport_records m where m.business_id=s.business_id and m.module='trucks' and upper(trim(m.truck_number))=upper(trim(s.truck_number)));

with source_drivers as (
 select distinct on (business_id,driver_name) business_id,driver_name,truck_number
 from public.transport_records
 where module='attendance' and nullif(trim(driver_name),'') is not null
 order by business_id,driver_name,entry_date desc
)
insert into public.transport_records(business_id,module,title,driver_name,entry_date,details)
select s.business_id,'drivers',s.driver_name,s.driver_name,date '2026-08-14',
 jsonb_build_object(
  'assigned_truck',s.truck_number,
  'monthly_salary',24000,
  'status','Active',
  'demo_batch','transport_master_repair_2026_10_14')
from source_drivers s
where not exists(select 1 from public.transport_records m where m.business_id=s.business_id and m.module='drivers' and lower(trim(coalesce(m.driver_name,m.title)))=lower(trim(s.driver_name)));
commit;

select module,count(*) as total_records
from public.transport_records
where module in ('trucks','drivers','attendance')
group by module order by module;
