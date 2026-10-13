-- Supplement to 30-truck demo seed. Run AFTER 20261013010000_transport_demo_seed.sql.
-- Adds demo parties and compliance documents, without modifying real records.
-- Assumes exactly one business; stops otherwise to prevent cross-business insertion.
do $$
declare b uuid; n integer; i integer; j integer; t text; label text; exp date;
begin
 select count(*) into n from public.businesses;
 if n <> 1 then raise exception 'Expected exactly one business, found %. Do not seed until business_id is identified.', n; end if;
 select id into b from public.businesses limit 1;
 if not exists (select 1 from public.transport_records where business_id=b and module='trucks' and details->>'demo_batch'='transport_demo_2026_08_10_v1') then
  raise exception 'First run the base 30-truck demo SQL (20261013010000_transport_demo_seed.sql).';
 end if;
 -- Transport party master (15 distinct demo clients)
 for i in 1..15 loop
  if not exists(select 1 from public.transport_records where business_id=b and module='customers' and details->>'demo_key'='party-'||i) then
   insert into public.transport_records(business_id,module,title,entry_date,details)
   values(b,'customers','Demo Transport Client '||lpad(i::text,2,'0'),date '2026-08-14'+(i%14),
    jsonb_build_object('mobile','91000'||lpad(i::text,5,'0'),'email','demo'||i||'@example.invalid','gstin','DEMO-NOT-VALID','address',(array['Agra','Mathura','Delhi','Jaipur','Gurugram'])[1+(i%5)],'payment_terms','15 days','credit_limit',100000+i*20000,'demo_batch','transport_demo_2026_08_10_v1','demo_key','party-'||i));
  end if;
 end loop;
 -- Five different compliance documents per truck, 150 rows.
 for i in 1..30 loop
  t := 'UP80DT'||lpad(i::text,4,'0');
  for j in 1..5 loop
   label := (array['Insurance','Fitness','National Permit','PUC','Road Tax'])[j];
   exp := date '2026-10-13' + (i*7+j*13)%140-12;
   if not exists(select 1 from public.transport_records where business_id=b and module='documents' and details->>'demo_key'='doc-'||i||'-'||j) then
    insert into public.transport_records(business_id,module,title,truck_number,entry_date,details)
    values(b,'documents',label||' - '||t,t,date '2026-08-14'+(i+j)%61,
     jsonb_build_object('document_type',label,'document_number','DEMO-DOC-'||i||'-'||j,'issue_date','2026-01-01','expiry_date',exp::text,'renewal_cost',1500+j*400,'remarks','SAMPLE DATA - not a valid legal document','demo_batch','transport_demo_2026_08_10_v1','demo_key','doc-'||i||'-'||j));
   end if;
  end loop;
 end loop;
 raise notice 'Supplement completed: transport customers and truck compliance documents.';
end $$;
-- Summary to verify that every transport module contains sample data.
select module,count(*) as demo_records,min(entry_date) as first_date,max(entry_date) as last_date
from public.transport_records
where details->>'demo_batch'='transport_demo_2026_08_10_v1'
group by module order by module;
