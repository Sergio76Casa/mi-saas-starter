
/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Asegura que la respuesta sea JSON válido antes de procesarla y maneja timeouts de forma clara.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  // Timeout frontend de 28 segundos para dar margen al timeout del servidor (25s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000);

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type');
    let errorData: any = null;

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        errorData = data;
      } else {
        return data;
      }
    }

    if (!response.ok) {
      if (errorData?.code === 'UPSTREAM_TIMEOUT') {
        throw new Error("El motor de IA ha tardado demasiado. Prueba de nuevo. Si el problema persiste, usa un PDF más ligero o una imagen.");
      }
      
      if (response.status === 413) {
        throw new Error("Archivo demasiado grande (máximo 4.5MB).");
      }
      
      if (response.status === 504 || response.status === 500) {
        throw new Error("La extracción ha fallado por tiempo. Prueba de nuevo o usa un PDF más ligero.");
      }

      throw new Error(errorData?.error || `Error de conexión (${response.status}).`);
    }

    throw new Error("La respuesta del servidor no es válida.");
    
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("Tiempo de espera agotado en el navegador. Prueba de nuevo. Si el problema persiste, usa un PDF más ligero o una imagen.");
    }
    console.error("Gemini Service Error:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
