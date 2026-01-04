
import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
};

/**
 * Función manual para convertir bytes a base64 (según directrices).
 */
function encodeToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Falta la configuración de VITE_GEMINI_API_KEY en el servidor' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se proporcionó ningún archivo' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = encodeToBase64(new Uint8Array(arrayBuffer));

    const systemInstruction = `
      Extract HVAC technical data, FINANCING, and STOCK from the provided document.
      Languages: es/ca. 
      IMPORTANT: The field 'type' MUST be exactly one of these: 'aire_acondicionado', 'caldera', 'termo_electrico'.
      Return only valid JSON.
    `.trim();

    const response = await ai.models.generateContent({
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
            reference: { type: Type.STRING },
            type: { type: Type.STRING },
            status: { type: Type.STRING },
            stock: { type: Type.INTEGER },
            description: { 
              type: Type.OBJECT, 
              properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } 
            },
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
                  label: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
                  months: { type: Type.NUMBER },
                  commission: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER }
                }
              }
            },
            techSpecs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  value: { type: Type.STRING }
                }
              }
            }
          }
        }
      },
    });

    const raw = JSON.parse(response.text || "{}");
    
    // Normalización de datos para el frontend
    const normalized = {
      brand: raw.brand || "Desconocida",
      model: raw.model || "Desconocido",
      reference: raw.reference || "",
      type: raw.type || "aire_acondicionado",
      status: (['active', 'draft', 'inactive'].includes(raw.status) ? raw.status : 'active'),
      stock: raw.stock || 0,
      description: raw.description || { es: "", ca: "" },
      pricing: (raw.pricing || []).map((p: any, i: number) => ({
        id: `p${i + 1}`,
        name: p.name || { es: "Precio Base", ca: "Preu Base" },
        price: p.price || 0,
        cost: p.cost || 0
      })),
      financing: (raw.financing || []).map((f: any, i: number) => ({
        id: `f${i + 1}`,
        label: f.label || { es: `${f.months || 12} meses`, ca: `${f.months || 12} mesos` },
        months: f.months || 12,
        commission: f.commission || 0,
        coefficient: f.coefficient || 0.087
      })),
      techSpecs: (raw.techSpecs || []).map((t: any) => ({
        title: t.title || "",
        description: t.value || t.description || ""
      })).filter((x: any) => x.title),
      __extracted_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error("Vercel API Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
