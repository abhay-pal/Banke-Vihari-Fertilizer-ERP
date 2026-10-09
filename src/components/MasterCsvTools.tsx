import { useRef, useState } from 'react'
import { Download, Upload, FileDown } from 'lucide-react'
import { api } from '../lib/services'
import { downloadCsv, errorMessage } from '../lib/utils'
import { useToast } from './ui'

type Kind = 'products' | 'customers' | 'suppliers'
const columns: Record<Kind, string[]> = {
  products: ['name','sku','brand','hsn_code','gst_rate','purchase_unit','sales_unit','opening_stock','min_stock','purchase_price','selling_price'],
  customers: ['name','mobile','village','address','gstin','opening_balance','credit_limit'],
  suppliers: ['name','contact_number','address','gstin','opening_balance'],
}
const examples: Record<Kind, Record<string,string>[]> = {
  products: [
    {name:'DEMO Urea 45kg',sku:'DEMO-UREA-45',brand:'Demo Brand',hsn_code:'3102',gst_rate:'5',purchase_unit:'bag',sales_unit:'bag',opening_stock:'100',min_stock:'20',purchase_price:'260',selling_price:'300'},
    {name:'DEMO DAP 50kg',sku:'DEMO-DAP-50',brand:'Demo Brand',hsn_code:'3105',gst_rate:'5',purchase_unit:'bag',sales_unit:'bag',opening_stock:'75',min_stock:'15',purchase_price:'1250',selling_price:'1400'},
    {name:'DEMO NPK 50kg',sku:'DEMO-NPK-50',brand:'Demo Brand',hsn_code:'3105',gst_rate:'5',purchase_unit:'bag',sales_unit:'bag',opening_stock:'60',min_stock:'12',purchase_price:'1050',selling_price:'1200'},
  ],
  customers: [
    {name:'DEMO Ramesh Kumar',mobile:'',village:'Demo Village A',address:'TEST DATA',gstin:'',opening_balance:'0',credit_limit:'25000'},
    {name:'DEMO Suresh Singh',mobile:'',village:'Demo Village B',address:'TEST DATA',gstin:'',opening_balance:'0',credit_limit:'15000'},
    {name:'DEMO Mohan Lal',mobile:'',village:'Demo Village C',address:'TEST DATA',gstin:'',opening_balance:'0',credit_limit:'10000'},
  ],
  suppliers: [
    {name:'DEMO Agri Wholesale',contact_number:'',address:'TEST DATA',gstin:'',opening_balance:'0'},
    {name:'DEMO Fertilizer Distribution',contact_number:'',address:'TEST DATA',gstin:'',opening_balance:'0'},
  ],
}
function parseCsv(text:string): Record<string,string>[] {
  const rows:string[][]=[];let row:string[]=[];let value='';let quoted=false
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(value);value=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value=''}else value+=c}
  if(quoted)throw new Error('CSV has an unclosed quoted value')
  row.push(value);if(row.some(x=>x.trim()))rows.push(row)
  const headers=(rows.shift()||[]).map(s=>s.trim().replace(/^\uFEFF/,''))
  return rows.map(cells=>Object.fromEntries(headers.map((h,i)=>[h,(cells[i]||'').trim()])))
}
export function MasterCsvTools({kind,rows,onImported,canManage}:{kind:Kind;rows:Record<string,any>[];onImported:()=>Promise<void>;canManage:boolean}) {
  const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);const {toast}=useToast()
  const template=()=>downloadCsv(`banke-vihari-${kind}-template.csv`,[Object.fromEntries(columns[kind].map(k=>[k,'']))])
  const demo=()=>downloadCsv(`banke-vihari-${kind}-demo.csv`,examples[kind])
  const exportRows=()=>downloadCsv(`banke-vihari-${kind}-export.csv`,rows.map(r=>Object.fromEntries(columns[kind].map(k=>[k,r[k]??'']))))
  async function upload(file:File) {
    setBusy(true)
    try {
      if(file.size>1024*1024)throw new Error('Maximum CSV size is 1 MB per import')
      const parsed=parseCsv(await file.text())
      if(!parsed.length||parsed.length>250)throw new Error('CSV must contain 1 to 250 rows')
      const missing=columns[kind].filter(k=>!Object.keys(parsed[0]).includes(k))
      if(missing.length)throw new Error('Missing columns: '+missing.join(', '))
      if(parsed.some(r=>!r.name?.trim()))throw new Error('Every row must have a name')
      const duplicates=new Set<string>()
      for(const r of parsed){const key=(kind==='products'?(r.sku||r.name):r.name).toLowerCase();if(duplicates.has(key))throw new Error('Duplicate row: '+key);duplicates.add(key)}
      if(!window.confirm(`Import ${parsed.length} ${kind} into the LIVE business database? This changes real records. Use DEMO files only for testing.`))return
      let saved=0
      for(const r of parsed){
        const payload:any={...r}
        for(const field of ['gst_rate','opening_stock','min_stock','purchase_price','selling_price','opening_balance','credit_limit']){
          if(field in payload){const n=Number(payload[field]||0);if(!Number.isFinite(n)||n<0)throw new Error('Invalid '+field+' for '+r.name);payload[field]=n}
        }
        if(kind==='products')await api.saveProduct({...payload,batch_tracking:false,expiry_tracking:false,is_active:true})
        else if(kind==='customers')await api.saveCustomer(payload)
        else await api.saveSupplier(payload)
        saved++
      }
      toast('CSV import completed',`${saved} ${kind} added. Verify the master and balances before billing.`)
      await onImported()
    }catch(e){toast('CSV import stopped',errorMessage(e),'error')}
    finally{setBusy(false);if(input.current)input.current.value=''}
  }
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={template} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium"><FileDown size={14}/>Template CSV</button>
    <button type="button" onClick={demo} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium"><Download size={14}/>Demo CSV</button>
    <a href={`${import.meta.env.BASE_URL}demo/three-month-transactions.csv`} download className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium"><Download size={14}/>3-month Demo CSV</a>
    <button type="button" onClick={exportRows} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium"><Download size={14}/>Export CSV</button>
    <button type="button" disabled={!canManage||busy} onClick={()=>input.current?.click()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-40"><Upload size={14}/>{busy?'Importing…':'Import CSV'}</button>
    <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f)}}/>
  </div>
}
