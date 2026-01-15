
import { createClient } from '@supabase/supabase-js';

// Lectura segura de variables de entorno
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key] || 
           (import.meta as any).env?.[`VITE_${key}`] || 
           (globalThis as any).process?.env?.[key] || 
           (globalThis as any).process?.env?.[`VITE_${key}`] || 
           '';
  } catch (e) {
    return '';
  }
};

// Fix: Export environment variables to be used by other parts of the application (e.g. AdminTenants.tsx)
export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

export const isConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http')
);

// Inicialización resiliente del cliente.
// Si no está configurado (común en Preview), devolvemos null para que el Provider lo maneje.
export const supabase = isConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;
