import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CircleCheck, FileSpreadsheet, Info, Loader2, Upload, X } from 'lucide-react'
import { api } from '../lib/services'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Product } from '../lib/types'
import { Badge, Button, Dialog, DialogHeader, Input, Label, Select, useToast } from '../components/ui'
import { errorMessage, number } from '../lib/utils'

type ImportKind='closing'|'sale'|'purchase'|'product'
type ParsedSheet={ name:string; headerRow:number; headers:string[]; rows:Array<{ rowNumber:number; raw:Record<string,unknown> }> }
const fieldLabels: Record<string,string> = { product_name:'Product name', sku:'SKU / code', quantity:'Quantity / stock', rate:'Rate / unit price', amount:'Line amount', date:'Date', invoice_no:'Invoice number', customer_name:'Customer name (historical label only)', supplier_name:'Supplier name (historical label only)', gst_rate:'GST rate %', unit:'Unit', min_stock:'Minimum stock', purchase_price:'Purchase price', selling_price:'Selling price' }
const fieldsFor=(kind:ImportKind)=>kind==='closing'?['product_name','sku','quantity','unit','purchase_price','selling_price','min_stock']:kind==='product'?['product_name','sku','unit','purchase_price','selling_price','gst_rate','min_stock']:kind==='sale'?['product_name','sku','date','invoice_no','quantity','rate','amount','gst_rate','customer_name']:['product_name','sku','date','invoice_no','quantity','rate','amount','gst_rate','supplier_name']

export function ExcelImportWizard({open,onOpenChange,products,afterCommit}:{open:boolean;onOpenChange:(open:boolean)=>void;products:Product[];afterCommit:()=>void}) {
  const {toast}=useToast()
  const [fileName,setFileName]=useState('')
  const [fileHash,setFileHash]=useState('')
  const [sheets,setSheets]=useState<ParsedSheet[]>([])
  const [sheetName,setSheetName]=useState('')
  const [headerRow,setHeaderRow]=useState(1)
  const [kind,setKind]=useState<ImportKind>('closing')
  const [mapping,setMapping]=useState<Record<string,string>>({})
  const [busy,setBusy]=useState(false)
  const [result,setResult]=useState<any>(null)
  const [allowDuplicates,setAllowDuplicates]=useState(false)
  const activeSheet=sheets.find(s=>s.name===sheetName)
  const currentSheetName=activeSheet?.name||''
  const headers=activeSheet?.headers||[]
  const fields=fieldsFor(kind)

  const mappedRows=useMemo(()=>{
    if(!activeSheet)return []
    return activeSheet.rows.map(row=>{
      const mapped:Record<string,any>={kind:kind==='product'?'product':kind}
      for(const field of fields){const col=mapping[field];if(col){const value=row.raw[col];mapped[field]=field==='date'?normalizeDate(value):field==='quantity'||field==='rate'||field==='amount'||field==='gst_rate'||field==='min_stock'||field==='purchase_price'||field==='selling_price'?normalizeNumber(value):normalizeText(value)}}
      return {rowNumber:row.rowNumber,raw:row.raw,mapped}
    })
  },[activeSheet,fields.join('|'),mapping,kind])

  const duplicateRows=useMemo(()=>{
    const seen=new Set<string>();const dup=new Set<number>()
    for(const row of mappedRows){const d=row.mapped;const fingerprint=[kind,d.date,d.invoice_no,(d.sku||d.product_name)?.toString().toLowerCase(),d.quantity,d.amount||d.rate].join('|');if(seen.has(fingerprint))dup.add(row.rowNumber);else seen.add(fingerprint)}
    return dup
  },[mappedRows,kind])
  const errors=mappedRows.map(row=>{const d=row.mapped;const missing:string[]=[];if(!d.product_name)missing.push('product name');if(kind==='closing'&&!isValidNumber(d.quantity))missing.push('closing stock');if(kind==='sale'||kind==='purchase'){if(!isValidNumber(d.quantity))missing.push('quantity');if(kind==='purchase'&&!isValidNumber(d.rate))missing.push('purchase rate');if(kind==='sale'&&!isValidNumber(d.rate)&&!isValidNumber(d.amount))missing.push('selling rate or amount')}if((kind==='sale'||kind==='purchase')&&d.date!==undefined&&d.date!==null&&!d.date)missing.push('valid date');return {rowNumber:row.rowNumber,missing}})
  const validCount=errors.filter(e=>!e.missing.length).length
  const unmatched=useMemo(()=>{
    if(kind!=='sale'&&kind!=='purchase')return []
    const productIndex=new Set(products.map(p=>p.name.trim().toLowerCase()))
    const skuIndex=new Set(products.map(p=>(p.sku||'').trim().toLowerCase()).filter(Boolean))
    return mappedRows.filter(r=>r.mapped.product_name&&!productIndex.has(String(r.mapped.product_name).trim().toLowerCase())&&!(r.mapped.sku&&skuIndex.has(String(r.mapped.sku).trim().toLowerCase()))).map(r=>r.mapped.product_name as string).filter((v,i,a)=>a.indexOf(v)===i)
  },[mappedRows,kind,products])
  const hasBlocking=validCount!==mappedRows.length||unmatched.length>0||(duplicateRows.size>0&&!allowDuplicates)

  function guessKind(name:string):ImportKind{const s=name.toLowerCase();return s.includes('closing')||s.includes('stock')?'closing':s.includes('sale')?'sale':s.includes('purchase')?'purchase':'product'}
  function guessField(field:string,header:string){const h=header.toLowerCase().replace(/[^a-z0-9]/g,'');const guesses:Record<string,string[]>={product_name:['product','itemname','item','productname','fertilizer','description','particulars','name'],sku:['sku','productcode','itemcode','code'],quantity:['qty','quantity','stock','closingstock','balance','bags','nos'],rate:['rate','price','unitprice','purchaserate','salerate','cost'],amount:['amount','total','value','lineamount'],date:['date','billdate','purchasedate','saledate'],invoice_no:['invoice','billno','billnumber','invoiceno','voucherno'],customer_name:['customer','partyname','farmer','customername'],supplier_name:['supplier','vendor','suppliername'],gst_rate:['gst','gstrate','taxrate'],unit:['unit','uom'],min_stock:['minimumstock','minstock','reorderlevel'],purchase_price:['purchaseprice','costprice','purchaserate'],selling_price:['sellingprice','saleprice','retailprice']}
    return (guesses[field]||[]).some(g=>h===g||h.includes(g))}
  function autoMapping(nextHeaders:string[],nextKind:ImportKind){const next:Record<string,string>={};for(const field of fieldsFor(nextKind)){const found=nextHeaders.find(header=>guessField(field,header));if(found)next[field]=found}setMapping(next)}
  async function onFile(file?:File){if(!file)return;setBusy(true);setResult(null);setFileName(file.name);setSheets([]);setSheetName('');try{const buffer=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buffer);const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');setFileHash(hash);const ExcelJS=(await import('exceljs')).default;const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);const parsed:ParsedSheet[]=[]
      wb.worksheets.forEach(ws=>{const rows:any[]=[];for(let r=1;r<=ws.rowCount;r++){const row=ws.getRow(r);const rawValues:unknown[]=[];for(let c=1;c<=Math.max(ws.columnCount,1);c++)rawValues.push(cellValue(row.getCell(c).value));rows.push(rawValues)}const nonEmpty=rows.map((r:unknown[],i:number)=>({i,filled:r.filter((v:unknown)=>v!==null&&v!=='').length})).filter(x=>x.filled>0);const candidate=nonEmpty.slice(0,10).sort((a,b)=>b.filled-a.filled)[0];const headerIndex=candidate?.i??0;const headerRow=headerIndex+1;const rowNumber=headerRow;const hs=(rows[headerIndex]||[]).map((v:unknown,i:number)=>normalizeText(v)||`Column ${i+1}`);const data=rows.slice(headerIndex+1).map((values:unknown[],index:number)=>{const raw:Record<string,unknown>={};hs.forEach((h:string,i:number)=>{raw[h]=values[i]??null});return {rowNumber:rowNumber+index+1,raw}}).filter((r:{rowNumber:number;raw:Record<string,unknown>})=>Object.values(r.raw).some((v:unknown)=>v!==null&&v!==''));parsed.push({name:ws.name,headerRow,headers:hs,rows:data})})
      if(!parsed.length)throw new Error('This workbook has no readable sheets.');setSheets(parsed);setSheetName(parsed[0].name);setHeaderRow(parsed[0].headerRow);const initialKind=guessKind(parsed[0].name);setKind(initialKind);autoMapping(parsed[0].headers,initialKind)
    }catch(e){toast('Workbook could not be opened',`${errorMessage(e)}. Select an .xlsx workbook.`, 'error')}finally{setBusy(false)}}
  function chooseSheet(name:string){const s=sheets.find(x=>x.name===name);if(!s)return;setSheetName(name);setHeaderRow(s.headerRow);const k=guessKind(name);setKind(k);autoMapping(s.headers,k);setResult(null)}
  function changeKind(next:ImportKind){setKind(next);autoMapping(headers,next);setResult(null)}

  async function retryFailed(){if(!result?.job_id)return;setBusy(true);try{const committed=await api.importCommit(result.job_id);setResult({...result,...committed});afterCommit();toast('Import retry finished',`${committed.imported} total row(s) imported; ${committed.errors} remain.`,committed.errors?'info':'success')}catch(e){toast('Retry failed',errorMessage(e),'error')}finally{setBusy(false)}}
  async function stageAndCommit(){if(!activeSheet||hasBlocking||!isSupabaseConfigured||result)return;setBusy(true);try{
    const body=mappedRows.map((row,index)=>({sheet_name:activeSheet.name,source_key:`${fileHash}:${activeSheet.name}:${row.rowNumber}`,raw_data:row.raw,mapped_data:row.mapped,status:'ready'}))
    const staged=await api.importStage(fileName,body)
    const committed=await api.importCommit(staged.job_id)
    setResult({...committed,job_id:staged.job_id,sheet_name:activeSheet.name});afterCommit();toast('Import finished',`${committed.imported} row(s) imported; ${committed.errors} row(s) need attention.`,committed.errors?'info':'success')
  }catch(e){toast('Import was not committed',errorMessage(e), 'error')}finally{setBusy(false)}}
  function close(openNext:boolean){onOpenChange(openNext);if(!openNext){setResult(null);setAllowDuplicates(false)}}

  return <Dialog open={open} onOpenChange={close}><DialogHeader title="Excel migration wizard" description="Inspect, map and validate historical workbook rows before importing."/>
    <div className="space-y-4 p-5">
      {!fileName?<div className="rounded-2xl border-2 border-dashed border-slate-200 p-7 text-center dark:border-slate-700"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-900/30"><FileSpreadsheet size={23}/></div><div className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Upload your Excel workbook</div><p className="mt-1 text-xs leading-5 text-slate-400">The browser reads the file locally. Only mapped rows are sent to your Supabase business database after you confirm.</p><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-700"><Upload size={15}/>{busy?'Reading…':'Choose .xlsx file'}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={e=>void onFile(e.target.files?.[0])}/></label><div className="mt-3 text-[10px] text-slate-400">Excel .xlsx only · workbook contents are never uploaded as an attachment</div></div>:
      <>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"><div className="flex min-w-0 items-center gap-2"><FileSpreadsheet size={16} className="shrink-0 text-brand-700"/><span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{fileName}</span></div><button className="rounded-lg p-1 text-slate-400 hover:bg-white" title="Choose another workbook" onClick={()=>{setFileName('');setSheets([]);setResult(null)}}><X size={15}/></button></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>Workbook sheet</Label><Select value={sheetName} onChange={e=>chooseSheet(e.target.value)}>{sheets.map(s=><option key={s.name} value={s.name}>{s.name} ({s.rows.length} rows)</option>)}</Select></div><div><Label>Import this sheet as</Label><Select value={kind} onChange={e=>changeKind(e.target.value as ImportKind)}><option value="closing">Closing stock snapshot</option><option value="sale">Historical sales</option><option value="purchase">Historical purchases</option><option value="product">Product master</option></Select></div></div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-800"><div className="flex gap-2"><Info size={15} className="mt-0.5 shrink-0"/><div>{kind==='closing'?'Closing-sheet quantities replace the current stock snapshot and create an auditable inventory adjustment. Verify the as-of date and quantities before proceeding.':kind==='sale'?'Historical sales are imported for reference only. They do not reduce today’s stock and do not create customer credit or payment entries. Customer names, if mapped, remain an unallocated historical label. If you map Amount without Rate, the importer treats Amount as GST-inclusive to derive a unit rate; verify this convention against the sheet before commit.':kind==='purchase'?'Historical purchases are imported for reference only. They do not add today’s stock and do not create supplier balances or payments.':'Product rows update or create catalog fields; use the Closing Stock sheet separately to set verified on-hand quantities.'}</div></div></div>
        <div className="space-y-3"><div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Map Excel columns <span className="font-normal text-slate-400">· blank means not imported</span></div><div className="grid grid-cols-2 gap-2">{fields.map(field=><div key={field}><Label className="mb-1 text-[10px]">{fieldLabels[field]}</Label><Select value={mapping[field]||''} onChange={e=>setMapping({...mapping,[field]:e.target.value})} className="h-9 text-xs"><option value="">— Not mapped —</option>{headers.map((h,i)=><option key={`${h}-${i}`} value={h}>{h}</option>)}</Select></div>)}</div></div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"><div className="text-xs text-slate-500">Header row {activeSheet?.headerRow||headerRow} · {activeSheet?.rows.length??0} data rows found</div><Badge tone={validCount===mappedRows.length&&mappedRows.length?'green':'amber'} className="ml-auto">{validCount}/{mappedRows.length} valid</Badge></div>
        <div className="max-h-48 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full min-w-[560px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-50 text-slate-400 dark:bg-slate-900"><tr><th className="px-3 py-2">Excel row</th><th className="px-2 py-2">Product</th><th className="px-2 py-2 text-right">Qty / stock</th><th className="px-2 py-2 text-right">Rate / amount</th><th className="px-3 py-2">Validation</th></tr></thead><tbody>{mappedRows.slice(0,12).map((r,i)=>{const rowError=errors[i]?.missing||[];const isDuplicate=duplicateRows.has(r.rowNumber);return <tr key={r.rowNumber} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2 text-slate-400">{r.rowNumber}</td><td className="max-w-[150px] truncate px-2 py-2 font-medium text-slate-700 dark:text-slate-200">{r.mapped.product_name||'—'}</td><td className="px-2 py-2 text-right">{r.mapped.quantity??'—'}</td><td className="px-2 py-2 text-right">{r.mapped.rate??r.mapped.amount??'—'}</td><td className="px-3 py-2">{rowError.length?<span className="text-rose-600">Missing {rowError.join(', ')}</span>:isDuplicate?<span className="text-amber-700">Possible duplicate</span>:<span className="text-emerald-700">Ready</span>}</td></tr>})}</tbody></table>{mappedRows.length>12&&<div className="bg-slate-50 px-3 py-2 text-center text-[10px] text-slate-400 dark:bg-slate-900">Showing first 12 of {mappedRows.length} rows</div>}</div>
        {unmatched.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800"><div className="flex gap-2 font-semibold"><AlertTriangle size={14}/>Product matches needed ({unmatched.length})</div><div className="mt-1">{unmatched.slice(0,6).join(', ')}{unmatched.length>6?'…':''}. Add or rename these products in Product Master, or correct the workbook mapping before committing.</div></div>}
        {duplicateRows.size>0&&<label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800"><input type="checkbox" checked={allowDuplicates} onChange={e=>setAllowDuplicates(e.target.checked)} className="mt-1"/><span><strong>{duplicateRows.size} possible duplicate row(s) detected.</strong> I reviewed them and confirm these are legitimate distinct entries, not an accidental repeated import.</span></label>}
        {!isSupabaseConfigured&&<div className="text-[11px] text-amber-700">Supabase connection required to stage this file in the business database.</div>}
        {result&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><div className="flex items-center gap-2 font-semibold"><CircleCheck size={15}/>Import summary · {result.sheet_name}</div><div className="mt-1">{result.imported} imported · {result.errors} error(s) · {result.new_products??0} new product(s) · Job {String(result.job_id).slice(0,8)}</div></div>}
        <div className="flex justify-between gap-2 pt-1"><Button variant="outline" onClick={()=>{setFileName('');setSheets([]);setResult(null)}}>Choose another file</Button>{result?.errors>0?<Button disabled={busy} onClick={()=>void retryFailed()}>{busy?<Loader2 size={15} className="animate-spin"/>:<ArrowRight size={14}/>}Retry failed rows</Button>:<Button disabled={busy||hasBlocking||!isSupabaseConfigured||!mappedRows.length||!!result} onClick={()=>void stageAndCommit()}>{busy?<><Loader2 size={15} className="animate-spin"/>Importing…</>:<><Check size={15}/>Stage & commit sheet<ArrowRight size={14}/></>}</Button>}</div>
      </>}
    </div>
  </Dialog>
}
function cellValue(value:any):unknown {if(value===null||value===undefined)return null;if(value instanceof Date)return value.toISOString().slice(0,10);if(typeof value==='object'){if('result'in value)return cellValue(value.result);if('text'in value)return value.text;if('richText'in value)return value.richText.map((v:any)=>v.text).join('');return JSON.stringify(value)}return value}
function normalizeText(value:unknown):string {if(value===null||value===undefined)return '';return String(value).trim()}
function normalizeNumber(value:unknown):number|null {if(value===null||value===undefined||value==='')return null;const cleaned=String(value).replace(/[₹,\s]/g,'');const n=Number(cleaned);return Number.isFinite(n)?n:null}
function normalizeDate(value:unknown):string|null {if(value===null||value===undefined||value==='')return null;if(value instanceof Date)return value.toISOString();const text=String(value).trim();let match=text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);if(match){let [,a,b,c]=match;const year=Number(c.length===2?`20${c}`:c);const month=Number(b);const day=Number(a);const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?d.toISOString():null}const d=new Date(text);return Number.isNaN(d.getTime())?null:d.toISOString()}
function isValidNumber(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0}
