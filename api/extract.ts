
import { GoogleGenAI, Type } from "@google/genai";

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default async function handler(req: Request) {
  const jsonHeaders = { 'Content-Type': 'application/json' };
  const requestId = Math.random().toString(36).substring(7).toUpperCase();

  console.log(`[${requestId}] [Extract] Recibido: Petición iniciada`);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido', requestId }), { status: 405, headers: jsonHeaders });
  }

  // Cambio solicitado: Solo usar VITE_GEMINI_API_KEY
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error(`[${requestId}] [Extract] Error: VITE_GEMINI_API_KEY no configurada`);
    return new Response(JSON.stringify({ 
      error: 'Falta VITE_GEMINI_API_KEY en las variables de entorno.', 
      code: 'KEY_MISSING',
      requestId 
    }), { status: 500, headers: jsonHeaders });
  }

  try {
    console.log(`[${requestId}] [Extract] Parseo: Procesando FormData`);
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No hay archivo', requestId }), { status: 400, headers: jsonHeaders });
    }

    if (file.size > 4.5 * 1024 * 1024) {
      console.warn(`[${requestId}] [Extract] Archivo rechazado por tamaño: ${file.size} bytes`);
      return new Response(JSON.stringify({ 
        error: 'Archivo demasiado grande (máx 4.5MB).', 
        code: 'FILE_TOO_LARGE',
        requestId 
      }), { status: 413, headers: jsonHeaders });
    }

    console.log(`[${requestId}] [Extract] Base64: Convirtiendo archivo ${file.name}`);
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = encode(new Uint8Array(arrayBuffer));

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = "HVAC Expert. Extract technical data to JSON. Languages: es/ca. Types: aire_acondicionado, caldera, termo_electrico.";

    console.log(`[${requestId}] [Extract] Llamada Gemini: Iniciando petición (Timeout 25s)`);
    
    const geminiCall = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: systemInstruction },
          { inlineData: { data: base64Data, mimeType: file.type || "application/pdf" } },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            model: { type: Type.STRING },
            type: { type: Type.STRING },
            stock: { type: Type.INTEGER },
            description: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
            pricing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
                  price: { type: Type.NUMBER },
                  cost: { type: Type.NUMBER }
                }
              }
            },
            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  months: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER }
                }
              }
            },
            techSpecs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { title: { type: Type.STRING }, value: { type: Type.STRING } }
              }
            }
          }
        }
      },
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('UPSTREAM_TIMEOUT')), 25000)
    );

    const response = await Promise.race([geminiCall, timeoutPromise]) as any;
    
    console.log(`[${requestId}] [Extract] Respuesta: Gemini ha respondido`);

    const raw = JSON.parse(response.text || "{}");
    
    const normalized = {
      ...raw,
      requestId,
      brand: raw.brand || "Desconocida",
      model: raw.model || "Desconocido",
      pricing: (raw.pricing || []).map((p: any, i: number) => ({
        id: `p${i + 1}`,
        name: p.name || { es: "Precio Base", ca: "Preu Base" },
        price: p.price || 0,
        cost: p.cost || 0
      })),
      __extracted_at: new Date().toISOString()
    };

    console.log(`[${requestId}] [Extract] Respond: Enviando JSON exitoso`);
    return new Response(JSON.stringify(normalized), { status: 200, headers: jsonHeaders });

  } catch (err: any) {
    console.error(`[${requestId}] [Extract] Error final:`, err.message || err);
    
    // Diagnóstico de errores de Gemini (Cuotas, permisos, etc)
    const errString = String(err).toLowerCase();
    
    if (err.message === 'UPSTREAM_TIMEOUT') {
      return new Response(JSON.stringify({ 
        error: "El motor de IA ha tardado demasiado en responder.", 
        code: "UPSTREAM_TIMEOUT",
        requestId
      }), { status: 504, headers: jsonHeaders });
    }

    if (errString.includes('429') || errString.includes('rate_limit') || errString.includes('quota')) {
      return new Response(JSON.stringify({ 
        error: "Límite de peticiones de IA excedido (Rate Limit).", 
        code: "RATE_LIMIT",
        requestId
      }), { status: 429, headers: jsonHeaders });
    }

    if (errString.includes('403') || errString.includes('permission_denied')) {
      return new Response(JSON.stringify({ 
        error: "Permiso denegado por la API de Google.", 
        code: "PERMISSION_DENIED",
        requestId
      }), { status: 403, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ 
      error: `Error interno: ${err.message || 'Error desconocido'}`,
      code: "INTERNAL_ERROR",
      requestId
    }), { status: 500, headers: jsonHeaders });
  }
}
