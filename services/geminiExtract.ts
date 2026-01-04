
/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Asegura que la respuesta sea JSON válido antes de procesarla y maneja timeouts de forma clara.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  // Timeout ajustado a 18 segundos para dar margen sobre el límite de Vercel (10s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

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
          throw new Error("Archivo demasiado grande (máximo 4.5MB).");
        }
        if (response.status === 504 || response.status === 500) {
          throw new Error("La extracción ha tardado demasiado. Prueba de nuevo. Si el problema persiste, usa un PDF más ligero o una imagen. En planes con más tiempo de ejecución, la extracción es más estable.");
        }
        throw new Error(`Error de conexión (${response.status}).`);
      }
    }

    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      throw new Error("La respuesta del servidor no es válida.");
    }
    
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("Tiempo de espera agotado. Prueba de nuevo. Si el problema persiste, usa un PDF más ligero o una imagen. En planes con más tiempo de ejecución, la extracción es más estable.");
    }
    console.error("Gemini Service Error:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
