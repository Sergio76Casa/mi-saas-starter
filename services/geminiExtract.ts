
/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Asegura que la respuesta sea JSON válido antes de procesarla y maneja timeouts.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  // Configurar un timeout de 45 segundos para la petición
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type');
    
    if (!response.ok) {
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      } else {
        if (response.status === 413) {
          throw new Error("El archivo es demasiado grande (máximo 4.5MB).");
        }
        if (response.status === 504) {
          throw new Error("El servidor ha tardado demasiado en responder (Timeout).");
        }
        throw new Error(`Error del servidor (${response.status}).`);
      }
    }

    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      throw new Error("La respuesta del servidor no es un JSON válido.");
    }
    
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("La extracción está tardando demasiado. Prueba con un archivo más pequeño.");
    }
    console.error("AI Extraction Service Error:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
