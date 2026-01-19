
import { supabase } from "../supabaseClient";

/**
 * Servicio de extracción que llama a la Supabase Edge Function.
 * Usa fetch nativo para evitar problemas de conectividad del SDK en algunos entornos.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuración de Supabase no encontrada en las variables de entorno.");
  }

  try {
    const formData = new FormData();
    formData.append("file", file);

    console.log('[DEBUG] Iniciando extracción IA vía Fetch nativo...');

    const functionUrl = `${supabaseUrl}/functions/v1/extract-ia`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        // No establecer Content-Type manualmente al usar FormData, el navegador lo hace con el boundary correcto
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido en la respuesta' }));
      console.error('[DEBUG] Error en la respuesta de la función:', errorData);
      throw new Error(errorData.error || `Error del servidor (${response.status})`);
    }

    const data = await response.json();
    console.log('[DEBUG] Extracción IA completada con éxito.');
    return data;

  } catch (err: any) {
    console.error('[DEBUG] Error crítico en geminiExtract:', err);

    if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      throw new Error("No se pudo conectar con el servicio de IA. Por favor, verifica tu conexión a internet o los permisos de CORS.");
    }

    throw err;
  }
}
