
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
      return new Response(JSON.stringify({ error: "Archivo no válido." }), {
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

    const prompt = `Analiza este catálogo técnico de climatización y extrae TODA la información disponible.
    
    ESPECIFICACIONES DE EXTRACCIÓN:
    1. Marca y Modelo: Extrae el nombre comercial.
    2. Datos Técnicos: Busca tablas de especificaciones (Potencia, Gas, SEER/SCOP, Dimensiones).
    3. Kits de Instalación: Busca nombres de kits y sus precios.
    4. Extras: Busca materiales adicionales (metros de tubería, soportes, bombas) y precios.
    5. Financiación: Busca tablas de cuotas (Meses, Coeficientes, Comisiones).

    REGLA DE IDIOMAS: Para cualquier texto descriptivo, genera un objeto con las claves: "es", "en", "ca", "fr".

    IMPORTANTE: Devuelve SOLO el JSON siguiendo estrictamente el esquema definido.`

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
            product_type: { type: Type.STRING, description: "aire_acondicionado, caldera, termo_electrico, aerotermia" },
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
            prices: {
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
            kits: {
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
                  coefficient: { type: Type.NUMBER },
                  commission: { type: Type.NUMBER }
                },
                required: ["label", "months", "coefficient"]
              }
            }
          },
          required: ["brand", "model", "product_type", "technical_data", "prices"]
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
