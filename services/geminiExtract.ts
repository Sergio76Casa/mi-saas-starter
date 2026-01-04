/**
 * Servicio de extracción que llama a un endpoint interno del servidor (Vercel API Route).
 * Maneja timeouts y errores estructurados devolviendo mensajes claros al usuario.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

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
    let rawText = "";

    // Intentar leer respuesta siempre (JSON o texto)
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      rawText = await response.text().catch(() => "");
      // Intentar parsear JSON aunque el content-type venga mal
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const rid = data?.requestId ? ` [Ref: ${data.requestId}]` : "";
      const code = data?.code || "UNKNOWN_ERROR";

      // Timeouts típicos de Vercel / gateway
      if (response.status === 504 || response.status === 502) {
        throw new Error(
          `El servidor ha tardado demasiado en responder (timeout).${rid} Prueba con una imagen o un PDF más ligero.`
        );
      }

      if (code === "UPSTREAM_TIMEOUT") {
        throw new Error(
          `El motor de IA ha tardado demasiado.${rid} Prueba con un archivo más ligero o una imagen.`
        );
      }

      if (code === "FILE_TOO_LARGE" || response.status === 413) {
        throw new Error(`Archivo demasiado grande (máximo 4.5MB).${rid}`);
      }

      if (code === "KEY_MISSING") {
        throw new Error(
          `Error de configuración: Falta VITE_GEMINI_API_KEY en el servidor.${rid}`
        );
      }

      if (code === "RATE_LIMIT") {
        throw new Error(
          `Límite de cuota IA excedido. Espera un momento y vuelve a intentarlo.${rid}`
        );
      }

      if (code === "PERMISSION_DENIED") {
        throw new Error(`La API Key no tiene permisos suficientes.${rid}`);
      }

      // Si no hay JSON, muestra pista del texto (HTML, etc.)
      if (!data && rawText) {
        const snippet = rawText.slice(0, 120).replace(/\s+/g, " ");
        throw new Error(
          `Error del servidor (${response.status}). Respuesta no-JSON: "${snippet}..."${rid}`
        );
      }

      throw new Error(data?.error || `Error en el servidor (${code}).${rid}`);
    }

    if (!data) {
      throw new Error("El servidor no ha devuelto datos válidos.");
    }

    return data;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        "La conexión se ha cortado por falta de respuesta del navegador. Comprueba tu conexión o usa un archivo más pequeño."
      );
    }
    console.error("Gemini Service Error:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
