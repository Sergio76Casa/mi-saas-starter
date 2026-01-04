
/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Maneja timeouts y errores estructurados devolviendo mensajes claros al usuario.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  // Timeout frontend de 35 segundos para dar margen al upload y al timeout del servidor (25s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type');
    let data: any = null;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const rid = data?.requestId ? ` [Ref: ${data.requestId}]` : '';
      
      if (data?.code === 'UPSTREAM_TIMEOUT') {
        throw new Error(`El motor de IA ha tardado demasiado.${rid} Prueba con un archivo más ligero o una imagen.`);
      }
      
      if (data?.code === 'FILE_TOO_LARGE' || response.status === 413) {
        throw new Error(`Archivo demasiado grande (máximo 4.5MB).${rid}`);
      }

      if (data?.code === 'KEY_MISSING') {
        throw new Error(`Error de configuración: Falta la API Key en el servidor.${rid}`);
      }
      
      throw new Error(data?.error || `Error de conexión (Status: ${response.status}).${rid}`);
    }

    if (!data) {
      throw new Error("El servidor no ha devuelto datos válidos.");
    }

    return data;
    
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("La subida o el procesamiento han tardado demasiado. Comprueba tu conexión o usa un archivo más pequeño.");
    }
    console.error("Gemini Service Error:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
