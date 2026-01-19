import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function extractJson(text: string) {
  // Quita fences ```json ... ```
  const cleaned = text.replace(/```json|```/g, "").trim();
  // Intenta recortar al primer { y último }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Gemini no devolvió un JSON válido.");
  }
  const slice = cleaned.slice(first, last + 1);
  return JSON.parse(slice);
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  mimeType: string;
  base64: string;
}) {
  const { apiKey, model, mimeType, base64 } = params;

  // Endpoint oficial Gemini API (REST)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const prompt = `
Devuelve SOLO JSON válido (sin markdown).
Extrae productos desde el documento/imagen.

Formato:
{
  "products": [
    {
      "name": "string",
      "brand": "string",
      "model": "string",
      "description": "string",
      "category": "Aire Acondicionado" | "Calderas" | "Termos electricos",
      "price": number,
      "features": ["string", "..."]
    }
  ]
}

Reglas:
- category OBLIGATORIA: debe ser una de esas 3.
- price: número (sin símbolo €).
- Si no se detecta algún campo, usa "" (string vacío) y price = 0.
- No inventes modelos/precios si no aparecen.
`.trim();

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gemini HTTP ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      ?.filter(Boolean)
      ?.join("\n") ?? "";

  if (!text) throw new Error("Gemini devolvió respuesta vacía.");
  return extractJson(text);
}

Deno.serve(async (req: Request) => {
  // Preflight CORS SIEMPRE OK (y sin intentar leer body)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json(500, { error: "Missing GEMINI_API_KEY secret" });

    const contentType = req.headers.get("content-type") ?? "";

    let file: File | null = null;

    // 1) Caso normal: multipart/form-data (subida de archivo)
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const f = form.get("file");
      if (f instanceof File) file = f;
    }

    // 2) Fallback: JSON con base64 (por si tu frontend no usa FormData)
    if (!file && contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      const b64 = body?.base64;
      const mime = body?.mimeType || "application/octet-stream";
      if (typeof b64 === "string") {
        // fabricamos un "File" virtual
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        file = new File([bytes], "upload", { type: mime });
      }
    }

    if (!file) {
      return json(400, { error: "No se ha encontrado el archivo en el campo 'file'." });
    }

    const mimeType = file.type || "application/octet-stream";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = encodeBase64(bytes);

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    const result = await callGemini({ apiKey, model, mimeType, base64 });

    const products = Array.isArray(result?.products) ? result.products : [];
    return json(200, { ok: true, products });
  } catch (e) {
    console.error("extract_products_from_file error:", e);
    return json(500, { ok: false, error: String((e as any)?.message ?? e) });
  }
});
