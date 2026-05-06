import { createClient } from '@supabase/supabase-js'

// Fallback vacío para que el build pase sin .env.local configurado.
// En producción, estas variables deben estar definidas.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
