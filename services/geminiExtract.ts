
/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Maneja timeouts y errores estructurados devolviendo mensajes claros al usuario.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  // Reducido a 20s en el cliente; el servidor cortará a los 10s de todos modos.
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      body: formData,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    let data: any = null;

    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      const rawText = await response.text().catch(() => "");
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const rid = data?.requestId ? ` [Ref: ${data.requestId}]` : "";
      const code = data?.code || "UNKNOWN_ERROR";

      if (code === "UPSTREAM_TIMEOUT" || response.status === 504) {
        throw new Error(`El motor de IA ha tardado demasiado.${rid} Prueba con una imagen o PDF más ligero.`);
      }

      if (code === "FILE_TOO_LARGE") {
        throw new Error(`Archivo demasiado grande (máximo 4.5MB).${rid}`);
      }

      if (code === "KEY_MISSING") {
        throw new Error(`Error de configuración: VITE_GEMINI_API_KEY no configurada en el servidor.${rid}`);
      }

      throw new Error(data?.error || `Error en el servidor (${response.status}).${rid}`);
    }

    if (!data) throw new Error("El servidor no ha devuelto datos válidos.");

    return data;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("La conexión se ha cortado. Comprueba tu conexión o usa un archivo más pequeño.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
