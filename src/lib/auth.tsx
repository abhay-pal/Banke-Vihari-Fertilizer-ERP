import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isLiveSupabaseConfigured, supabase } from './supabase'
import type { UserProfile } from './types'

interface AuthState {
  ready: boolean
  configured: boolean
  session: Session | null
  user: User | null
  profile: UserProfile | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(!isLiveSupabaseConfigured)
  const loadedProfileUserId = useRef<string | null>(null)

  const refreshProfile = useCallback(async () => {
    if (!supabase) { setProfile(null); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { loadedProfileUserId.current = null; setProfile(null); return }
    const { data, error } = await supabase.from('user_profiles')
      .select('id,business_id,full_name,role_code,status,business:businesses(name,phone,address,gstin)')
      .eq('id', user.id).maybeSingle()
    if (error) { console.error('Could not load user profile', error); loadedProfileUserId.current = null; setProfile(null); return }
    loadedProfileUserId.current = data ? user.id : null
    setProfile(data as unknown as UserProfile | null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let mounted = true
    // getSession reads the persisted session; avoid a second profile fetch from
    // INITIAL_SESSION or TOKEN_REFRESHED events on every navigation/refresh.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session && loadedProfileUserId.current !== data.session.user.id) {
        await refreshProfile()
      }
      if (mounted) setReady(true)
    }).catch(error => {
      console.error('Could not restore session', error)
      if (mounted) setReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      if (!nextSession) {
        loadedProfileUserId.current = null
        setProfile(null)
        setReady(true)
        return
      }
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
      if (loadedProfileUserId.current === nextSession.user.id) return
      // Schedule outside the auth callback to avoid Supabase auth deadlocks.
      window.setTimeout(() => {
        if (mounted && loadedProfileUserId.current !== nextSession.user.id) {
          void refreshProfile().finally(() => { if (mounted) setReady(true) })
        }
      }, 0)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [refreshProfile])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null); setProfile(null)
  }, [])

  const demoProfile: UserProfile = {
    id: 'demo-owner',
    business_id: 'demo-business',
    full_name: 'Demo Owner',
    role_code: 'owner',
    status: 'active',
    email: 'demo@bankevihari.local',
    business: { name: 'Banke Vihari Fertilizer', phone: '+91 98765 43210', address: 'Agra, Uttar Pradesh', gstin: '09ABCDE1234F1Z5' },
  }
  const value = useMemo(() => ({
    ready,
    configured: isLiveSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile: isLiveSupabaseConfigured ? profile : demoProfile,
    refreshProfile,
    signOut,
  }), [ready, session, profile, refreshProfile, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
