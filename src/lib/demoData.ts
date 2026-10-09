import { saleTotals, weightedAverageCost } from './utils'
import type { Customer, Product, SaleDraft, Supplier } from './types'

const today = new Date()
const iso = (days = 0) => {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}
const id = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2, 10)}`

let categories = [
  { id: 'cat-fertilizer', name: 'Fertilizer' },
  { id: 'cat-seeds', name: 'Seeds' },
  { id: 'cat-pesticide', name: 'Pesticide' },
  { id: 'cat-tools', name: 'Farm tools' },
]

let products: Product[] = [
  product('prod-urea', 'Urea 45 kg', 'UREA-45', 'Fertilizer', 5, 295, 325, 118, 20, 'bag', '890100100001'),
  product('prod-dap', 'DAP 50 kg', 'DAP-50', 'Fertilizer', 5, 1270, 1360, 42, 12, 'bag', '890100100002'),
  product('prod-npk', 'NPK 20:20:0:13', 'NPK-2020', 'Fertilizer', 12, 1180, 1295, 26, 10, 'bag', '890100100003'),
  product('prod-wheat', 'HD-2967 Wheat Seed 40 kg', 'SEED-WHT-40', 'Seeds', 0, 1420, 1580, 18, 6, 'bag', '890100100004'),
  product('prod-zinc', 'Zinc Sulphate 10 kg', 'ZINC-10', 'Fertilizer', 12, 520, 610, 7, 10, 'bag', '890100100005'),
  product('prod-spray', 'Battery Sprayer 16 L', 'SPRAYER-16', 'Farm tools', 18, 2250, 2799, 4, 2, 'piece', '890100100006'),
]

let customers: Customer[] = [
  { id: 'cust-ram', name: 'Ram Singh', mobile: '9876543210', village: 'Bichpuri', address: 'Bichpuri, Agra', gstin: null, opening_balance: 2200, credit_limit: 15000, outstanding_balance: 5375, last_purchase_at: iso(-1), is_active: true, created_at: iso(-80) },
  { id: 'cust-sita', name: 'Sita Devi', mobile: '9876501234', village: 'Kiraoli', address: 'Kiraoli', gstin: null, opening_balance: 0, credit_limit: 8000, outstanding_balance: 0, last_purchase_at: iso(-2), is_active: true, created_at: iso(-55) },
  { id: 'cust-mohan', name: 'Mohan Lal Traders', mobile: '9988776655', village: 'Fatehpur Sikri', address: 'Main market', gstin: '09AABCM1234A1Z4', opening_balance: 12000, credit_limit: 30000, outstanding_balance: 14240, last_purchase_at: iso(-5), is_active: true, created_at: iso(-120) },
]

let suppliers: Supplier[] = [
  { id: 'sup-iffco', name: 'IFFCO Depot Agra', contact_number: '0562-2401122', address: 'Sikandra Road, Agra', gstin: '09AAACI1681G1Z0', outstanding_balance: 28400, is_active: true },
  { id: 'sup-seed', name: 'Shakti Seeds Distributor', contact_number: '9897001122', address: 'Loha Mandi, Agra', gstin: '09ABGFS7788K1Z8', outstanding_balance: 0, is_active: true },
]

let sales: any[] = [
  sale('sale-1', 'BVF-2026-001', 'cust-ram', -1, [{ product_id: 'prod-dap', quantity: 2, unit_price: 1360, discount: 0 }, { product_id: 'prod-zinc', quantity: 1, unit_price: 610, discount: 30 }], 1200),
  sale('sale-2', 'BVF-2026-002', 'cust-sita', -2, [{ product_id: 'prod-urea', quantity: 4, unit_price: 325, discount: 0 }], 1365),
  sale('sale-3', 'BVF-2026-003', 'cust-mohan', -5, [{ product_id: 'prod-npk', quantity: 5, unit_price: 1295, discount: 250 }], 2500),
]

let purchases: any[] = [
  purchase('pur-1', 'PUR-2026-001', 'sup-iffco', -7, [{ product_id: 'prod-urea', quantity: 60, unit_cost: 295 }, { product_id: 'prod-dap', quantity: 30, unit_cost: 1270 }], 30000),
  purchase('pur-2', 'PUR-2026-002', 'sup-seed', -12, [{ product_id: 'prod-wheat', quantity: 20, unit_cost: 1420 }], 28400),
]

let expenses: any[] = [
  { id: 'exp-1', spent_at: iso(0).slice(0, 10), category: 'Rent', description: 'Shop rent advance', method: 'cash', reference: 'Demo', amount: 4500 },
  { id: 'exp-2', spent_at: iso(-1).slice(0, 10), category: 'Transport', description: 'Local delivery tempo', method: 'upi', reference: 'UPI-DEMO-1', amount: 850 },
]

let payments: any[] = [
  { id: 'pay-1', customer_id: 'cust-ram', direction: 'in', method: 'cash', amount: 1200, reference: 'POS cash', created_at: sales[0].sold_at },
  { id: 'pay-2', customer_id: 'cust-sita', direction: 'in', method: 'upi', amount: 1365, reference: 'UPI demo', created_at: sales[1].sold_at },
  { id: 'pay-3', supplier_id: 'sup-iffco', direction: 'out', method: 'bank', amount: 30000, reference: 'NEFT demo', created_at: purchases[0].purchased_at },
]

function product(id: string, name: string, sku: string, categoryName: string, gst: number, cost: number, price: number, stock: number, min: number, unit: string, barcode: string): Product {
  const category = categories.find(c => c.name === categoryName)!
  return { id, name, sku, category_id: category.id, category, brand: 'Demo Brand', manufacturer: 'Demo Agro', hsn_code: '3101', gst_rate: gst, purchase_unit: unit, sales_unit: unit, pack_size: unit === 'bag' ? 'Standard pack' : null, opening_stock: stock, current_stock: stock, min_stock: min, avg_cost: cost, purchase_price: cost, selling_price: price, barcode, batch_tracking: unit === 'bag', expiry_tracking: true, is_active: true, created_at: iso(-90) }
}

function makeItems(items: Array<{ product_id: string; quantity: number; unit_price?: number; unit_cost?: number; discount?: number }>) {
  return items.map((item, index) => {
    const p = products.find(row => row.id === item.product_id)!
    const rate = item.unit_price ?? item.unit_cost ?? p.selling_price
    const base = item.quantity * rate - (item.discount ?? 0)
    const gst = base * Number(p.gst_rate) / 100
    return { id: id('item'), product_id: p.id, product_name: p.name, quantity: item.quantity, unit: p.sales_unit, unit_price: rate, unit_cost: rate, discount: item.discount ?? 0, gst_rate: p.gst_rate, taxable_amount: base, gst_amount: gst, line_total: base + gst, created_at: iso(-index) }
  })
}

function sale(saleId: string, invoice: string, customerId: string | null, days: number, items: SaleDraft['items'], paid: number) {
  const saleItems = makeItems(items)
  const totals = saleTotals(saleItems.map(item => ({ quantity: item.quantity, rate: item.unit_price, discount: item.discount, gstRate: item.gst_rate })))
  const customer = customers.find(c => c.id === customerId)
  return { id: saleId, invoice_number: invoice, customer_id: customerId, customers: customer ? { name: customer.name, mobile: customer.mobile } : null, sold_at: iso(days), sale_items: saleItems, subtotal: totals.subtotal, discount_total: totals.discount, gst_amount: totals.tax, total: totals.total, amount_paid: paid, balance_due: Math.max(0, totals.total - paid), payment_status: paid >= totals.total ? 'paid' : paid > 0 ? 'partial' : 'credit', status: 'posted', origin: 'erp' }
}

function purchase(purchaseId: string, number: string, supplierId: string, days: number, items: any[], paid: number) {
  const purchaseItems = makeItems(items)
  const total = purchaseItems.reduce((sum, item) => sum + item.line_total, 0)
  const supplier = suppliers.find(s => s.id === supplierId)
  return { id: purchaseId, purchase_number: number, supplier_id: supplierId, suppliers: supplier ? { name: supplier.name } : null, purchased_at: iso(days), purchase_items: purchaseItems, subtotal: total, gst_amount: 0, freight_amount: 0, total, amount_paid: paid, balance_due: Math.max(0, total - paid), payment_status: paid >= total ? 'paid' : 'partial', status: 'posted', inventory_applied: true, origin: 'erp' }
}

function matches(row: Record<string, unknown>, search: string, fields: string[]) {
  const needle = search.trim().toLowerCase()
  return !needle || fields.some(field => String(row[field] ?? '').toLowerCase().includes(needle))
}

export const demoApi = {
  async dashboard() {
    const paidSales = sales.reduce((sum, s) => sum + Number(s.total || 0), 0)
    const collections = payments.filter(p => p.direction === 'in').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const inventoryValue = products.reduce((sum, p) => sum + Number(p.current_stock) * Number(p.avg_cost), 0)
    return {
      summary: { sales: paidSales, cash_sales: 4500, upi_sales: 1365, credit_sales: sales.reduce((s, x) => s + Number(x.balance_due || 0), 0), collections, gross_profit: paidSales * 0.14, month_sales: paidSales, month_profit: paidSales * 0.14 - expenseTotal, customer_outstanding: customers.reduce((s, c) => s + Number(c.outstanding_balance), 0), supplier_outstanding: suppliers.reduce((s, c) => s + Number(c.outstanding_balance), 0), inventory_value: inventoryValue, low_stock: products.filter(p => p.current_stock <= p.min_stock).length, expiring: 3, expenses: expenseTotal },
      daily_sales: Array.from({ length: 7 }, (_, i) => ({ label: iso(i - 6).slice(5, 10), sales: 2600 + i * 780, profit: 400 + i * 120, purchase: i % 2 ? 1800 + i * 500 : 0 })),
      payment_mix: [{ name: 'Cash', value: 4500 }, { name: 'Credit', value: 7200 }, { name: 'UPI', value: 1365 }],
      top_products: products.slice(0, 5).map((p, i) => ({ name: p.name, quantity: 12 - i * 1.5 })),
      category_sales: categories.slice(0, 4).map((c, i) => ({ name: c.name, sales: 9000 - i * 1800 })),
      aging: [{ name: '0-30', value: 6200 }, { name: '31-60', value: 4100 }, { name: '60+', value: 7400 }],
      slow_moving: products.slice(-3).map((p, i) => ({ name: p.name, days: 64 + i * 18, stock: p.current_stock, value: p.current_stock * p.avg_cost })),
    }
  },
  async products(search = '') { return products.filter(p => p.is_active && matches(p as any, search, ['name', 'sku', 'barcode'])) },
  async managementProducts(search = '') { return products.filter(p => matches(p as any, search, ['name', 'sku', 'barcode'])).map(p => ({ ...p, category_name: p.category?.name })) },
  async managementSaleItems(ids: string[]) { return sales.filter(s => ids.includes(s.id)).flatMap(s => s.sale_items.map((item: any) => ({ ...item, sale_id: s.id }))) },
  async categories() { return categories },
  async categoriesList() { return categories },
  async customers(search = '') { return customers.filter(c => matches(c as any, search, ['name', 'mobile', 'village'])) },
  async suppliers(search = '') { return suppliers.filter(s => matches(s as any, search, ['name', 'contact_number'])) },
  async sales() { return sales },
  async purchases() { return purchases },
  async expenses() { return expenses },
  async movements() { return products.map((p, i) => ({ id: `mov-${p.id}`, moved_at: iso(-i), product_id: p.id, products: { name: p.name, sku: p.sku }, quantity_delta: i % 2 ? -2 : 10, movement_type: i % 2 ? 'sale' : 'purchase', reference: 'Demo movement' })) },
  async batches() { return products.filter(p => p.batch_tracking).map((p, i) => ({ id: `batch-${p.id}`, product_id: p.id, products: { name: p.name, sku: p.sku }, batch_number: `BATCH-${100 + i}`, quantity: Math.max(1, p.current_stock / 2), expires_on: iso(35 + i * 28).slice(0, 10) })) },
  async payments() { return payments },
  async paymentRows() { return payments.map(p => ({ ...p, customers: customers.find(c => c.id === p.customer_id), suppliers: suppliers.find(s => s.id === p.supplier_id) })) },
  async cashClosings() { return [] },
  async cashSnapshot() { return { opening_cash: 10000, cash_sales: 4500, cash_collections: 1200, supplier_refunds: 0, cash_purchases: 0, cash_supplier_payments: 0, cash_refunds: 0, cash_expenses: 4500, upi_in: 1365, upi_out: 850, expected_closing: 11200, counted_closing: null, difference: null } },
  async settings() { return { invoice_prefix: 'BVF', low_stock_alert: true, default_payment_terms: 15 } },
  async profiles() { return [{ id: 'demo-owner', full_name: 'Demo Owner', role_code: 'owner', status: 'active', created_at: iso(-60) }, { id: 'demo-cashier', full_name: 'Counter Staff', role_code: 'cashier', status: 'active', created_at: iso(-20) }] },
  async auditLogs() { return [{ id: 'audit-1', created_at: iso(-1), action: 'demo.opened', entity_type: 'preview', actor_name: 'Demo Owner' }] },
  async importJobs() { return [] },
  async customerPayments(customerId: string) { return payments.filter(p => p.customer_id === customerId) },
  async supplierPayments(supplierId: string) { return payments.filter(p => p.supplier_id === supplierId) },
  async customerSales(customerId: string) { return sales.filter(s => s.customer_id === customerId) },
  async supplierPurchases(supplierId: string) { return purchases.filter(p => p.supplier_id === supplierId) },
  async salePayments(saleId: string) { return payments.filter(p => sales.find(s => s.id === saleId)?.customer_id === p.customer_id).map(p => ({ amount: p.amount, payments: { method: p.method, reference: p.reference } })) },
  async purchasePayments(purchaseId: string) { return payments.filter(p => purchases.find(x => x.id === purchaseId)?.supplier_id === p.supplier_id).map(p => ({ amount: p.amount, payments: { method: p.method, reference: p.reference } })) },
  async customerLedger(customerId: string) { return sales.filter(s => s.customer_id === customerId).map(s => ({ id: `led-${s.id}`, txn_at: s.sold_at, description: `Invoice ${s.invoice_number}`, debit: s.total, credit: 0 })).concat(payments.filter(p => p.customer_id === customerId).map(p => ({ id: `led-${p.id}`, txn_at: p.created_at, description: `Payment ${p.method}`, debit: 0, credit: p.amount }))).sort((a, b) => a.txn_at.localeCompare(b.txn_at)) },
  async supplierLedger(supplierId: string) { return purchases.filter(p => p.supplier_id === supplierId).map(p => ({ id: `sled-${p.id}`, txn_at: p.purchased_at, description: `Purchase ${p.purchase_number}`, credit: p.total, debit: 0 })).concat(payments.filter(p => p.supplier_id === supplierId).map(p => ({ id: `sled-${p.id}`, txn_at: p.created_at, description: `Payment ${p.method}`, credit: 0, debit: p.amount }))).sort((a, b) => a.txn_at.localeCompare(b.txn_at)) },
  async stockAdjustments() { return [] },
  async saveProduct(payload: any) {
    const category = categories.find(c => c.id === payload.category_id) ?? null
    if (payload.id) products = products.map(p => p.id === payload.id ? { ...p, ...payload, category, current_stock: p.current_stock } : p)
    else products.unshift({ ...product(id('prod'), payload.name, payload.sku || `SKU-${products.length + 1}`, category?.name || 'Fertilizer', Number(payload.gst_rate || 0), Number(payload.purchase_price || 0), Number(payload.selling_price || 0), Number(payload.opening_stock || 0), Number(payload.min_stock || 0), payload.sales_unit || 'bag', payload.barcode || ''), ...payload, category })
    return products[0]
  },
  async saveCustomer(payload: any) {
    const row = { id: payload.id || id('cust'), is_active: true, outstanding_balance: Number(payload.opening_balance || 0), created_at: iso(), ...payload }
    if (payload.id) customers = customers.map(c => c.id === payload.id ? { ...c, ...payload } : c)
    else customers.unshift(row)
    return payload.id ? customers.find(c => c.id === payload.id) : row
  },
  async saveSupplier(payload: any) {
    const row = { id: payload.id || id('sup'), is_active: true, outstanding_balance: Number(payload.opening_balance || 0), ...payload }
    if (payload.id) suppliers = suppliers.map(s => s.id === payload.id ? { ...s, ...payload } : s)
    else suppliers.unshift(row)
    return payload.id ? suppliers.find(s => s.id === payload.id) : row
  },
  async createCategory(name: string) { const row = { id: id('cat'), name }; categories.push(row); return row },
  async createSale(payload: SaleDraft) {
    const saleItems = payload.items.map(item => ({ ...item, unit_price: Number(item.unit_price), discount: Number(item.discount || 0) }))
    const result = sale(id('sale'), `BVF-DEMO-${String(sales.length + 1).padStart(3, '0')}`, payload.customer_id, 0, saleItems, payload.payments.reduce((s, p) => s + p.amount, 0))
    sales.unshift(result)
    for (const item of payload.items) products = products.map(p => p.id === item.product_id ? { ...p, current_stock: Number(p.current_stock) - Number(item.quantity) } : p)
    if (payload.customer_id) customers = customers.map(c => c.id === payload.customer_id ? { ...c, outstanding_balance: Number(c.outstanding_balance) + Number(result.balance_due), last_purchase_at: result.sold_at } : c)
    payments.unshift(...payload.payments.map(p => ({ id: id('pay'), customer_id: payload.customer_id, direction: 'in', method: p.method, amount: p.amount, reference: p.reference, created_at: result.sold_at })))
    return result
  },
  async createPurchase(payload: any) {
    const items = payload.items ?? []
    const result = purchase(id('pur'), `PUR-DEMO-${String(purchases.length + 1).padStart(3, '0')}`, payload.supplier_id, 0, items, (payload.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0))
    purchases.unshift(result)
    for (const item of items) products = products.map(p => p.id === item.product_id ? { ...p, current_stock: Number(p.current_stock) + Number(item.quantity), avg_cost: weightedAverageCost(Number(p.current_stock), Number(p.avg_cost), Number(item.quantity), Number(item.unit_cost)) } : p)
    suppliers = suppliers.map(s => s.id === payload.supplier_id ? { ...s, outstanding_balance: Number(s.outstanding_balance) + Number(result.balance_due) } : s)
    return result
  },
  async receiveCustomerPayment(payload: any) { const row = { id: id('pay'), customer_id: payload.customer_id, direction: 'in', method: payload.method, amount: Number(payload.amount), reference: payload.reference, created_at: iso() }; payments.unshift(row); customers = customers.map(c => c.id === payload.customer_id ? { ...c, outstanding_balance: Math.max(0, Number(c.outstanding_balance) - row.amount) } : c); return row },
  async receiveSupplierPayment(payload: any) { const row = { id: id('pay'), supplier_id: payload.supplier_id, direction: 'out', method: payload.method, amount: Number(payload.amount), reference: payload.reference, created_at: iso() }; payments.unshift(row); suppliers = suppliers.map(s => s.id === payload.supplier_id ? { ...s, outstanding_balance: Math.max(0, Number(s.outstanding_balance) - row.amount) } : s); return row },
  async expense(payload: any) { const row = { id: id('exp'), ...payload }; expenses.unshift(row); return row },
  async recordExpense(payload: any) { return this.expense(payload) },
  async saveCashClosing(payload: any) { return { ...payload, difference: Number(payload.counted_cash || 0) - 11200 } },
  async adjustStock(payload: any) { products = products.map(p => p.id === payload.product_id ? { ...p, current_stock: Number(p.current_stock) + Number(payload.quantity_delta || payload.delta || 0) } : p); return payload },
  async updateProfile(_: string, patch: any) { return patch },
  async saveSettings(settings: any) { return settings },
  async updateBusiness(patch: any) { return patch },
  async inviteUser(payload: any) { return { id: id('user'), ...payload, status: 'invited' } },
  async reverseSale() { return { ok: true } },
  async cancelSale() { return { ok: true } },
  async reversePurchase() { return { ok: true } },
  async importStage() { return { id: id('import'), rows: 0 } },
  async importCommit() { return { imported: 0, errors: 0 } },
}
