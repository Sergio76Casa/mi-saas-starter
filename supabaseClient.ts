
import { createClient } from '@supabase/supabase-js';

// En Vercel, estas variables se configuran en el panel de control del proyecto
// En desarrollo local, se leen del archivo .env
// Fix: Use casting to any to access 'env' on 'import.meta' as it may not be defined in the TypeScript environment
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Ensure environment variables are set.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
