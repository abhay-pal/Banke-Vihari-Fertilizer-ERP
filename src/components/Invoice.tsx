import { Download, MessageCircle, Printer } from 'lucide-react'
import { Button, Badge } from './ui'
import { formatDate, money, number } from '../lib/utils'

export interface InvoiceData {
  invoice_number?: string
  sold_at?: string
  customer?: { name?: string; mobile?: string; village?: string; address?: string; gstin?: string } | null
  items?: Array<{ product_name?: string; quantity: number; unit?: string; unit_price: number; discount?: number; gst_rate?: number; gst_amount?: number; line_total?: number }>
  subtotal?: number
  discount_total?: number
  gst_amount?: number
  total?: number
  amount_paid?: number
  balance_due?: number
  payment_methods?: string[]
  status?: string
}

export function InvoicePreview({ invoice, business, mode = 'a4', setMode }: { invoice: InvoiceData; business?: any; mode?: 'a4' | 'thermal'; setMode?: (mode: 'a4' | 'thermal') => void }) {
  const lines = invoice.items ?? []
  const address = business?.address || 'Business address not set'
  const businessName = business?.name || 'Banke Vihari Fertilizer'
  const share = () => {
    const text = `Namaste${invoice.customer?.name ? ` ${invoice.customer.name}` : ''}, your bill ${invoice.invoice_number || ''} from ${businessName} is ${money(invoice.total)}. Paid: ${money(invoice.amount_paid)}. Balance: ${money(invoice.balance_due)}.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }
  return <div>
    <div className="no-print mb-4 flex items-center justify-between gap-2"><div className="flex gap-2">{setMode && <><Button variant={mode === 'a4' ? 'secondary' : 'outline'} size="sm" onClick={() => setMode('a4')}>A4</Button><Button variant={mode === 'thermal' ? 'secondary' : 'outline'} size="sm" onClick={() => setMode('thermal')}>Thermal</Button></>}</div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={share}><MessageCircle size={14}/>WhatsApp</Button><Button size="sm" onClick={() => window.print()}><Printer size={14}/>Print / Save PDF</Button></div></div>
    <div id="invoice-print" className={`invoice-paper ${mode === 'thermal' ? 'thermal' : ''} rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8`}>
      <div className="flex items-start justify-between gap-5 border-b border-slate-200 pb-5"><div><div className="text-xl font-bold tracking-tight text-brand-700">{businessName}</div><div className="mt-2 max-w-xs whitespace-pre-line text-xs leading-5 text-slate-500">{address}</div>{business?.phone && <div className="mt-1 text-xs text-slate-500">Phone: {business.phone}</div>}{business?.gstin && <div className="mt-1 text-xs text-slate-500">GSTIN: {business.gstin}</div>}</div><div className="text-right"><Badge tone={invoice.balance_due && Number(invoice.balance_due) > 0 ? 'amber' : 'green'}>{invoice.balance_due && Number(invoice.balance_due) > 0 ? 'BALANCE DUE' : 'PAID'}</Badge><div className="mt-3 text-xs text-slate-500">Invoice no.</div><div className="text-base font-bold">{invoice.invoice_number || 'Draft'}</div><div className="mt-1 text-xs text-slate-500">{formatDate(invoice.sold_at || new Date().toISOString())}</div></div></div>
      <div className="grid grid-cols-2 gap-4 py-5"><div><div className="eyebrow">Bill to</div><div className="mt-1 text-sm font-semibold">{invoice.customer?.name || 'Walk-in Customer'}</div><div className="mt-1 text-xs leading-5 text-slate-500">{invoice.customer?.mobile || ''}{invoice.customer?.village ? ` · ${invoice.customer.village}` : ''}{invoice.customer?.address ? `\n${invoice.customer.address}` : ''}</div>{invoice.customer?.gstin && <div className="mt-1 text-xs text-slate-500">GSTIN: {invoice.customer.gstin}</div>}</div><div className="text-right"><div className="eyebrow">Payment method</div><div className="mt-1 text-xs font-medium capitalize">{invoice.payment_methods?.join(' + ') || 'Unverified historical sale'}</div></div></div>
      <div className="overflow-hidden rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Item</th><th className="px-2 py-2.5 text-right">Qty</th><th className="px-2 py-2.5 text-right">Rate</th><th className="px-2 py-2.5 text-right">Tax</th><th className="px-3 py-2.5 text-right">Amount</th></tr></thead><tbody>{lines.map((item, index) => <tr key={index} className="border-t border-slate-100"><td className="px-3 py-3"><div className="font-medium">{item.product_name}</div>{Number(item.discount) > 0 && <div className="mt-0.5 text-[10px] text-slate-400">Discount {money(item.discount)}</div>}</td><td className="px-2 py-3 text-right">{number(item.quantity)} {item.unit || ''}</td><td className="px-2 py-3 text-right">{money(item.unit_price)}</td><td className="px-2 py-3 text-right">{Number(item.gst_rate ?? 0)}%</td><td className="px-3 py-3 text-right font-medium">{money(item.line_total)}</td></tr>)}</tbody></table></div>
      <div className="ml-auto mt-5 w-full max-w-[260px] space-y-2 text-xs"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>{Number(invoice.discount_total) > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>− {money(invoice.discount_total)}</span></div>}<div className="flex justify-between text-slate-500"><span>GST</span><span>{money(invoice.gst_amount)}</span></div><div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold"><span>Total</span><span>{money(invoice.total)}</span></div><div className="flex justify-between text-emerald-700"><span>Amount paid</span><span>{money(invoice.amount_paid)}</span></div><div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-rose-700"><span>Balance due</span><span>{money(invoice.balance_due)}</span></div></div>
      <div className="mt-8 border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">Thank you for your business. Please keep this invoice for your records.</div>
    </div>
    <style>{`@media print { body * { visibility: hidden !important; } #invoice-print, #invoice-print * { visibility: visible !important; } #invoice-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 12mm !important; } @page { margin: 8mm; } #invoice-print.thermal { width: 78mm !important; padding: 3mm !important; font-size: 10px !important; } }`}</style>
  </div>
}
