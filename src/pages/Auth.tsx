import { useState } from 'react'
import { ArrowRight, Check, Leaf, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, Input, Label, Spinner, useToast } from '../components/ui'
import { errorMessage } from '../lib/utils'

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('Banke Vihari Fertilizer')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const { refreshProfile } = useAuth()
  const { toast } = useToast()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setNotice('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        toast('Signed in', 'Your secure workspace is ready.')
      } else {
        if (!fullName.trim() || !businessName.trim()) throw new Error('Enter your name and business name.')
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim(), business_name: businessName.trim() } } })
        if (error) throw error
        if (data.session) {
          const { error: setupError } = await supabase.rpc('bootstrap_business', { p_business_name: businessName.trim(), p_full_name: fullName.trim() })
          if (setupError) throw setupError
          await refreshProfile()
          toast('Business created', 'Your owner account is ready.')
        } else {
          setNotice('Account created. Verify your email, sign in, then complete the business setup. If email confirmation is enabled, check your inbox.')
        }
      }
    } catch (error) { toast('Could not continue', errorMessage(error), 'error') }
    finally { setBusy(false) }
  }

  return <div className="min-h-screen bg-[#f4f8f5] px-4 py-8 dark:bg-[#101a16] sm:grid sm:place-items-center">
    <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/5 dark:border-slate-800 dark:bg-[#17231d] md:grid-cols-[1fr_.92fr]">
      <div className="relative hidden min-h-[650px] flex-col justify-between overflow-hidden bg-brand-700 p-10 text-white md:flex">
        <div className="absolute -right-20 -top-16 h-80 w-80 rounded-full border border-white/10"/><div className="absolute -right-6 top-8 h-56 w-56 rounded-full border border-white/10"/><div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-white/5"/>
        <div className="relative flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Leaf size={24}/></div><div><div className="font-bold">Banke Vihari</div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-100">Fertilizer ERP</div></div></div>
        <div className="relative max-w-sm"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium"><ShieldCheck size={14}/>Secure business workspace</div><h1 className="text-4xl font-semibold leading-[1.12] tracking-tight">A simpler way to run your fertilizer shop.</h1><p className="mt-4 text-sm leading-6 text-emerald-100/90">Fast billing, reliable stock records and a clear customer khata — built around the way Indian agri-retail works.</p>
          <div className="mt-8 space-y-3">{['Cash, UPI and Udhar in one bill', 'Batch-aware stock and purchase tracking', 'Business data protected with row-level security'].map(line => <div key={line} className="flex items-center gap-2 text-xs text-white/90"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/15"><Check size={12}/></span>{line}</div>)}</div>
        </div>
        <div className="relative text-[10px] text-emerald-100/70">Designed for everyday retail work · Agra, Uttar Pradesh</div>
      </div>
      <div className="px-6 py-8 sm:px-10 sm:py-12">
        <div className="mb-8 flex items-center gap-3 md:hidden"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white"><Leaf size={22}/></div><div><div className="font-bold text-slate-900 dark:text-white">Banke Vihari</div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-brand-700">Fertilizer ERP</div></div></div>
        <div className="text-xs font-semibold uppercase tracking-[.15em] text-brand-700">Welcome to your workspace</div><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{mode === 'signin' ? 'Sign in to continue' : 'Create your owner account'}</h2><p className="mt-2 text-sm text-slate-500">{mode === 'signin' ? 'Enter your account details to access your business.' : 'Start with your business and the owner profile. Invite your team after setup.'}</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === 'signup' && <><div><Label htmlFor="full-name">Your name</Label><Input id="full-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Rakesh Sharma" autoComplete="name" required/></div><div><Label htmlFor="business-name">Business name</Label><Input id="business-name" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Banke Vihari Fertilizer" required/></div></>}
          <div><Label htmlFor="email">Email address</Label><div className="relative"><Mail size={16} className="absolute left-3 top-3 text-slate-400"/><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" placeholder="you@business.in" autoComplete="email" required/></div></div>
          <div><Label htmlFor="password">Password</Label><div className="relative"><LockKeyhole size={16} className="absolute left-3 top-3 text-slate-400"/><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-9" placeholder="At least 8 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required/></div></div>
          {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{notice}</div>}
          <Button type="submit" disabled={busy} size="lg" className="w-full">{busy ? <Spinner/> : <>{mode === 'signin' ? 'Sign in securely' : 'Create business'}<ArrowRight size={16}/></>}</Button>
        </form>
        <div className="mt-5 text-center text-xs text-slate-500">{mode === 'signin' ? 'New to the ERP?' : 'Already have an account?'} <button className="font-semibold text-brand-700 hover:underline" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setNotice('') }}>{mode === 'signin' ? 'Create owner account' : 'Sign in'}</button></div>
        <div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-[10px] text-slate-400 dark:border-slate-800"><LockKeyhole size={13}/> Passwords are handled by Supabase Auth. No service key is exposed in the browser.</div>
      </div>
    </div>
  </div>
}

export function BusinessSetupPage() {
  const { user, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(String(user?.user_metadata?.business_name || 'Banke Vihari Fertilizer'))
  const [fullName, setFullName] = useState(String(user?.user_metadata?.full_name || ''))
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.rpc('bootstrap_business', { p_business_name: name.trim(), p_full_name: fullName.trim() })
      if (error) throw error
      await refreshProfile(); toast('Business workspace created')
    } catch (error) { toast('Setup failed', errorMessage(error), 'error') }
    finally { setBusy(false) }
  }
  return <div className="mx-auto mt-12 max-w-xl panel p-7 sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Leaf size={23}/></div><h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">Finish setting up your business</h1><p className="mt-2 text-sm leading-6 text-slate-500">This signed-in account does not yet have a business profile. Create the first workspace or ask your owner to invite this account.</p><form onSubmit={submit} className="mt-6 space-y-4"><div><Label>Business name</Label><Input value={name} onChange={e => setName(e.target.value)} required/></div><div><Label>Your name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} required/></div><Button disabled={busy} size="lg" className="w-full">{busy ? <Spinner/> : 'Create owner workspace'}</Button></form></div>
}
