
import { supabase } from '../supabaseClient';

/**
 * Servicio de extracción que delega la lógica pesada y sensible a una Edge Function en Supabase.
 * Esto evita exponer la API Key en el navegador y resuelve el error de validación del SDK de Gemini.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    // Invocamos la Edge Function 'ai-processor'
    // El SDK de Gemini se ejecutará en el servidor de Supabase
    const { data, error } = await supabase.functions.invoke('ai-processor', {
      body: formData,
    });

    if (error) {
      console.error("Error invoking AI function:", error);
      throw new Error(`Error en la extracción: ${error.message || 'Error desconocido'}`);
    }

    if (!data) {
      throw new Error("La función de extracción no devolvió datos válidos.");
    }

    return data;
  } catch (err: any) {
    console.error("AI Extraction Service Error:", err);
    throw err;
  }
}
