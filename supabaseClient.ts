import { createClient } from '@supabase/supabase-js';

const getEnv = (name: string): string => {
  if (typeof window === 'undefined') return '';

  // Prioridad 0: LocalStorage (Configuración manual del usuario)
  const manualValue = localStorage.getItem(`MANUAL_${name}`);
  if (manualValue && manualValue !== 'undefined') return manualValue;

  // Lista de posibles candidatos de variables de entorno
  const candidates = [
    name,
    `VITE_${name}`,
    `NEXT_PUBLIC_${name}`,
    `REACT_APP_${name}`
  ];

  for (const candidate of candidates) {
    try {
      const val = (import.meta as any).env?.[candidate];
      if (val && val !== 'undefined' && val !== 'null') return val;
    } catch (e) {}

    try {
      const val = (process as any).env?.[candidate];
      if (val && val !== 'undefined' && val !== 'null') return val;
    } catch (e) {}
  }

  return '';
};

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

// DETECTAR SI ESTAMOS EN VERCEL PREVIEW
const isVercelPreview = typeof window !== 'undefined' && 
  window.location.hostname.includes('vercel.app') && 
  !window.location.hostname.includes('mi-saas-starter.vercel.app');

if (typeof window !== 'undefined') {
  const isManual = !!localStorage.getItem('MANUAL_SUPABASE_URL');
  console.group('%c🚀 Vercel Environment Debugger', 'color: #000; background: #fff; padding: 2px 5px; border-radius: 3px; font-weight: bold;');
  console.log('Entorno:', isVercelPreview ? '🔍 PREVIEW' : '🌍 PRODUCTION/LOCAL');
  console.log('Origen Config:', isManual ? '🛠️ MANUAL (LocalStorage)' : '🛰️ SISTEMA (Env Vars)');
  console.log('URL de Supabase:', SUPABASE_URL ? '✅ Cargada' : '❌ NO DETECTADA');
  console.groupEnd();
}

export const isConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http')
);

export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co', 
  isConfigured ? SUPABASE_ANON_KEY : 'placeholder'
);

// Función para guardar configuración manual
export const saveManualConfig = (url: string, key: string) => {
  localStorage.setItem('MANUAL_SUPABASE_URL', url.trim());
  localStorage.setItem('MANUAL_SUPABASE_ANON_KEY', key.trim());
  window.location.reload(); // Recargar para aplicar cambios
};

// Función para limpiar configuración manual
export const clearManualConfig = () => {
  localStorage.removeItem('MANUAL_SUPABASE_URL');
  localStorage.removeItem('MANUAL_SUPABASE_ANON_KEY');
  window.location.reload();
};