import { createClient } from '@supabase/supabase-js'

// Cliente con service role para operaciones del servidor (API routes)
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
  return createClient(url, key, { auth: { persistSession: false } })
}
