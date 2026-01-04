
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
      const code = data?.code || 'UNKNOWN_ERROR';
      
      if (code === 'UPSTREAM_TIMEOUT') {
        throw new Error(`El motor de IA ha tardado demasiado.${rid} Prueba con un archivo más ligero o una imagen.`);
      }
      
      if (code === 'FILE_TOO_LARGE' || response.status === 413) {
        throw new Error(`Archivo demasiado grande (máximo 4.5MB).${rid}`);
      }

      if (code === 'KEY_MISSING') {
        throw new Error(`Error de configuración: Falta VITE_GEMINI_API_KEY en el servidor.${rid}`);
      }

      if (code === 'RATE_LIMIT') {
        throw new Error(`Límite de cuota IA excedido. Espera un momento y vuelve a intentarlo.${rid}`);
      }

      if (code === 'PERMISSION_DENIED') {
        throw new Error(`La API Key no tiene permisos suficientes.${rid}`);
      }
      
      throw new Error(data?.error || `Error en el servidor (${code}).${rid}`);
    }

    if (!data) {
      throw new Error("El servidor no ha devuelto datos válidos.");
    }

    return data;
    
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("La conexión se ha cortado por falta de respuesta del navegador. Comprueba tu conexión a internet o usa un archivo más pequeño.");
    }
    console.error("Gemini Service Error:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
