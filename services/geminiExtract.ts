
/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Asegura que la respuesta sea JSON válido antes de procesarla.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type');
    
    // Si la respuesta no es satisfactoria
    if (!response.ok) {
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      } else {
        // Manejo de errores 413 (Payload Too Large) o 500 HTML de Vercel
        if (response.status === 413) {
          throw new Error("El archivo excede el límite permitido por el servidor.");
        }
        throw new Error(`Error del servidor (${response.status}). No se pudo obtener JSON.`);
      }
    }

    // Verificar que el cuerpo sea realmente JSON antes de parsear
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      const text = await response.text();
      console.error("Unexpected response body:", text);
      throw new Error("La respuesta del servidor no tiene el formato esperado (JSON).");
    }
    
  } catch (err: any) {
    console.error("AI Extraction Service Error:", err);
    throw err;
  }
}
