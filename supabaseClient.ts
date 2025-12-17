import { createClient } from '@supabase/supabase-js';

// Función segura para obtener variables de entorno sin romper el navegador
const getEnv = (name: string): string => {
  try {
    // Intenta Vite
    if ((import.meta as any).env?.[name]) return (import.meta as any).env[name];
    // Intenta Process (Node/Vercel)
    if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name] || '';
    // Intenta Global
    if ((window as any).process?.env?.[name]) return (window as any).process.env[name];
  } catch (e) {
    // Ignorar errores
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing! Check your environment variables.");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');