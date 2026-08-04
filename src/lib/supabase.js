import { createClient } from '@supabase/supabase-js'

// Both values come from .env.local, which is gitignored.
// Never put these directly in code.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env.local and fill it in.'
  )
}

export const supabase = createClient(url, key)
