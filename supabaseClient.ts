import { createClient } from '@supabase/supabase-js';

// Lectura estricta de variables de entorno de Vite
// Use type casting to any to bypass the TypeScript error: Property 'env' does not exist on type 'ImportMeta'
export const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
export const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';

export const isConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http')
);

if (!isConfigured && typeof window !== 'undefined') {
  console.error('❌ ERROR: Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.');
}

// Inicialización del cliente
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co', 
  isConfigured ? SUPABASE_ANON_KEY : 'placeholder'
);