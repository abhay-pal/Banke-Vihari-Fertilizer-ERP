import { Download, MessageCircle, Printer } from 'lucide-react'
import { Button } from './ui'
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
  const printInvoice = (saveAsPdf = false) => {
    const invoiceElement = document.getElementById('invoice-print')
    if (!invoiceElement) return
    const popup = window.open('', '_blank', 'width=900,height=950')
    if (!popup) { window.alert('Please allow pop-ups to print the invoice.'); return }
    const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'))
      .map(node => node.outerHTML).join('\\n')
    const thermal = mode === 'thermal'
    popup.document.open()
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number || ''}</title>${styles}
      <style>
        html,body{margin:0!important;padding:0!important;background:white!important;color:#0f172a!important}
        #invoice-print{position:static!important;display:block!important;visibility:visible!important;box-shadow:none!important;border:0!important;border-radius:0!important;width:100%!important;max-width:none!important;margin:0!important;padding:${thermal ? '3mm' : '9mm'}!important;box-sizing:border-box!important}
        #invoice-print *{visibility:visible!important}
        table{width:100%!important;border-collapse:collapse!important}
        tr{break-inside:avoid}
        @page{size:${thermal ? '80mm auto' : 'A4'};margin:${thermal ? '2mm' : '6mm'}}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>${invoiceElement.outerHTML}</body></html>`)
    popup.document.close()
    popup.onload = () => { popup.focus(); popup.print() }
    // Browser print dialog lets the user choose a physical printer or Save as PDF.
    // The save button explains the correct destination rather than silently printing.
  }
  const share = () => {
    const text = `Namaste${invoice.customer?.name ? ` ${invoice.customer.name}` : ''}, your bill ${invoice.invoice_number || ''} from ${businessName} is ${money(invoice.total)}. Paid: ${money(invoice.amount_paid)}. Balance: ${money(invoice.balance_due)}.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }
  return <div>
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        Print paper
        <select aria-label="Select bill paper size" value={mode} onChange={event => setMode?.(event.target.value as 'a4' | 'thermal')} disabled={!setMode} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
          <option value="a4">A4 paper</option>
          <option value="thermal">80mm Thermal</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={share}><MessageCircle size={14}/>WhatsApp</Button>
        <Button variant="outline" size="sm" onClick={() => printInvoice(true)}><Download size={14}/>Save / Download PDF</Button>
        <Button size="sm" onClick={() => printInvoice(false)}><Printer size={14}/>Print Bill</Button>
      </div>
    </div>
    <p className="no-print mb-3 text-xs text-slate-500">Selected paper: {mode === 'a4' ? 'A4' : '80mm thermal'}. For PDF download, choose “Save as PDF” as the destination in the browser dialog.</p>
    <div id="invoice-print" className={`invoice-paper ${mode === 'thermal' ? 'thermal' : ''} rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-8`}>
      <div className="flex items-start justify-between gap-4 border-b-2 border-emerald-700 pb-5">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">Agricultural supplies • Retail invoice</div>
          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-900">{businessName}</h1>
          <div className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-600">{address}</div>
          {business?.phone && <div className="text-xs text-slate-600">Phone: {business.phone}</div>}
          {business?.gstin && <div className="text-xs font-medium text-slate-700">GSTIN: {business.gstin}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-black uppercase tracking-wider text-emerald-800">Invoice</div>
          <div className="mt-2 text-xs text-slate-500">Invoice number</div>
          <div className="font-bold text-slate-900">{invoice.invoice_number || 'Draft'}</div>
          <div className="mt-1 text-xs text-slate-600">{formatDate(invoice.sold_at || new Date().toISOString())}</div>
          <div className="mt-3 inline-block rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold uppercase">{Number(invoice.balance_due || 0) > 0 ? 'Payment pending' : 'Paid'}</div>
        </div>
      </div>
      <div className="my-5 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-xs">
        <div><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Bill to</div><div className="font-bold text-slate-900">{invoice.customer?.name || 'Walk-in Customer'}</div><div className="mt-1 whitespace-pre-line text-slate-600">{[invoice.customer?.mobile,invoice.customer?.village,invoice.customer?.address].filter(Boolean).join(' • ')}</div>{invoice.customer?.gstin && <div className="mt-1">GSTIN: {invoice.customer.gstin}</div>}</div>
        <div className="text-right"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment details</div><div className="font-semibold capitalize">{invoice.payment_methods?.join(' + ') || 'Not specified'}</div><div className="mt-1 text-slate-600">Currency: INR</div></div>
      </div>
      <table className="w-full border-collapse text-left text-xs">
        <thead><tr className="border-y-2 border-slate-800 bg-slate-100 text-[10px] font-bold uppercase text-slate-700"><th className="p-2">#</th><th className="p-2">Product / Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">GST</th><th className="p-2 text-right">Amount</th></tr></thead>
        <tbody>{lines.map((item,index)=><tr key={index} className="border-b border-slate-200"><td className="p-2 align-top">{index+1}</td><td className="p-2 align-top"><div className="font-semibold">{item.product_name}</div>{Number(item.discount)>0 && <div className="text-[10px] text-slate-500">Discount: {money(item.discount)}</div>}</td><td className="p-2 text-right align-top">{number(item.quantity)} {item.unit||''}</td><td className="p-2 text-right align-top">{money(item.unit_price)}</td><td className="p-2 text-right align-top">{Number(item.gst_rate||0)}%</td><td className="p-2 text-right align-top font-semibold">{money(item.line_total)}</td></tr>)}</tbody>
      </table>
      <div className="mt-5 flex justify-end"><div className="w-full max-w-[300px] space-y-2 text-xs">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
        {Number(invoice.discount_total)>0 && <div className="flex justify-between"><span>Discount</span><span>− {money(invoice.discount_total)}</span></div>}
        <div className="flex justify-between"><span>GST total</span><span>{money(invoice.gst_amount)}</span></div>
        <div className="flex justify-between border-t-2 border-emerald-700 pt-2 text-base font-black"><span>Grand total</span><span>{money(invoice.total)}</span></div>
        <div className="flex justify-between text-emerald-800"><span>Received</span><span>{money(invoice.amount_paid)}</span></div>
        <div className="flex justify-between rounded-md bg-slate-100 p-2 font-bold"><span>Udhar / Balance due</span><span>{money(invoice.balance_due)}</span></div>
      </div></div>
      <div className="mt-12 flex items-end justify-between gap-4 border-t border-slate-200 pt-4 text-[10px] text-slate-600"><div><div className="font-bold text-slate-800">Thank you for shopping with us!</div><div>Goods once sold are subject to applicable shop policy.</div><div className="mt-1">Computer-generated invoice</div></div><div className="border-t border-slate-500 px-4 pt-1 text-right">Authorized signature</div></div>
    </div>

  </div>
}
