import { MasterCsvTools } from '../components/MasterCsvTools'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, Boxes, Filter, Plus, Search, Tag, Upload, X } from 'lucide-react'
import { api } from '../lib/services'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Product } from '../lib/types'
import { money, number, errorMessage } from '../lib/utils'
import { Badge, Button, Card, Dialog, DialogHeader, EmptyState, Input, Label, LoadingState, Select, useToast } from '../components/ui'
import { ExcelImportWizard } from './ImportWizard'

const emptyProduct = {
  name: '', sku: '', category_id: '', brand: '', manufacturer: '', hsn_code: '', gst_rate: '0', purchase_unit: 'bag', sales_unit: 'bag', pack_size: '', opening_stock: '0', min_stock: '0', purchase_price: '0', selling_price: '0', barcode: '', batch_tracking: false, expiry_tracking: false, is_active: true,
}
export function ProductsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'inactive'>('all')
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<any>({ ...emptyProduct })
  const [saving, setSaving] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const canManage = profile?.role_code === 'owner' || profile?.role_code === 'manager'

  async function load() {
    setLoading(true)
    if (!isSupabaseConfigured) { setProducts([]); setCategories([]); setLoading(false); return }
    try { const [p,c] = await Promise.all([api.managementProducts(), api.categories()]); setProducts(p as Product[]); setCategories(c) }
    catch (e) { toast('Product list could not load', errorMessage(e), 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const shown = useMemo(() => products.filter(p => {
    const match = `${p.name} ${p.sku ?? ''} ${p.barcode ?? ''} ${p.brand ?? ''} ${p.category?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const status = filter === 'all' ? p.is_active : filter === 'inactive' ? !p.is_active : p.is_active && Number(p.min_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock)
    return match && status
  }), [products, search, filter])
  function startCreate() { setEditing(null); setForm({ ...emptyProduct }); setDialog(true) }
  function startEdit(p: Product) { setEditing(p); setForm({ name:p.name,sku:p.sku??'',category_id:p.category_id??'',brand:p.brand??'',manufacturer:p.manufacturer??'',hsn_code:p.hsn_code??'',gst_rate:String(p.gst_rate??0),purchase_unit:p.purchase_unit||'bag',sales_unit:p.sales_unit||'bag',pack_size:p.pack_size??'',opening_stock:String(p.opening_stock??0),min_stock:String(p.min_stock??0),purchase_price:String(p.purchase_price??0),selling_price:String(p.selling_price??0),barcode:p.barcode??'',batch_tracking:!!p.batch_tracking,expiry_tracking:!!p.expiry_tracking,is_active:p.is_active }); setDialog(true) }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true)
    try {
      const result = await api.saveProduct({ ...form, id: editing?.id, category_id: form.category_id || null, opening_stock: editing ? undefined : Number(form.opening_stock), gst_rate:Number(form.gst_rate||0), min_stock:Number(form.min_stock||0), purchase_price:Number(form.purchase_price||0), selling_price:Number(form.selling_price||0) })
      toast(editing ? 'Product updated' : 'Product added', `${result.name} is saved to the product master.`); setDialog(false); await load()
    } catch (e) { toast('Product was not saved', errorMessage(e), 'error') }
    finally { setSaving(false) }
  }
  async function addCategory(event: React.FormEvent) {
    event.preventDefault()
    try { const row = await api.createCategory(categoryName.trim()); await load(); setForm((current:any) => ({ ...current, category_id: row.id })); setCategoryName(''); setCategoryDialog(false); toast('Category added', row.name) }
    catch (e) { toast('Category was not saved', errorMessage(e), 'error') }
  }
  async function exportExcel() {
    if (!products.length) { toast('No products to export', undefined, 'info'); return }
    const ExcelJS = (await import('exceljs')).default
    const book = new ExcelJS.Workbook(); book.creator='Banke Vihari Fertilizer ERP'; const sheet=book.addWorksheet('Products')
    sheet.columns=[{header:'Product Name',key:'name',width:28},{header:'SKU',key:'sku',width:18},{header:'Category',key:'category',width:18},{header:'Brand',key:'brand',width:18},{header:'HSN',key:'hsn',width:15},{header:'GST %',key:'gst',width:10},{header:'Unit',key:'unit',width:12},{header:'Opening Stock',key:'opening',width:16},{header:'Current Stock',key:'stock',width:16},{header:'Min Stock',key:'min',width:14},{header:'Avg Cost',key:'cost',width:14},{header:'Selling Price',key:'price',width:14},{header:'Barcode',key:'barcode',width:18},{header:'Active',key:'active',width:10}]
    sheet.addRows(products.map(p=>({name:p.name,sku:p.sku,category:p.category?.name,brand:p.brand,hsn:p.hsn_code,gst:Number(p.gst_rate),unit:p.sales_unit,opening:Number(p.opening_stock),stock:Number(p.current_stock),min:Number(p.min_stock),cost:Number(p.avg_cost),price:Number(p.selling_price),barcode:p.barcode,active:p.is_active?'Yes':'No'})))
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF087A52'}}
    const buffer=await book.xlsx.writeBuffer(); const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='banke-vihari-products.xlsx'; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="eyebrow">Catalog · price · reorder level</div><h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">Product master</h1><p className="mt-1 text-sm text-slate-500">One clean product list powers bills, purchases and inventory.</p></div><div className="flex flex-wrap gap-2"><MasterCsvTools kind="products" rows={products} canManage={canManage} onImported={load}/><Button onClick={startCreate} disabled={!canManage || !isSupabaseConfigured}><Plus size={16}/>Add product</Button></div></div>
    {!isSupabaseConfigured && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Supabase setup is required to save a live product master. No sample products are shown.</div>}
    <Card><div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product, SKU, barcode or brand…" className="pl-10"/></div><div className="flex items-center gap-2"><Filter size={15} className="text-slate-400"/><Select value={filter} onChange={e=>setFilter(e.target.value as any)} className="w-[160px]"><option value="all">Active products</option><option value="low">Low stock</option><option value="inactive">Inactive</option></Select><Badge tone="gray">{shown.length} items</Badge></div></div>
      {loading ? <LoadingState/> : shown.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50/70 dark:bg-slate-900/40"><tr className="table-head"><th className="px-5 py-3">Product</th><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">Purchase</th><th className="px-3 py-3 text-right">Selling</th><th className="px-3 py-3 text-right">On hand</th><th className="px-3 py-3 text-right">Min. stock</th><th className="px-3 py-3">Tracking</th><th className="px-5 py-3 text-right">Status</th></tr></thead><tbody>{shown.map(p=>{const low=Number(p.min_stock)>0&&Number(p.current_stock)<=Number(p.min_stock);return <tr key={p.id} className="table-row border-t border-slate-100 hover:bg-slate-50/70 dark:hover:bg-slate-800/30"><td className="px-5 py-3.5"><button onClick={()=>startEdit(p)} className="text-left"><div className="text-xs font-semibold text-slate-800 hover:text-brand-700 dark:text-slate-100">{p.name}</div><div className="mt-1 text-[10px] text-slate-400">{p.sku||'No SKU'}{p.brand?` · ${p.brand}`:''}</div></button></td><td className="px-3 py-3.5 text-xs text-slate-500">{p.category?.name||'Uncategorized'}</td><td className="px-3 py-3.5 text-right text-xs text-slate-500">{money(p.purchase_price)}</td><td className="px-3 py-3.5 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{money(p.selling_price)}</td><td className="px-3 py-3.5 text-right"><span className={`text-xs font-semibold ${low?'text-amber-700':'text-slate-700 dark:text-slate-200'}`}>{number(p.current_stock)} <span className="font-normal text-slate-400">{p.sales_unit}</span></span></td><td className="px-3 py-3.5 text-right text-xs text-slate-500">{number(p.min_stock)}</td><td className="px-3 py-3.5"><div className="flex gap-1">{p.batch_tracking&&<Badge tone="blue">Batch</Badge>}{p.expiry_tracking&&<Badge tone="amber">Expiry</Badge>}{!p.batch_tracking&&!p.expiry_tracking&&<span className="text-xs text-slate-300">—</span>}</div></td><td className="px-5 py-3.5 text-right">{!p.is_active?<Badge tone="gray">Inactive</Badge>:low?<Badge tone="amber">Low stock</Badge>:<Badge tone="green">Active</Badge>}</td></tr>})}</tbody></table></div> : <EmptyState title={search?'No products match this search':isSupabaseConfigured?'No products yet':'Live product list is empty'} description={search?'Try searching with another name, SKU or barcode.':isSupabaseConfigured?'Add products to begin billing and inventory tracking.':'Connect Supabase and add your real catalog to begin.'} icon={<Boxes size={30}/>} />}
    </Card>

    <Dialog open={dialog} onOpenChange={setDialog}><DialogHeader title={editing?'Edit product':'Add product'} description="Prices and tax rates use ₹ and percentage values. Opening stock is recorded as a traceable inventory entry."/><form onSubmit={save} className="space-y-4 p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Product name *</Label><Input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. Urea 45 kg"/></div><div><Label>Product code / SKU</Label><Input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="UREA-45"/></div><div><Label>Category</Label><div className="flex gap-1.5"><Select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Uncategorized</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Button type="button" variant="outline" size="icon" title="Add category" disabled={!isSupabaseConfigured||!canManage} onClick={()=>setCategoryDialog(true)}><Plus size={15}/></Button></div></div><div><Label>Brand</Label><Input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})}/></div><div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={e=>setForm({...form,manufacturer:e.target.value})}/></div><div><Label>HSN code</Label><Input value={form.hsn_code} onChange={e=>setForm({...form,hsn_code:e.target.value})}/></div><div><Label>GST rate (%)</Label><Input type="number" min="0" max="100" step="0.01" value={form.gst_rate} onChange={e=>setForm({...form,gst_rate:e.target.value})}/></div><div><Label>Purchase unit</Label><Input value={form.purchase_unit} onChange={e=>setForm({...form,purchase_unit:e.target.value})} placeholder="bag"/></div><div><Label>Sales unit</Label><Input value={form.sales_unit} onChange={e=>setForm({...form,sales_unit:e.target.value})} placeholder="bag"/></div><div><Label>Pack size</Label><Input value={form.pack_size} onChange={e=>setForm({...form,pack_size:e.target.value})} placeholder="45 kg"/></div><div><Label>Barcode</Label><Input value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/></div><div><Label>Purchase price</Label><Input type="number" min="0" step="0.01" value={form.purchase_price} onChange={e=>setForm({...form,purchase_price:e.target.value})}/></div><div><Label>Selling price</Label><Input type="number" min="0" step="0.01" value={form.selling_price} onChange={e=>setForm({...form,selling_price:e.target.value})}/></div>{!editing&&<div><Label>Opening stock</Label><Input type="number" min="0" step="0.001" value={form.opening_stock} onChange={e=>setForm({...form,opening_stock:e.target.value})}/></div>}<div><Label>Minimum stock alert</Label><Input type="number" min="0" step="0.001" value={form.min_stock} onChange={e=>setForm({...form,min_stock:e.target.value})}/></div></div>
      <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-4 dark:border-slate-800"><label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.batch_tracking} onChange={e=>setForm({...form,batch_tracking:e.target.checked})}/>Track batches</label><label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.expiry_tracking} onChange={e=>setForm({...form,expiry_tracking:e.target.checked})}/>Track expiry</label><label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/>Active for billing</label></div>
      {editing&&<div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">Current stock is transaction-controlled. Use Inventory → Stock adjustment to change it; price edits are audited.</div>}
      <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={()=>setDialog(false)}>Cancel</Button><Button disabled={saving||!isSupabaseConfigured||!canManage}>{saving?'Saving…':editing?'Save changes':'Create product'}</Button></div>
    </form></Dialog>
    <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}><DialogHeader title="Add product category" description="Keep products grouped for search and reports."/><form onSubmit={addCategory} className="space-y-4 p-6"><div><Label>Category name</Label><Input autoFocus value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Fertilizer, Seeds, Pesticide…" required/></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setCategoryDialog(false)}>Cancel</Button><Button disabled={!isSupabaseConfigured}>Save category</Button></div></form></Dialog>
    <ExcelImportWizard open={importOpen} onOpenChange={setImportOpen} products={products} afterCommit={load}/>
  </div>
}
