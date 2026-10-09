import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, CircleAlert, Download, Leaf, PackageSearch, Plus, RefreshCw, ShoppingCart, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/services'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Language } from '../lib/i18n'
import { dictionary } from '../lib/i18n'
import { formatDate, localDateISO, money, number, errorMessage } from '../lib/utils'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, LoadingState, Select, useToast } from '../components/ui'
import type { PageKey } from '../lib/types'

const green = '#178d5e'
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,.08)', fontSize: 12 }
type RangeKey = 'today' | 'yesterday' | '7d' | 'thisMonth' | 'lastMonth' | 'custom'

export function Dashboard({ language, onNavigate }: { language: Language; onNavigate: (page: PageKey) => void }) {
  const text = dictionary[language]
  const [range, setRange] = useState<RangeKey>('today')
  const [customFrom, setCustomFrom] = useState(localDateISO())
  const [customTo, setCustomTo] = useState(localDateISO())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { toast } = useToast()
  const today = new Date()
  const period = useMemo(() => {
    const start = new Date(today); const end = new Date(today)
    if (range === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1) }
    if (range === '7d') start.setDate(start.getDate() - 6)
    if (range === 'thisMonth') start.setDate(1)
    if (range === 'lastMonth') { start.setDate(1); start.setMonth(start.getMonth() - 1); end.setDate(0) }
    if (range === 'custom') return { from: customFrom, to: customTo }
    return { from: localDateISO(start), to: localDateISO(end) }
  }, [range, customFrom, customTo])

  async function load() {
    setLoading(true); setError('')
    if (!isSupabaseConfigured) { setData(null); setLoading(false); return }
    try { setData(await api.dashboard(period.from, period.to)) }
    catch (e) { setError(errorMessage(e)); toast('Dashboard could not load', errorMessage(e), 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [period.from, period.to])
  const summary = data?.summary ?? {}
  const missing = !isSupabaseConfigured
  const periodName = range === 'yesterday' ? 'Yesterday' : range === '7d' ? 'Last 7 days' : range === 'thisMonth' ? 'This month' : range === 'lastMonth' ? 'Last month' : range === 'custom' ? 'Selected range' : 'Today'
  const metrics = [
    { label: range === 'today' ? text.todaySales : `Sales · ${periodName}`, value: summary.sales, icon: ShoppingCart, tone: 'green', action: 'sales' as PageKey, hint: 'Gross bill value incl. GST' },
    { label: range === 'today' ? text.cashSales : `Cash · ${periodName}`, value: summary.cash_sales, icon: Wallet, tone: 'blue', action: 'sales' as PageKey, hint: 'Paid in cash' },
    { label: range === 'today' ? text.upiSales : `UPI · ${periodName}`, value: summary.upi_sales, icon: ArrowUpRight, tone: 'violet', action: 'sales' as PageKey, hint: 'UPI collections' },
    { label: range === 'today' ? text.creditSales : `Credit · ${periodName}`, value: summary.credit_sales, icon: ArrowDownRight, tone: 'amber', action: 'customers' as PageKey, hint: 'New outstanding created' },
    { label: text.collectionsToday, value: summary.collections, icon: CircleAlert, tone: 'blue', action: 'collections' as PageKey, hint: 'Customer payments received' },
    { label: text.grossProfit, value: summary.gross_profit, icon: ArrowUpRight, tone: 'green', action: 'reports' as PageKey, hint: 'Revenue excl. GST less COGS' },
    { label: text.monthlySales, value: summary.month_sales, icon: CalendarDays, tone: 'green', action: 'reports' as PageKey, hint: 'Current calendar month' },
    { label: text.monthlyProfit, value: summary.month_profit, icon: ArrowUpRight, tone: 'green', action: 'reports' as PageKey, hint: 'Current month, before expenses' },
    { label: text.customerOutstanding, value: summary.customer_outstanding, icon: CircleAlert, tone: 'amber', action: 'customers' as PageKey, hint: 'Open customer balances' },
    { label: text.supplierOutstanding, value: summary.supplier_outstanding, icon: Wallet, tone: 'rose', action: 'suppliers' as PageKey, hint: 'Open supplier balances' },
    { label: text.inventoryValue, value: summary.inventory_value, icon: PackageSearch, tone: 'blue', action: 'inventory' as PageKey, hint: 'Weighted-average cost' },
    { label: text.lowStock, value: summary.low_stock, icon: PackageSearch, tone: 'amber', action: 'inventory' as PageKey, hint: 'At or below reorder level', count: true },
    { label: text.expiring, value: summary.expiring, icon: CalendarDays, tone: 'rose', action: 'inventory' as PageKey, hint: 'Batch expiry in 90 days', count: true },
    { label: text.expensesToday, value: summary.expenses, icon: Wallet, tone: 'rose', action: 'expenses' as PageKey, hint: 'Operating expenses' },
  ]
  const toneClass: Record<string, string> = { green: 'bg-brand-50 text-brand-700 dark:bg-brand-900/35 dark:text-brand-200', blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200', violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200', rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
  const trend: any[] = data?.daily_sales ?? []
  const topProducts: any[] = data?.top_products ?? []
  const categories: any[] = data?.category_sales ?? []
  const aging: any[] = data?.aging ?? []
  const slow: any[] = data?.slow_moving ?? []

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="eyebrow">Business overview</div><h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">{text.dashboard}</h1><p className="mt-1 text-sm text-slate-500">Your shop at a glance · {formatDate(new Date().toISOString())}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900"><CalendarDays size={15}/><Select aria-label="Dashboard period" value={range} onChange={e => setRange(e.target.value as RangeKey)} className="h-8 w-[135px] border-0 bg-transparent px-1 py-0 text-xs focus:ring-0"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="thisMonth">This month</option><option value="lastMonth">Last month</option><option value="custom">Custom range</option></Select></div>
        {range === 'custom' && <div className="flex items-center gap-1"><Input aria-label="From date" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-10 w-[142px] text-xs"/><span className="text-xs text-slate-400">to</span><Input aria-label="To date" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-10 w-[142px] text-xs"/></div>}
        <Button variant="outline" size="icon" title="Refresh" onClick={() => void load()}><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></Button>
        <Button onClick={() => onNavigate('pos')}><Plus size={16}/>{text.createSale}</Button>
      </div>
    </div>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">Unable to load dashboard data: {error}</div>}
    {missing && <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Leaf size={19}/></div><div><div className="text-sm font-semibold text-amber-900">Connect your live database to begin</div><p className="mt-1 max-w-2xl text-xs leading-5 text-amber-800/80">This workspace is intentionally showing no sample revenue or inventory. Add your Supabase project URL and public anon key, then apply the included migration.</p></div></div><Button variant="outline" size="sm" className="shrink-0 border-amber-300 text-amber-800" onClick={() => onNavigate('settings')}>Open setup guide<ArrowRight size={14}/></Button></div>}

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {metrics.map((metric, i) => { const Icon = metric.icon; return <button key={metric.label} onClick={() => onNavigate(metric.action)} className="panel group min-h-[121px] p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:hover:border-brand-800">
        <div className="flex items-start justify-between gap-2"><div className="eyebrow min-h-7 leading-4">{metric.label}</div><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${toneClass[metric.tone]}`}><Icon size={16}/></span></div>
        <div className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">{loading ? <span className="inline-block h-6 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800"/> : missing ? '—' : metric.count ? number(metric.value, 0) : money(metric.value)}</div>
        <div className="mt-1 truncate text-[10px] text-slate-400">{metric.hint}</div>
      </button> })}
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <Card>
        <CardHeader><div><CardTitle>Daily sales & profit trend</CardTitle><p className="mt-1 text-xs text-slate-400">Sales include GST; profit excludes GST</p></div><Badge tone="green">{formatDate(period.from, { day: '2-digit', month: 'short' })} – {formatDate(period.to, { day: '2-digit', month: 'short' })}</Badge></CardHeader>
        <CardContent className="h-[285px] pl-2 pr-4">{loading ? <LoadingState/> : trend.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 12, right: 8, bottom: 0, left: 3 }}><CartesianGrid stroke="#edf1ef" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }}/><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v >= 1000 ? `₹${Math.round(v/1000)}k` : `₹${v}`} width={45}/><Tooltip formatter={(v: number, name: string) => [money(v), name]} contentStyle={tooltipStyle}/><Bar dataKey="sales" name="Sales" fill="#b5e6cf" radius={[4,4,0,0]} maxBarSize={24}/><Line dataKey="profit" name="Gross profit" stroke={green} strokeWidth={2.5} dot={false}/></ComposedChart></ResponsiveContainer> : <EmptyState title={missing ? 'Live chart will appear here' : 'No sales in this period'} description={missing ? 'Connect Supabase and your saved transactions will populate this chart.' : 'Try a different date range or record your first sale.'} icon={<BarChart3 size={28}/>} />}</CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Cash vs credit</CardTitle><p className="mt-1 text-xs text-slate-400">Sales mix for selected period</p></div></CardHeader>
        <CardContent className="h-[285px]">{loading ? <LoadingState/> : (data?.payment_mix?.length ?? 0) ? <div className="flex h-full items-center"><div className="h-full min-w-0 flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.payment_mix} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={3} stroke="none">{(data.payment_mix as any[]).map((_: any, i: number) => <Cell key={i} fill={['#178d5e','#f4a340','#4f8fd9','#a78bfa'][i % 4]}/>)}</Pie><Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle}/></PieChart></ResponsiveContainer></div><div className="space-y-3 pr-2">{data.payment_mix.map((item: any, i: number) => <div key={item.name} className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ['#178d5e','#f4a340','#4f8fd9','#a78bfa'][i % 4] }}/><div><div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{item.name}</div><div className="text-xs font-bold text-slate-900 dark:text-white">{money(item.value)}</div></div></div>)}</div></div> : <EmptyState title={missing ? 'No live payment data' : 'No recorded sales'} description="Completed cash, UPI and credit activity will be compared here." icon={<Wallet size={28}/>} />}</CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard title="Top selling products" subtitle="Units sold in selected period" loading={loading} data={topProducts} icon={<ShoppingCart size={18}/>}>
        {(rows) => <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}><CartesianGrid stroke="#edf1ef" horizontal={false}/><XAxis type="number" hide/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={108} tick={{ fontSize: 10, fill: '#64748b' }}/><Tooltip formatter={(v: number) => [number(v, 2), 'Units']} contentStyle={tooltipStyle}/><Bar dataKey="quantity" fill={green} radius={[0,5,5,0]} maxBarSize={20}/></BarChart></ResponsiveContainer>}
      </ChartCard>
      <ChartCard title="Category-wise sales" subtitle="Net sales by product category" loading={loading} data={categories} icon={<Leaf size={18}/>}>
        {(rows) => <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}><CartesianGrid stroke="#edf1ef" vertical={false}/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }}/><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₹${Math.round(v/1000)}k`}/><Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle}/><Bar dataKey="sales" fill="#78cba1" radius={[5,5,0,0]} maxBarSize={32}/></BarChart></ResponsiveContainer>}
      </ChartCard>
      <ChartCard title="Outstanding aging" subtitle="Customer balances by age" loading={loading} data={aging} icon={<CircleAlert size={18}/>}>
        {(rows) => <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}><CartesianGrid stroke="#edf1ef" vertical={false}/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }}/><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₹${Math.round(v/1000)}k`}/><Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle}/><Bar dataKey="value" fill="#f4a340" radius={[5,5,0,0]} maxBarSize={38}/></BarChart></ResponsiveContainer>}
      </ChartCard>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><div><CardTitle>Sales vs purchases</CardTitle><p className="mt-1 text-xs text-slate-400">Daily billed amount by transaction date</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate('reports')}>View report<ArrowRight size={14}/></Button></CardHeader><CardContent className="h-[235px] pl-2 pr-4">{loading ? <LoadingState/> : trend.some(d => d.purchase) ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid stroke="#edf1ef" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }}/><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₹${Math.round(v/1000)}k`}/><Tooltip formatter={(v: number) => money(v)} contentStyle={tooltipStyle}/><Line dataKey="sales" name="Sales" stroke={green} strokeWidth={2.5} dot={false}/><Line dataKey="purchase" name="Purchases" stroke="#7c93c4" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer> : <EmptyState title={missing ? 'Data will appear after setup' : 'No purchases to compare'} description="Sales and purchase records will be plotted together for each day." icon={<BarChart3 size={25}/>} />}</CardContent></Card>
      <Card><CardHeader><div><CardTitle>Slow-moving inventory</CardTitle><p className="mt-1 text-xs text-slate-400">On-hand stock with no sale in 60+ days</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate('inventory')}>Inventory<ArrowRight size={14}/></Button></CardHeader><CardContent className="pt-2">{loading ? <LoadingState/> : slow.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{slow.slice(0,5).map((item: any) => <div key={item.name} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 dark:bg-slate-800"><PackageSearch size={17}/></div><div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.name}</div><div className="mt-0.5 text-[10px] text-slate-400">No sale for {number(item.days,0)} days</div></div></div><div className="text-right"><div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{number(item.stock)} units</div><div className="text-[10px] text-slate-400">{money(item.value)}</div></div></div>)}</div> : <EmptyState title={missing ? 'Live stock analysis awaits setup' : 'No slow-moving products'} description="Items without recent sales will be listed here." icon={<PackageSearch size={25}/>} />}</CardContent></Card>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white p-4 dark:border-brand-900 dark:bg-[#17231d]"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"><ShoppingCart size={18}/></div><div><div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ready to serve the next customer?</div><div className="mt-0.5 text-xs text-slate-400">Use the keyboard shortcut <kbd className="rounded border px-1.5 py-0.5 text-[10px]">Alt + N</kbd> to start a sale.</div></div></div><Button onClick={() => onNavigate('pos')}><Plus size={16}/>{text.createSale}</Button></div>
  </div>
}

function ChartCard({ title, subtitle, loading, data, icon, children }: { title: string; subtitle: string; loading: boolean; data: any[]; icon: React.ReactNode; children: (rows: any[]) => React.ReactNode }) {
  return <Card><CardHeader><div><CardTitle>{title}</CardTitle><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div><div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{icon}</div></CardHeader><CardContent className="h-[245px] pl-2 pr-4">{loading ? <LoadingState/> : data.length ? children(data) : <EmptyState title={isSupabaseConfigured ? 'No data in this period' : 'Live data needed'} description={isSupabaseConfigured ? 'There are no transactions to chart yet.' : 'Connect the Supabase database to load saved business activity.'} />}</CardContent></Card>
}
