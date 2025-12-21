import { createClient } from '@supabase/supabase-js';

// Lectura de variables de entorno con fallback (Vite y Node/Process)
const getEnv = (key: string) => {
  return (import.meta as any).env?.[key] || (globalThis as any).process?.env?.[key] || '';
};

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

export const isConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http')
);

// Inicialización del cliente. Si no está configurado, la AppProvider manejará el estado de salud.
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co', 
  isConfigured ? SUPABASE_ANON_KEY : 'placeholder'
);