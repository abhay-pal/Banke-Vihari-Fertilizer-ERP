import { useEffect, useMemo, useRef, useState } from 'react'
import { Barcode, Check, ChevronDown, CircleHelp, Minus, Package, Plus, Printer, Search, ShoppingBag, ShoppingCart, Trash2, UserPlus, X } from 'lucide-react'
import { api } from '../lib/services'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogHeader, EmptyState, Input, Label, LoadingState, Select, useToast } from '../components/ui'
import { InvoicePreview, type InvoiceData } from '../components/Invoice'
import { money, number, saleTotals, errorMessage, newIdempotencyKey } from '../lib/utils'
import type { CartItem, Customer, Product } from '../lib/types'

export function POSPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [cash, setCash] = useState('')
  const [upi, setUpi] = useState('')
  const [upiRef, setUpiRef] = useState('')
  const [bank, setBank] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [customerDialog, setCustomerDialog] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [invoiceMode, setInvoiceMode] = useState<'a4' | 'thermal' | 'thermal58'>('a4')
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', village: '', credit_limit: '' })
  const [savingCustomer, setSavingCustomer] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const priceEditable = profile?.role_code === 'owner' || profile?.role_code === 'manager'
  const activeProducts = products.filter(p => p.is_active)
  const filtered = useMemo(() => query.trim() ? activeProducts.filter(p => `${p.name} ${p.sku} ${p.barcode ?? ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [], [activeProducts, query])
  const totals = saleTotals(cart.map(item => ({ quantity: item.quantity, rate: item.rate, discount: item.discount, gstRate: Number(item.product.gst_rate) })))
  const grandTotal = roundMoney(totals.total)
  const paid = roundMoney((Number(cash) || 0) + (Number(upi) || 0) + (Number(bank) || 0))
  const balance = roundMoney(Math.max(0, grandTotal - paid))
  const overpaid = paid > grandTotal + 0.009

  async function loadData() {
    setLoading(true)
    if (!isSupabaseConfigured) { setProducts([]); setCustomers([]); setLoading(false); return }
    try {
      const [productRows, customerRows] = await Promise.all([api.products(), api.customers()])
      setProducts(productRows as Product[]); setCustomers(customerRows as Customer[])
    } catch (e) { toast('Could not load POS data', errorMessage(e), 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadData() }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'F2') { event.preventDefault(); searchRef.current?.focus() }
      if (event.key === 'Enter' && document.activeElement === searchRef.current && filtered[0]) { event.preventDefault(); addProduct(filtered[0]) }
      if (event.altKey && event.key === 'Enter') { event.preventDefault(); void saveSale() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  function addProduct(product: Product) {
    if (Number(product.current_stock) <= 0) { toast('Out of stock', `${product.name} has no available stock.`, 'error'); return }
    setCart(prev => {
      const found = prev.find(item => item.product.id === product.id)
      if (found) {
        if (found.quantity + 1 > Number(product.current_stock)) { toast('Insufficient stock', `Only ${number(product.current_stock)} ${product.sales_unit} available.`, 'error'); return prev }
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { product, quantity: 1, rate: Number(product.selling_price), discount: 0 }]
    })
    setQuery(''); searchRef.current?.focus()
  }
  function updateCart(id: string, field: 'quantity' | 'rate' | 'discount', value: number) {
    setCart(prev => prev.map(item => {
      if (item.product.id !== id) return item
      let next = { ...item, [field]: Math.max(0, value) }
      if (field === 'quantity') next.quantity = Math.min(Number(item.product.current_stock), Math.max(.001, value))
      if (field === 'rate' && !priceEditable) return item
      if (field === 'discount') next.discount = Math.min(Math.max(0, value), next.quantity * next.rate)
      return next
    }))
  }
  function setQuickPayment(method: 'cash' | 'upi' | 'credit') {
    if (method === 'cash') { setCash(String(grandTotal)); setUpi(''); setBank('') }
    else if (method === 'upi') { setCash(''); setUpi(String(grandTotal)); setBank('') }
    else { setCash(''); setUpi(''); setBank('') }
  }
  async function addCustomer(event: React.FormEvent) {
    event.preventDefault(); setSavingCustomer(true)
    try {
      const row = await api.saveCustomer({ name: newCustomer.name, mobile: newCustomer.mobile || null, village: newCustomer.village || null, credit_limit: Number(newCustomer.credit_limit || 0) })
      await loadData(); setCustomerId(row.id); setCustomerDialog(false); setNewCustomer({ name: '', mobile: '', village: '', credit_limit: '' }); toast('Customer added', `${row.name} is ready for this bill.`)
    } catch (e) { toast('Could not add customer', errorMessage(e), 'error') }
    finally { setSavingCustomer(false) }
  }
  async function saveSale() {
    if (!cart.length) { toast('Cart is empty', 'Add at least one product to create a bill.', 'error'); return }
    if (!isSupabaseConfigured) { toast('Database setup required', 'Connect Supabase to save a real sale.', 'info'); return }
    if (balance > 0.009 && !customerId) { toast('Choose a customer', 'A customer is required when the bill has a pending balance.', 'error'); return }
    if (overpaid) { toast('Payment exceeds bill total', 'Split payment amounts cannot be greater than the invoice total.', 'error'); return }
    for (const item of cart) {
      if (item.quantity <= 0 || item.quantity > Number(item.product.current_stock)) { toast('Check quantity', `${item.product.name} has only ${number(item.product.current_stock)} ${item.product.sales_unit} available.`, 'error'); return }
      if (item.rate < 0) { toast('Invalid rate', 'Selling rate cannot be negative.', 'error'); return }
    }
    setSaving(true)
    try {
      const payments = [
        { method: 'cash' as const, amount: Number(cash) || 0 },
        { method: 'upi' as const, amount: Number(upi) || 0, reference: upiRef.trim() || undefined },
        { method: 'bank' as const, amount: Number(bank) || 0 },
      ].filter(p => p.amount > 0)
      const result = await api.createSale({
        customer_id: customerId || null,
        due_date: dueDate || null,
        idempotency_key: newIdempotencyKey(),
        items: cart.map(item => ({ product_id: item.product.id, quantity: item.quantity, unit_price: item.rate, discount: item.discount })),
        payments,
      })
      const customer = customers.find(c => c.id === customerId)
      setInvoice({
        invoice_number: result.invoice_number,
        sold_at: result.sold_at || new Date().toISOString(),
        customer: customer ? { name: customer.name, mobile: customer.mobile || undefined, village: customer.village || undefined } : null,
        items: cart.map(item => ({ product_name: item.product.name, quantity: item.quantity, unit: item.product.sales_unit, unit_price: item.rate, discount: item.discount, gst_rate: Number(item.product.gst_rate), line_total: roundMoney(item.quantity * item.rate - item.discount + (item.quantity * item.rate - item.discount) * Number(item.product.gst_rate) / 100) })),
        subtotal: result.subtotal ?? totals.subtotal,
        discount_total: result.discount_total ?? totals.discount,
        gst_amount: result.gst_amount ?? totals.tax,
        total: result.total ?? grandTotal,
        amount_paid: result.amount_paid ?? paid,
        balance_due: result.balance_due ?? balance,
        payment_methods: payments.map(p => p.method),
      })
      setCart([]); setCustomerId(''); setCash(''); setUpi(''); setUpiRef(''); setBank(''); setDueDate('')
      await loadData()
      toast('Sale saved', `Invoice ${result.invoice_number} has been posted and stock updated.`)
    } catch (e) { toast('Sale was not saved', errorMessage(e), 'error') }
    finally { setSaving(false) }
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="eyebrow">Point of sale · fast billing</div><h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">New sale</h1><p className="mt-1 text-sm text-slate-500">Search, scan or select products; stock is validated again when the sale posts.</p></div><div className="flex flex-wrap gap-2"><div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"><kbd className="rounded border px-1.5 py-0.5">F2</kbd> Search <span className="mx-1">·</span><kbd className="rounded border px-1.5 py-0.5">Alt ↵</kbd> Save</div><Button variant="outline" size="sm" onClick={() => setInvoice(null)}><ShoppingBag size={15}/>New bill</Button></div></div>
    {!isSupabaseConfigured && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><strong>Read-only setup preview:</strong> product/customer search and posting become live after Supabase is configured. No sample items are loaded.</div>}
    {loading ? <div className="panel"><LoadingState label="Loading products and customers…"/></div> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(350px,.82fr)]">
      <div className="space-y-4">
        <Card className="overflow-visible"><CardHeader className="pb-3"><div><CardTitle>Find a product</CardTitle><p className="mt-1 text-xs text-slate-400">Search by product name, SKU or barcode</p></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30"><Barcode size={18}/></div></CardHeader><CardContent className="pt-1">
          <div className="relative"><Search size={17} className="absolute left-3.5 top-3.5 text-slate-400"/><Input ref={searchRef} autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a name, SKU or scan barcode…" className="h-12 pl-10 pr-16 text-sm"/><kbd className="absolute right-3 top-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800">F2</kbd>
            {query.trim() && <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#17231d]">{filtered.length ? filtered.map(product => <button key={product.id} onClick={() => addProduct(product)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-brand-50 dark:border-slate-800 dark:hover:bg-brand-900/20"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-800"><Package size={18}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-800 dark:text-white">{product.name}</div><div className="mt-0.5 truncate text-[10px] text-slate-400">{product.sku || 'No SKU'} · {product.category?.name || 'Uncategorized'} · Stock {number(product.current_stock)} {product.sales_unit}</div></div><div className="text-right"><div className="text-sm font-bold text-slate-800 dark:text-white">{money(product.selling_price)}</div><div className="text-[10px] text-brand-700">Add <Plus size={11} className="inline"/></div></div></button>) : <div className="px-4 py-7 text-center text-xs text-slate-400">{isSupabaseConfigured ? 'No active product matches that search.' : 'Connect the database to load your products.'}</div>}</div>}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>{activeProducts.length} active products loaded</span><span>Enter to add the top result</span></div>
        </CardContent></Card>
        <Card><CardHeader><div><CardTitle>Items in this bill <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{cart.length}</span></CardTitle><p className="mt-1 text-xs text-slate-400">Edit quantity and discount; price changes are permission-controlled.</p></div><Button variant="ghost" size="sm" disabled={!cart.length} onClick={() => setCart([])}><Trash2 size={14}/>Clear</Button></CardHeader><CardContent className="pt-3">
          {cart.length ? <div className="overflow-x-auto"><table className="w-full min-w-[570px] text-left"><thead><tr className="table-head border-b border-slate-100 dark:border-slate-800"><th className="pb-3 pl-1">Product</th><th className="w-[92px] pb-3 text-center">Qty</th><th className="w-[102px] pb-3 text-right">Rate</th><th className="w-[95px] pb-3 text-right">Discount</th><th className="w-[102px] pb-3 pr-1 text-right">Total</th><th className="w-8"/></tr></thead><tbody>{cart.map(item => { const base = Math.max(0, item.quantity * item.rate - item.discount); const total = base * (1 + Number(item.product.gst_rate) / 100); return <tr key={item.product.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/70"><td className="py-3 pl-1"><div className="max-w-[200px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{item.product.name}</div><div className="mt-1 text-[10px] text-slate-400">{item.product.sku || 'No SKU'} · GST {number(item.product.gst_rate,0)}%</div></td><td className="py-3"><div className="flex items-center justify-center gap-1"><button onClick={() => item.quantity <= 1 ? setCart(cart.filter(i => i.product.id !== item.product.id)) : updateCart(item.product.id, 'quantity', item.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Minus size={12}/></button><input aria-label={`Quantity for ${item.product.name}`} type="number" min="0.001" step="any" max={item.product.current_stock} value={item.quantity} onChange={e => updateCart(item.product.id, 'quantity', Number(e.target.value))} className="w-12 border-0 bg-transparent p-0 text-center text-xs font-semibold outline-none"/><button onClick={() => updateCart(item.product.id, 'quantity', item.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Plus size={12}/></button></div><div className="mt-1 text-center text-[9px] text-slate-400">{item.product.sales_unit}</div></td><td className="py-3 text-right"><input aria-label={`Rate for ${item.product.name}`} type="number" min="0" step="0.01" value={item.rate} disabled={!priceEditable} onChange={e => updateCart(item.product.id, 'rate', Number(e.target.value))} className="h-8 w-[88px] rounded-lg border border-slate-200 bg-white px-2 text-right text-xs disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"/></td><td className="py-3 text-right"><input aria-label={`Discount for ${item.product.name}`} type="number" min="0" step="0.01" value={item.discount || ''} onChange={e => updateCart(item.product.id, 'discount', Number(e.target.value))} className="h-8 w-[80px] rounded-lg border border-slate-200 bg-white px-2 text-right text-xs dark:border-slate-700 dark:bg-slate-900" placeholder="0"/></td><td className="py-3 pr-1 text-right"><div className="text-xs font-bold text-slate-800 dark:text-slate-100">{money(total)}</div><div className="text-[9px] text-slate-400">incl. tax</div></td><td className="py-3 text-right"><button aria-label="Remove item" onClick={() => setCart(cart.filter(i => i.product.id !== item.product.id))} className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"><X size={15}/></button></td></tr>})}</tbody></table></div> : <EmptyState title="Your bill is empty" description="Search or scan a product above to add the first item." icon={<ShoppingCart size={28}/>} />}
        </CardContent></Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-[88px]">
        <Card><CardHeader><div><CardTitle>Customer</CardTitle><p className="mt-1 text-xs text-slate-400">Walk-in billing or select a customer for Udhar</p></div><button title="Add customer" onClick={() => setCustomerDialog(true)} className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-200"><UserPlus size={17}/></button></CardHeader><CardContent className="space-y-2"><Select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Walk-in Customer</option>{customers.filter(c => c.is_active).map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.mobile ? ` · ${customer.mobile}` : ''}{Number(customer.outstanding_balance) ? ` · Due ${money(customer.outstanding_balance)}` : ''}</option>)}</Select>{customerId && <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70"><div className="text-[11px] text-slate-500">Current balance</div><div className="text-xs font-bold text-amber-700">{money(customers.find(c => c.id === customerId)?.outstanding_balance)}</div></div>}</CardContent></Card>
        <Card><CardHeader><div><CardTitle>Payment</CardTitle><p className="mt-1 text-xs text-slate-400">Split cash, UPI, bank and balance due</p></div></CardHeader><CardContent className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-2"><Button variant="outline" size="sm" onClick={() => setQuickPayment('cash')} disabled={!cart.length}>Full cash</Button><Button variant="outline" size="sm" onClick={() => setQuickPayment('upi')} disabled={!cart.length}>Full UPI</Button><Button variant="outline" size="sm" onClick={() => setQuickPayment('credit')} disabled={!cart.length}>Full credit</Button></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Cash received</Label><Input type="number" min="0" step="0.01" inputMode="decimal" value={cash} onChange={e => setCash(e.target.value)} placeholder="₹ 0.00"/></div><div><Label>UPI received</Label><Input type="number" min="0" step="0.01" inputMode="decimal" value={upi} onChange={e => setUpi(e.target.value)} placeholder="₹ 0.00"/></div></div>
          {Number(upi) > 0 && <div><Label>UPI transaction reference <span className="font-normal text-slate-400">(optional)</span></Label><Input value={upiRef} onChange={e => setUpiRef(e.target.value)} placeholder="UTR / transaction ID"/></div>}
          <div><Label>Bank / other received</Label><Input type="number" min="0" step="0.01" value={bank} onChange={e => setBank(e.target.value)} placeholder="₹ 0.00"/></div>
          {balance > 0 && <div><Label>Optional due date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></div>}
          <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800"><div className="flex justify-between text-xs text-slate-500"><span>Subtotal before discount</span><span>{money(totals.subtotal)}</span></div>{totals.discount > 0 && <div className="flex justify-between text-xs text-slate-500"><span>Discount</span><span>− {money(totals.discount)}</span></div>}<div className="flex justify-between text-xs text-slate-500"><span>GST / tax</span><span>{money(totals.tax)}</span></div><div className="flex justify-between pt-1 text-sm font-bold text-slate-900 dark:text-white"><span>Bill total</span><span>{money(grandTotal)}</span></div><div className="flex justify-between text-xs text-emerald-700"><span>Paid now</span><span>{money(paid)}</span></div><div className="flex justify-between text-sm font-bold text-amber-700"><span>Pending / Udhar</span><span>{money(balance)}</span></div></div>
          {overpaid && <div className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-700">Payment amount is more than the bill total.</div>}
          {balance > 0 && !customerId && <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">Select a customer before saving a bill with credit.</div>}
          <Button size="lg" className="w-full" disabled={saving || !cart.length || overpaid || (balance > 0 && !customerId) || !isSupabaseConfigured} onClick={() => void saveSale()}>{saving ? <span className="animate-spin">◌</span> : <Check size={17}/>}Save sale & print bill</Button>
          {!isSupabaseConfigured && <p className="text-center text-[10px] text-slate-400">Live database connection required to post invoices.</p>}
        </CardContent></Card>
      </div>
    </div>}

    <Dialog open={customerDialog} onOpenChange={setCustomerDialog}><DialogHeader title="Add a customer" description="Save the customer's details without leaving the bill."/><form onSubmit={addCustomer} className="space-y-4 p-6"><div><Label>Name</Label><Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} required autoFocus/></div><div className="grid grid-cols-2 gap-3"><div><Label>Mobile</Label><Input value={newCustomer.mobile} onChange={e => setNewCustomer({ ...newCustomer, mobile: e.target.value })} inputMode="tel" maxLength={15}/></div><div><Label>Village</Label><Input value={newCustomer.village} onChange={e => setNewCustomer({ ...newCustomer, village: e.target.value })}/></div></div><div><Label>Credit limit <span className="font-normal text-slate-400">(₹, optional)</span></Label><Input type="number" min="0" step="1" value={newCustomer.credit_limit} onChange={e => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })} placeholder="0 = no limit set"/></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setCustomerDialog(false)}>Cancel</Button><Button disabled={savingCustomer || !isSupabaseConfigured}>{savingCustomer ? 'Saving…' : 'Save customer'}</Button></div></form></Dialog>
    <Dialog open={Boolean(invoice)} onOpenChange={open => !open && setInvoice(null)}><DialogHeader title="Sale complete" description={invoice?.invoice_number ? `Invoice ${invoice.invoice_number} was posted successfully.` : 'Your sale is saved.'}/><div className="p-5 sm:p-6">{invoice && <InvoicePreview invoice={invoice} mode={invoiceMode} setMode={setInvoiceMode}/>}</div></Dialog>
  </div>
}
function roundMoney(value: number) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100 }
