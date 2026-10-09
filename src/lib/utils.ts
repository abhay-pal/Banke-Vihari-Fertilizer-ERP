import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)
}
export function number(value: number | string | null | undefined, decimals = 2) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: decimals }).format(Number.isFinite(amount) ? amount : 0)
}
export function formatDate(value?: string | null, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', options).format(date)
}
export function localDateISO(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10)
}
export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => {
    const v = String(row[h] ?? '')
    return `"${v.replaceAll('"', '""')}"`
  }).join(','))].join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
export function weightedAverageCost(currentQty: number, currentAvgCost: number, incomingQty: number, incomingUnitCost: number) {
  const totalQty = Math.max(0, currentQty) + Math.max(0, incomingQty)
  if (totalQty === 0) return 0
  return ((Math.max(0, currentQty) * Math.max(0, currentAvgCost)) + (Math.max(0, incomingQty) * Math.max(0, incomingUnitCost))) / totalQty
}
export function paymentBalance(total: number, paid: number) {
  const roundedTotal = Math.round((Math.max(0, total) + Number.EPSILON) * 100) / 100
  const roundedPaid = Math.round((Math.max(0, paid) + Number.EPSILON) * 100) / 100
  return { total: roundedTotal, paid: roundedPaid, due: Math.round((Math.max(0, roundedTotal - roundedPaid) + Number.EPSILON) * 100) / 100, overpaid: roundedPaid > roundedTotal + 0.009 }
}
export function saleTotals(items: Array<{ quantity: number; rate: number; discount: number; gstRate?: number }>) {
  const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  return items.reduce((total, item) => {
    const quantity = Math.round((Math.max(0, item.quantity) + Number.EPSILON) * 1000) / 1000
    const rate = Math.round((Math.max(0, item.rate) + Number.EPSILON) * 10000) / 10000
    const gross = cents(quantity * rate)
    const discount = cents(Math.max(0, item.discount))
    const base = cents(Math.max(0, quantity * rate - discount))
    const gst = cents(base * (Number(item.gstRate ?? 0) / 100))
    total.subtotal += gross
    total.discount += discount
    total.taxable += base
    total.tax += gst
    total.total += base + gst
    return total
  }, { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 })
}
