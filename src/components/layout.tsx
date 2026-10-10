import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Bell, Boxes, Building2, ChevronDown, CircleDollarSign, ClipboardList, ContactRound, FileText, Globe2, LayoutDashboard, Leaf, LogOut, Menu, Moon, PackagePlus, PanelLeftClose, Search, Settings2, ShoppingBag, ShoppingCart, Sun, Truck, Users, Wallet, X } from 'lucide-react'
import type { PageKey, UserProfile } from '../lib/types'
import type { Language } from '../lib/i18n'
import { dictionary } from '../lib/i18n'
import { Button, Badge } from './ui'
import { cn } from '../lib/utils'

export const navItems: { key: PageKey; icon: React.ElementType; labelKey: keyof typeof dictionary.en; group: string }[] = [
  { key: 'dashboard', icon: LayoutDashboard, labelKey: 'dashboard', group: 'Overview' },
  { key: 'pos', icon: ShoppingCart, labelKey: 'pos', group: 'Sales' },
  { key: 'sales', icon: ClipboardList, labelKey: 'sales', group: 'Sales' },
  { key: 'customers', icon: ContactRound, labelKey: 'customers', group: 'Sales' },
  { key: 'collections', icon: CircleDollarSign, labelKey: 'collections', group: 'Sales' },
  { key: 'purchases', icon: PackagePlus, labelKey: 'purchases', group: 'Buying' },
  { key: 'suppliers', icon: Truck, labelKey: 'suppliers', group: 'Buying' },
  { key: 'products', icon: Boxes, labelKey: 'products', group: 'Stock' },
  { key: 'inventory', icon: Activity, labelKey: 'inventory', group: 'Stock' },
  { key: 'expenses', icon: Wallet, labelKey: 'expenses', group: 'Finance' },
  { key: 'reports', icon: BarChart3, labelKey: 'reports', group: 'Finance' },
  { key: 'users', icon: Users, labelKey: 'users', group: 'Administration' },
  { key: 'settings', icon: Settings2, labelKey: 'settings', group: 'Administration' },
]

export function AppShell({ page, setPage, profile, email, language, setLanguage, dark, toggleDark, onSignOut, configured, children }: {
  page: PageKey; setPage: (page: PageKey) => void; profile: UserProfile | null; email?: string; language: Language; setLanguage: (language: Language) => void; dark: boolean; toggleDark: () => void; onSignOut: () => void; configured: boolean; children: React.ReactNode
}) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('bv-sidebar-collapsed') === 'true')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  useEffect(() => { localStorage.setItem('bv-sidebar-collapsed', String(collapsed)) }, [collapsed])
  const [searchOpen, setSearchOpen] = useState(false)
  const text = dictionary[language]
  const allowedItems = useMemo(() => navItems.filter(item => {
    if (!profile) return true
    if (profile.role_code === 'cashier') return !['reports', 'users', 'settings', 'purchases', 'suppliers'].includes(item.key)
    if (profile.role_code === 'manager') return item.key !== 'users' && item.key !== 'settings'
    return true
  }), [profile])
  const go = (key: PageKey) => { setPage(key); setMobileMenu(false); setSearchOpen(false); setNotificationsOpen(false) }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(v => !v) }
      if (event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); go('pos') }
      if (event.key === 'Escape') { setSearchOpen(false); setMobileMenu(false) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  const grouped = allowedItems.reduce<Record<string, typeof allowedItems>>((acc, item) => { (acc[item.group] ??= []).push(item); return acc }, {})
  const userName = profile?.full_name || email?.split('@')[0] || 'Owner'
  const initials = userName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase() || 'BV'

  return <div className="min-h-screen bg-[#f5f8f6] text-slate-800 dark:bg-[#101a16] dark:text-slate-100">
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 bg-white/95 px-3 pb-4 pt-5 dark:border-slate-800 dark:bg-[#141f19] lg:flex lg:flex-col transition-[width] duration-200" style={{width:collapsed?76:248}}>
      <div className={cn('flex items-center gap-1',collapsed?'flex-col':'justify-between')}><Brand compact={collapsed} onClick={() => go('dashboard')} /><button title={collapsed?'Expand sidebar':'Collapse sidebar'} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setCollapsed(v=>!v)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><PanelLeftClose size={17} className={cn('transition-transform',collapsed&&'rotate-180')}/></button></div>
      <div className={cn('mt-8 flex-1 overflow-y-auto',collapsed?'':'pr-1')}>
        {Object.entries(grouped).map(([group, items]) => <div key={group} className="mb-5">
          {!collapsed&&<div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{group}</div>}
          <div className="space-y-1">{items.map(item => <NavLink key={item.key} item={item} label={text[item.labelKey]} active={page === item.key} collapsed={collapsed} onClick={() => go(item.key)} />)}</div>
        </div>)}
      </div>
      {!collapsed&&<div className="rounded-2xl bg-brand-50 p-3 dark:bg-brand-900/20">
        <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-brand-700 shadow-sm dark:bg-brand-900"><Leaf size={16}/></div><div className="min-w-0"><div className="truncate text-xs font-semibold text-brand-900 dark:text-brand-100">Farm essentials</div><div className="text-[10px] text-brand-700/70 dark:text-brand-200/70">Made for your daily work</div></div></div>
        <div className="mt-2 text-[10px] leading-4 text-brand-800/65 dark:text-brand-200/70">Bills, stock and khata — together in one place.</div>
      </div>}
      <div className={cn('mt-4 flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800',collapsed?'justify-center px-1 py-2':'px-3 py-2.5')}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-100">{initials}</div>
        {!collapsed&&<div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{userName}</div><div className="truncate text-[10px] capitalize text-slate-400">{profile?.role_code || 'setup mode'}</div></div>}
        {!collapsed&&<button title="Sign out" onClick={onSignOut} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><LogOut size={15}/></button>}
      </div>
    </aside>

    <div className="bv-main transition-[padding] duration-200" style={{paddingLeft:0}}><style>{`@media(min-width:1024px){.bv-main{padding-left:${collapsed?76:248}px!important}}`}</style>
      <header className="no-print sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-[#141f19]/90 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button aria-label="Open navigation" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setMobileMenu(true)}><Menu size={19}/></button>
          <div className="hidden lg:block"><div className="flex items-center gap-2 text-xs text-slate-400"><Building2 size={14}/><span>{profile?.business?.name || 'Banke Vihari Fertilizer'}</span><span className="text-slate-300">/</span><span className="font-medium text-slate-600 dark:text-slate-300">{text[navItems.find(i => i.key === page)?.labelKey || 'dashboard']}</span></div></div>
          <div className="lg:hidden"><Brand compact onClick={() => go('dashboard')} /></div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={() => setSearchOpen(true)} className="hidden h-9 min-w-[180px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 sm:flex"><Search size={14}/><span className="flex-1 text-left">Search pages…</span><kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] dark:border-slate-700">⌘K</kbd></button>
          <Button variant="ghost" size="icon-sm" title="Search" onClick={() => setSearchOpen(true)} className="sm:hidden"><Search size={17}/></Button>
          <Button variant="ghost" size="icon-sm" title="Toggle language" onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}><Globe2 size={17}/><span className="text-[10px] font-bold">{language.toUpperCase()}</span></Button>
          <Button variant="ghost" size="icon-sm" title={dark ? 'Light mode' : 'Dark mode'} onClick={toggleDark}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</Button>
          <div className="relative"><button title="Notifications" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(v=>!v)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Bell size={17}/></button>{notificationsOpen&&<div className="absolute right-0 top-11 z-50 w-[min(85vw,330px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between"><div className="text-sm font-bold">Notifications</div><button onClick={()=>setNotificationsOpen(false)} aria-label="Close notifications"><X size={16}/></button></div><p className="mt-3 text-xs text-slate-500">No notifications yet. Low-stock, payment-due and expiry alerts will appear here when notification tracking is enabled.</p></div>}</div>
          <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block"/>
          <div className="hidden items-center gap-2 sm:flex"><div className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-100">{initials}</div><ChevronDown size={14} className="text-slate-400"/></div>
        </div>
      </header>
      {!configured && <div className="no-print flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 sm:px-7"><div><span className="font-bold">Preview / setup mode.</span> Supabase is not connected; no business records or metrics are fabricated. Add your project credentials to enable live operations.</div><button className="shrink-0 font-semibold underline underline-offset-2" onClick={() => go('settings')}>Setup guide</button></div>}
      <main className="mx-auto max-w-[1600px] px-4 pb-28 pt-6 sm:px-7 sm:pt-7 lg:px-9 lg:pb-10">{children}</main>
    </div>

    <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-xl dark:border-slate-800 dark:bg-[#141f19]/95 lg:hidden">
      {(['dashboard', 'pos', 'customers', 'products'] as PageKey[]).map(key => { const item = navItems.find(v => v.key === key)!; const Icon = item.icon; return <button key={key} onClick={() => go(key)} className={cn('flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold', page === key ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400')}><Icon size={19} strokeWidth={page === key ? 2.3 : 1.8}/>{text[item.labelKey]}</button> })}
      <button onClick={() => setMobileMenu(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-semibold text-slate-400"><Menu size={19}/>More</button>
    </nav>

    {mobileMenu && <div className="no-print fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setMobileMenu(false)}><div className="absolute inset-y-0 left-0 flex w-[min(88vw,340px)] flex-col bg-white p-4 shadow-2xl dark:bg-[#141f19]" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><Brand onClick={() => go('dashboard')}/><button aria-label="Close menu" onClick={() => setMobileMenu(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button></div><div className="mt-5 flex-1 overflow-auto">{allowedItems.map(item => <NavLink key={item.key} item={item} label={text[item.labelKey]} active={page === item.key} onClick={() => go(item.key)} />)}</div><div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800"><Badge tone={configured ? 'green' : 'amber'}>{configured ? 'Database configured' : 'Setup required'}</Badge></div></div></div>}

    {searchOpen && <div className="no-print fixed inset-0 z-50 bg-slate-950/30 p-4 pt-[12vh]" onClick={() => setSearchOpen(false)}><div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#17231d]" onClick={e => e.stopPropagation()}><div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800"><Search size={18} className="text-slate-400"/><input autoFocus placeholder="Go to a page…" className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" onChange={e => { const v = e.target.value.toLowerCase(); setSearchOpen(Boolean(v) || searchOpen) }} /><kbd className="rounded-md border px-2 py-1 text-[10px] text-slate-400">ESC</kbd></div><div className="max-h-[55vh] overflow-auto p-2">{allowedItems.map(item => { const Icon = item.icon; return <button key={item.key} onClick={() => go(item.key)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-800 dark:text-slate-300 dark:hover:bg-brand-900/30"><Icon size={16}/>{text[item.labelKey]}<span className="ml-auto text-[10px] text-slate-400">{item.group}</span></button> })}</div></div></div>}
  </div>
}

function Brand({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return <button onClick={onClick} className="flex min-w-0 items-center gap-3 text-left">
    <div className={cn('grid shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm shadow-brand-700/20', compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11')}><Leaf size={compact ? 19 : 22} strokeWidth={2.2}/></div>
    {!compact && <div className="min-w-0"><div className="whitespace-nowrap text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">Banke Vihari</div><div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.13em] text-brand-700 dark:text-brand-300"><span>Fertilizer ERP</span><span className="h-1 w-1 rounded-full bg-brand-400"/><span className="text-slate-400">Agra</span></div></div>}
  </button>
}
function NavLink({ item, label, active, collapsed = false, onClick }: { item: typeof navItems[number]; label: string; active: boolean; collapsed?: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button onClick={onClick} title={collapsed?label:undefined} aria-label={label} className={cn('group flex w-full items-center gap-3 rounded-xl px-3 py-[10px] text-left text-[13px] font-medium transition-colors',collapsed&&'justify-center px-2', active ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/35 dark:text-brand-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100')}>
    <Icon size={17} strokeWidth={active ? 2.25 : 1.85} className={cn(active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300')}/>{!collapsed&&<span className="truncate">{label}</span>}{!collapsed&&item.key === 'pos' && <span className="ml-auto rounded-md bg-white/80 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 shadow-sm dark:bg-slate-900">ALT N</span>}
  </button>
}
