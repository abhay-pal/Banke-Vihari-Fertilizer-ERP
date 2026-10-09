import { requireSupabase, supabase } from './supabase'
import { demoApi } from './demoData'
import type { SaleDraft } from './types'

function indiaDayStart(date: string) { return new Date(`${date}T00:00:00+05:30`).toISOString() }
function indiaDayAfter(date: string) { const next = new Date(`${date}T00:00:00+05:30`); next.setUTCDate(next.getUTCDate() + 1); return next.toISOString() }
async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data as T
}

export const api = {
  dashboard: (from: string, to: string) => supabase ? unwrap<any>(requireSupabase().rpc('get_dashboard', { p_from: from, p_to: to })) : demoApi.dashboard(),
  products: (search = '') => {
    if (!supabase) return demoApi.products(search)
    let q = requireSupabase().from('products').select('id,business_id,name,sku,category_id,brand,manufacturer,hsn_code,gst_rate,purchase_unit,sales_unit,pack_size,current_stock,min_stock,selling_price,barcode,batch_tracking,expiry_tracking,is_active,created_at,category:product_categories(name)').order('name').limit(500)
    if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%,barcode.ilike.%${search.trim()}%`)
    return unwrap<any[]>(q)
  },
  managementProducts: (search = '') => {
    if (!supabase) return demoApi.managementProducts(search)
    let q = requireSupabase().from('management_products').select('*').order('name').limit(1000)
    if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%,barcode.ilike.%${search.trim()}%`)
    return unwrap<any[]>(q).then(rows => rows.map((p:any) => ({ ...p, category: p.category_name ? { name: p.category_name } : null })))
  },
  managementSaleItems: (saleIds: string[]) => {
    if (!supabase) return demoApi.managementSaleItems(saleIds)
    if (!saleIds.length) return Promise.resolve([])
    return unwrap<any[]>(requireSupabase().from('management_sale_items').select('*').in('sale_id',saleIds).limit(10000))
  },
  categories: () => supabase ? unwrap<any[]>(requireSupabase().from('product_categories').select('id,name').order('name')) : demoApi.categories(),
  customers: (search = '') => {
    if (!supabase) return demoApi.customers(search)
    let q = requireSupabase().from('customers').select('*').order('name').limit(500)
    if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,mobile.ilike.%${search.trim()}%,village.ilike.%${search.trim()}%`)
    return unwrap<any[]>(q)
  },
  suppliers: (search = '') => {
    if (!supabase) return demoApi.suppliers(search)
    let q = requireSupabase().from('suppliers').select('*').order('name').limit(500)
    if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,contact_number.ilike.%${search.trim()}%`)
    return unwrap<any[]>(q)
  },
  sales: (from?: string, to?: string) => {
    if (!supabase) return demoApi.sales()
    let q = requireSupabase().from('sales').select('*,customers(name,mobile),sale_items(id,product_name,quantity,unit_price,line_total)').order('sold_at', { ascending: false }).limit(500)
    if (from) q = q.gte('sold_at', indiaDayStart(from))
    if (to) q = q.lt('sold_at', indiaDayAfter(to))
    return unwrap<any[]>(q)
  },
  purchases: (from?: string, to?: string) => {
    if (!supabase) return demoApi.purchases()
    let q = requireSupabase().from('purchases').select('*,suppliers(name),purchase_items(id,product_name,quantity,unit_cost,line_total)').order('purchased_at', { ascending: false }).limit(500)
    if (from) q = q.gte('purchased_at', indiaDayStart(from))
    if (to) q = q.lt('purchased_at', indiaDayAfter(to))
    return unwrap<any[]>(q)
  },
  expenses: (from?: string, to?: string) => {
    if (!supabase) return demoApi.expenses()
    let q = requireSupabase().from('expenses').select('*').order('spent_at', { ascending: false }).limit(500)
    if (from) q = q.gte('spent_at', from)
    if (to) q = q.lte('spent_at', to)
    return unwrap<any[]>(q)
  },
  movements: (from?: string, to?: string) => {
    if (!supabase) return demoApi.movements()
    let q = requireSupabase().from('inventory_movements').select('*,products(name,sku)').order('moved_at', { ascending: false }).limit(1000)
    if (from) q = q.gte('moved_at', indiaDayStart(from))
    if (to) q = q.lt('moved_at', indiaDayAfter(to))
    return unwrap<any[]>(q)
  },
  batches: () => supabase ? unwrap<any[]>(requireSupabase().from('inventory_batches').select('*,products(name,sku)').order('expires_on', { ascending: true, nullsFirst: false }).limit(1000)) : demoApi.batches(),
  payments: (from?: string, to?: string) => {
    if (!supabase) return demoApi.payments()
    let q = requireSupabase().from('payments').select('*').order('created_at', { ascending: false }).limit(1000)
    if (from) q = q.gte('created_at', indiaDayStart(from))
    if (to) q = q.lt('created_at', indiaDayAfter(to))
    return unwrap<any[]>(q)
  },
  cashClosings: () => supabase ? unwrap<any[]>(requireSupabase().from('cash_closings').select('*').order('closing_date', { ascending: false }).limit(100)) : demoApi.cashClosings(),
  saveCashClosing: (payload: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('record_cash_closing', { p_payload: payload })) : demoApi.saveCashClosing(payload),
  adjustStock: (payload: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('adjust_stock', { p_payload: payload })) : demoApi.adjustStock(payload),
  reversePurchase: (purchaseId: string, method = 'cash') => supabase ? unwrap<any>(requireSupabase().rpc('reverse_purchase', { p_purchase_id: purchaseId, p_refund_method: method })) : demoApi.reversePurchase(),
  reverseSale: (saleId: string, method = 'cash') => supabase ? unwrap<any>(requireSupabase().rpc('reverse_sale', { p_sale_id: saleId, p_refund_method: method })) : demoApi.reverseSale(),
  expense: (payload: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('record_expense', { p_payload: payload })) : demoApi.expense(payload),
  inviteUser: async (payload: { email: string; full_name: string; role_code: string }) => supabase ? unwrap<any>(requireSupabase().functions.invoke('invite-user', { body: payload })) : demoApi.inviteUser(payload),
  updateProfile: async (id: string, patch: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().from('user_profiles').update(patch).eq('id', id).select().single()) : demoApi.updateProfile(id, patch),
  paymentRows: () => supabase ? unwrap<any[]>(requireSupabase().from('payments').select('*,customers(name),suppliers(name)').order('created_at', { ascending: false }).limit(1000)) : demoApi.paymentRows(),
  customerPayments: (customerId: string) => supabase ? unwrap<any[]>(requireSupabase().from('payments').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(300)) : demoApi.customerPayments(customerId),
  supplierPurchases: (supplierId: string) => supabase ? unwrap<any[]>(requireSupabase().from('purchases').select('*,purchase_items(*)').eq('supplier_id', supplierId).order('purchased_at', { ascending: false }).limit(200)) : demoApi.supplierPurchases(supplierId),
  supplierPayments: (supplierId: string) => supabase ? unwrap<any[]>(requireSupabase().from('payments').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false }).limit(300)) : demoApi.supplierPayments(supplierId),
  cashSnapshot: (date: string) => supabase ? unwrap<any>(requireSupabase().rpc('get_cashbook', { p_date: date })) : demoApi.cashSnapshot(),
  categoriesList: () => supabase ? unwrap<any[]>(requireSupabase().from('product_categories').select('*').order('name')) : demoApi.categoriesList(),
  customerLedger: (customerId: string) => supabase ? unwrap<any[]>(requireSupabase().from('customer_ledger').select('*').eq('customer_id', customerId).order('txn_at', { ascending: true }).limit(1000)) : demoApi.customerLedger(customerId),
  supplierLedger: (supplierId: string) => supabase ? unwrap<any[]>(requireSupabase().from('supplier_ledger').select('*').eq('supplier_id', supplierId).order('txn_at', { ascending: true }).limit(1000)) : demoApi.supplierLedger(supplierId),
  customerSales: (customerId: string) => supabase ? unwrap<any[]>(requireSupabase().from('sales').select('*,sale_items(id,business_id,sale_id,product_id,product_name,quantity,unit,unit_price,discount,gst_rate,taxable_amount,gst_amount,line_total,created_at)').eq('customer_id', customerId).order('sold_at', { ascending: false }).limit(200)) : demoApi.customerSales(customerId),
  salePayments: (saleId: string) => supabase ? unwrap<any[]>(requireSupabase().from('payment_allocations').select('amount,payments(method,reference)').eq('sale_id', saleId)) : demoApi.salePayments(saleId),
  purchasePayments: (purchaseId: string) => supabase ? unwrap<any[]>(requireSupabase().from('payment_allocations').select('amount,payments(method,reference)').eq('purchase_id', purchaseId)) : demoApi.purchasePayments(purchaseId),
  stockAdjustments: () => supabase ? unwrap<any[]>(requireSupabase().from('stock_adjustments').select('*,stock_adjustment_items(*,products(name,sku))').order('created_at',{ascending:false}).limit(200)) : demoApi.stockAdjustments(),
  saveProduct: (product: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('save_product', { p_product: product })) : demoApi.saveProduct(product),
  saveCustomer: (customer: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('save_customer', { p_customer: customer })) : demoApi.saveCustomer(customer),
  saveSupplier: (supplier: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('save_supplier', { p_supplier: supplier })) : demoApi.saveSupplier(supplier),
  createSale: (payload: SaleDraft) => supabase ? unwrap<any>(requireSupabase().rpc('create_sale', { p_payload: payload })) : demoApi.createSale(payload),
  createPurchase: (payload: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('create_purchase', { p_payload: payload })) : demoApi.createPurchase(payload),
  receiveCustomerPayment: (payload: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('receive_customer_payment', { p_payload: payload })) : demoApi.receiveCustomerPayment(payload),
  receiveSupplierPayment: (payload: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('receive_supplier_payment', { p_payload: payload })) : demoApi.receiveSupplierPayment(payload),
  recordExpense: (payload: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().rpc('record_expense', { p_payload: payload })) : demoApi.recordExpense(payload),
  cancelSale: (saleId: string, method = 'cash') => supabase ? unwrap<any>(requireSupabase().rpc('reverse_sale', { p_sale_id: saleId, p_refund_method: method })) : demoApi.cancelSale(),
  importStage: (fileName: string, rows: unknown[]) => supabase ? unwrap<any>(requireSupabase().rpc('stage_import_rows', { p_file_name: fileName, p_rows: rows })) : demoApi.importStage(),
  importCommit: (jobId: string) => supabase ? unwrap<any>(requireSupabase().rpc('commit_import_job', { p_job_id: jobId })) : demoApi.importCommit(),
  importJobs: () => supabase ? unwrap<any[]>(requireSupabase().from('import_jobs').select('*').order('created_at', { ascending: false }).limit(50)) : demoApi.importJobs(),
  createCategory: async (name: string) => supabase ? unwrap<any>(requireSupabase().rpc('create_category', { p_name: name })) : demoApi.createCategory(name),
  updateBusiness: async (patch: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().from('businesses').update(patch).select().single()) : demoApi.updateBusiness(patch),
  settings: () => supabase ? unwrap<any>(requireSupabase().from('business_settings').select('*').maybeSingle()) : demoApi.settings(),
  saveSettings: (settings: Record<string, unknown>) => supabase ? unwrap<any>(requireSupabase().from('business_settings').upsert(settings, { onConflict: 'business_id' }).select().single()) : demoApi.saveSettings(settings),
  profiles: () => supabase ? unwrap<any[]>(requireSupabase().from('user_profiles').select('id,full_name,role_code,status,created_at').order('created_at')) : demoApi.profiles(),
  auditLogs: () => supabase ? unwrap<any[]>(requireSupabase().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)) : demoApi.auditLogs(),
}
