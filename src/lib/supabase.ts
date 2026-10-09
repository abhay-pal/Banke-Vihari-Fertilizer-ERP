import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const legacyAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const clientKey = publishableKey || legacyAnonKey

export const isLiveSupabaseConfigured = Boolean(
  url?.startsWith('https://') &&
  url.endsWith('.supabase.co') &&
  !url.includes('YOUR_PROJECT') &&
  clientKey &&
  !clientKey.includes('YOUR_')
)
export const isSupabaseConfigured = isLiveSupabaseConfigured
export const supabase = isLiveSupabaseConfigured
  ? createClient(url!, clientKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your deployment environment.')
  return supabase
}
