export type AppRole = 'owner' | 'manager' | 'cashier'
export type PageKey = 'dashboard' | 'pos' | 'sales' | 'customers' | 'collections' | 'purchases' | 'suppliers' | 'products' | 'inventory' | 'expenses' | 'reports' | 'users' | 'settings'

export interface UserProfile {
  id: string
  business_id: string
  full_name: string
  role_code: AppRole
  status: string
  email?: string
  business?: { name: string; phone?: string; address?: string; gstin?: string }
}

export interface Product {
  id: string
  name: string
  sku: string
  category_id?: string | null
  category?: { name?: string } | null
  brand?: string | null
  manufacturer?: string | null
  hsn_code?: string | null
  gst_rate: number
  purchase_unit: string
  sales_unit: string
  pack_size?: string | null
  opening_stock: number
  current_stock: number
  min_stock: number
  avg_cost: number
  purchase_price: number
  selling_price: number
  barcode?: string | null
  batch_tracking: boolean
  expiry_tracking: boolean
  is_active: boolean
  created_at?: string
}

export interface Customer {
  id: string
  name: string
  mobile?: string | null
  village?: string | null
  address?: string | null
  gstin?: string | null
  opening_balance: number
  credit_limit: number
  outstanding_balance: number
  last_purchase_at?: string | null
  customer_status?: string
  remark?: string | null
  is_active: boolean
  created_at?: string
}

export interface Supplier {
  id: string
  name: string
  contact_number?: string | null
  address?: string | null
  gstin?: string | null
  outstanding_balance: number
  is_active: boolean
}

export interface CartItem {
  product: Product
  quantity: number
  rate: number
  discount: number
}

export interface SaleDraft {
  customer_id: string | null
  due_date?: string | null
  bill_status?: string
  remark?: string
  items: Array<{ product_id: string; quantity: number; unit_price: number; discount: number }>
  payments: Array<{ method: 'cash' | 'upi' | 'bank' | 'other'; amount: number; reference?: string }>
  idempotency_key?: string
}
