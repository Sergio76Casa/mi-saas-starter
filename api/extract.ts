
import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
};

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

  console.log(`[${requestId}] [Extract] Recibido: Petición iniciada en Edge Runtime`);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido', requestId }), { status: 405, headers: jsonHeaders });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error(`[${requestId}] [Extract] Error: VITE_GEMINI_API_KEY no configurada`);
    return new Response(JSON.stringify({ 
      error: 'Configuración incompleta: Falta VITE_GEMINI_API_KEY.', 
      code: 'KEY_MISSING',
      requestId 
    }), { status: 500, headers: jsonHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No se recibió ningún archivo', requestId }), { status: 400, headers: jsonHeaders });
    }

    if (file.size > 4.5 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: 'Archivo demasiado grande (máx 4.5MB).', 
        code: 'FILE_TOO_LARGE',
        requestId 
      }), { status: 413, headers: jsonHeaders });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = encode(new Uint8Array(arrayBuffer));

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = "HVAC Expert. Extract technical data and installation materials/extras to JSON. Languages: es/ca. For extras: if quantity is missing use 1. If unit price is missing but total exists, unit_price = total / qty.";

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
            extras: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  unit_price: { type: Type.NUMBER }
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
      extras: (raw.extras || []).map((e: any) => ({
        name: e.name || "Material extra",
        qty: e.qty || 1,
        unit_price: e.unit_price || 0
      })),
      __extracted_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(normalized), { status: 200, headers: jsonHeaders });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
      error: `Fallo en la extracción: ${err.message || 'Error desconocido'}`,
      code: err.message === 'UPSTREAM_TIMEOUT' ? "UPSTREAM_TIMEOUT" : "INTERNAL_ERROR",
      requestId
    }), { status: 500, headers: jsonHeaders });
  }
}
