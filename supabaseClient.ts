
import { createClient } from '@supabase/supabase-js';

// Lectura de variables de entorno con fallback (Vite y Node/Process)
const getEnv = (key: string) => {
  // En Vite, las variables VITE_ son las únicas expuestas al cliente
  return (import.meta as any).env?.[key] || 
         (import.meta as any).env?.[`VITE_${key}`] || 
         (globalThis as any).process?.env?.[key] || 
         (globalThis as any).process?.env?.[`VITE_${key}`] || 
         '';
};

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

export const isConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http')
);

// Inicialización del cliente.
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co', 
  isConfigured ? SUPABASE_ANON_KEY : 'placeholder'
);
