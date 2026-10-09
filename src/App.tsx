import { Suspense, lazy, useEffect, useState } from 'react'
import { AppShell } from './components/layout'
import { ToastProvider } from './components/ui'
import { useAuth } from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'
import type { Language } from './lib/i18n'
import type { PageKey } from './lib/types'
import { AuthPage, BusinessSetupPage } from './pages/Auth'
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const POSPage = lazy(() => import('./pages/POS').then(m => ({ default: m.POSPage })))
const SalesHistoryPage = lazy(() => import('./pages/SalesHistory').then(m => ({ default: m.SalesHistoryPage })))
const CustomersPage = lazy(() => import('./pages/Customers').then(m => ({ default: m.CustomersPage })))
const CollectionsPage = lazy(() => import('./pages/Collections').then(m => ({ default: m.CollectionsPage })))
const PurchasesPage = lazy(() => import('./pages/Purchases').then(m => ({ default: m.PurchasesPage })))
const SuppliersPage = lazy(() => import('./pages/Suppliers').then(m => ({ default: m.SuppliersPage })))
const ProductsPage = lazy(() => import('./pages/Products').then(m => ({ default: m.ProductsPage })))
const InventoryPage = lazy(() => import('./pages/Inventory').then(m => ({ default: m.InventoryPage })))
const ExpensesPage = lazy(() => import('./pages/Expenses').then(m => ({ default: m.ExpensesPage })))
const ReportsPage = lazy(() => import('./pages/Reports').then(m => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('./pages/Admin').then(m => ({ default: m.SettingsPage })))
const UsersPage = lazy(() => import('./pages/Admin').then(m => ({ default: m.UsersPage })))

export function App(){return <ToastProvider><Workspace/></ToastProvider>}
function Workspace(){
 const {ready,configured,session,profile,signOut}=useAuth()
 const[page,setPage]=useState<PageKey>('dashboard')
 const[language,setLanguage]=useState<Language>(()=>localStorage.getItem('bv-language')==='hi'?'hi':'en')
 const[dark,setDark]=useState(()=>localStorage.getItem('bv-theme')==='dark')
 const[selectedCustomer,setSelectedCustomer]=useState('')
 useEffect(()=>{document.documentElement.classList.toggle('dark',dark);localStorage.setItem('bv-theme',dark?'dark':'light')},[dark])
 useEffect(()=>{localStorage.setItem('bv-language',language)},[language])
 useEffect(()=>{if(profile?.role_code==='cashier'&&['dashboard','sales','purchases','suppliers','expenses','reports','users','settings'].includes(page))setPage('pos')},[profile,page])
 if(!ready)return <div className="grid min-h-screen place-items-center bg-[#f5f8f6]"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-brand-600 border-r-transparent"/><div className="mt-3 text-sm text-slate-500">Loading secure workspace…</div></div></div>
 if(configured&&!session)return <AuthPage/>
 if(configured&&session&&!profile)return <BusinessSetupPage/>
 const go=(key:PageKey)=>{if(key==='collections'&&profile?.role_code==='cashier'&&!selectedCustomer)setSelectedCustomer('');setPage(key)}
 let content:React.ReactNode
 switch(page){
  case'dashboard':content=<Dashboard language={language} onNavigate={go}/>;break
  case'pos':content=<POSPage/>;break
  case'sales':content=<SalesHistoryPage/>;break
  case'customers':content=<CustomersPage onPay={id=>{setSelectedCustomer(id);setPage('collections')}}/>;break
  case'collections':content=<CollectionsPage key={selectedCustomer} initialCustomerId={selectedCustomer}/>;break
  case'purchases':content=<PurchasesPage/>;break
  case'suppliers':content=<SuppliersPage/>;break
  case'products':content=<ProductsPage/>;break
  case'inventory':content=<InventoryPage/>;break
  case'expenses':content=<ExpensesPage/>;break
  case'reports':content=<ReportsPage/>;break
  case'users':content=<UsersPage/>;break
  case'settings':content=<SettingsPage/>;break
 }
 return <AppShell page={page} setPage={go} profile={profile} email={session?.user.email||undefined} language={language} setLanguage={setLanguage} dark={dark} toggleDark={()=>setDark(v=>!v)} onSignOut={()=>void signOut()} configured={configured}><Suspense fallback={<div className="panel py-16 text-center text-sm text-slate-400">Loading page…</div>}>{content}</Suspense></AppShell>
}
