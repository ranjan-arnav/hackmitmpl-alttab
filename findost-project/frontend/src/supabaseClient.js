import { createClient } from '@supabase/supabase-js'

// Read from Vite environment variables (configure in .env.local or deployment platform)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth will fail until they are set.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export const missingSupabaseEnv = !supabaseUrl || !supabaseAnonKey;

console.log('Supabase client initialized:', !!supabase, { project: supabaseUrl, missingEnv: missingSupabaseEnv });
