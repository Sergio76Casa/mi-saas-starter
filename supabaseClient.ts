import { createClient } from '@supabase/supabase-js';

const getEnv = (name: string): string => {
  try {
    // 1. Intentar acceder vía import.meta.env (Vite estándar)
    if (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env?.[name]) {
      const val = (import.meta as any).env[name];
      if (val && val !== 'undefined' && val !== 'null') return val;
    }
    
    // 2. Intentar acceder vía process.env (Vercel/Node/Bundlers)
    if (typeof process !== 'undefined' && process.env?.[name]) {
      const val = process.env[name];
      if (val && val !== 'undefined' && val !== 'null') return val;
    }

    // 3. Búsqueda en window (algunas inyecciones directas de scripts)
    if (typeof window !== 'undefined' && (window as any)._env_?.[name]) {
      return (window as any)._env_[name];
    }
  } catch (e) {
    // Silenciar errores de acceso
  }
  return '';
};

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Verificación estricta: No debe ser vacío ni el string literal 'placeholder'
export const isConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http') &&
  SUPABASE_URL !== 'https://placeholder.supabase.co'
);

// Inicialización segura
export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co', 
  isConfigured ? SUPABASE_ANON_KEY : 'placeholder'
);