import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Sign in required' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: { user }, error: userError } = await caller.auth.getUser()
    if (userError || !user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    const { data: profile, error: profileError } = await caller.from('user_profiles').select('business_id,role_code,status').eq('id', user.id).single()
    if (profileError || profile?.role_code !== 'owner' || profile?.status !== 'active') return new Response(JSON.stringify({ error: 'Owner permission required' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const fullName = String(body.full_name || '').trim()
    const role = String(body.role_code || 'cashier')
    if (!email || !fullName || !['manager', 'cashier'].includes(role)) throw new Error('Enter an email, full name, and a manager or cashier role.')
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } })
    if (error) throw error
    if (!data.user) throw new Error('Auth invitation did not return a user.')
    const { error: insertError } = await admin.from('user_profiles').insert({ id: data.user.id, business_id: profile.business_id, full_name: fullName, role_code: role, status: 'active' })
    if (insertError) {
      // The auth invitation is already issued; explain recovery without returning credentials.
      throw new Error(`Invitation sent, but profile setup failed: ${insertError.message}. Ask the owner to retry after checking Users.`)
    }
    return new Response(JSON.stringify({ user_id: data.user.id, email, role_code: role }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invitation failed.'
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
