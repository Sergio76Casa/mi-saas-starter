
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI, Type } from "@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Método no permitido." }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file || file.size === 0) {
      return new Response(JSON.stringify({ error: "Falta el archivo o está vacío." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const arrayBuffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64Data = btoa(binary)

    const prompt = `Analiza este documento técnico de climatización. Extrae la información y organízala estrictamente en este formato JSON.
    
    INSTRUCCIONES DE EXTRACCIÓN:
    1. "technical_data": Lista de especificaciones (ej: Potencia frigorífica, Gas refrigerante, Dimensiones).
    2. "pricing": Lista de variantes del modelo (ej: 2.5kW, 3.5kW) con sus precios.
    3. "installation_kits": Kits de montaje sugeridos en el PDF.
    4. "extras": Materiales adicionales (tuberías, soportes, etc).
    5. "financing": Tabla de cuotas (Meses y Coeficientes).

    IMPORTANTE: Para cada campo de texto (nombre, etiqueta, descripción), genera un objeto con las traducciones: { "es": "...", "en": "...", "ca": "...", "fr": "..." }.`

    const translationSchema = {
      type: Type.OBJECT,
      properties: {
        es: { type: Type.STRING },
        en: { type: Type.STRING },
        ca: { type: Type.STRING },
        fr: { type: Type.STRING }
      },
      required: ["es", "en", "ca", "fr"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: file.type || 'application/pdf'
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            model: { type: Type.STRING },
            type: { type: Type.STRING, description: "Valores: aire_acondicionado, caldera, termo_electrico, aerotermia" },
            technical_data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: translationSchema,
                  value: { type: Type.STRING }
                },
                required: ["label", "value"]
              }
            },
            pricing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  variant_name: translationSchema,
                  price: { type: Type.NUMBER }
                },
                required: ["variant_name", "price"]
              }
            },
            installation_kits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: translationSchema,
                  price: { type: Type.NUMBER }
                },
                required: ["name", "price"]
              }
            },
            extras: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: translationSchema,
                  price: { type: Type.NUMBER }
                },
                required: ["name", "price"]
              }
            },
            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: translationSchema,
                  months: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER }
                },
                required: ["label", "months", "coefficient"]
              }
            }
          },
          required: ["brand", "model", "type", "technical_data", "pricing"]
        }
      }
    })

    return new Response(response.text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
