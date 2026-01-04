
/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Esto asegura que la API Key nunca se exponga al cliente y que el SDK de Gemini
 * se ejecute en un entorno de servidor compatible.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    // Llamada al endpoint local de Vercel /api/extract
    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error del servidor: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error("AI Extraction Service Error:", err);
    throw err;
  }
}
