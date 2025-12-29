
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
      return new Response(JSON.stringify({ error: "Falta el archivo o el documento está vacío." }), {
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

    const prompt = `Analiza este documento técnico de climatización y extrae TODA la información siguiendo este esquema JSON. 
    Es vital que para cada texto (nombres, títulos, descripciones) generes traducciones en ES, EN, CA, FR.
    
    Extrae específicamente:
    1. Datos de marca y modelo.
    2. Especificaciones técnicas (potencia, eficiencia, gas, etc.).
    3. Variantes de precio del modelo principal.
    4. Kits de instalación opcionales.
    5. Materiales extras y sus precios.
    6. Tabla de financiación (meses y coeficientes).

    Devuelve ÚNICAMENTE el JSON.`

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
            technical_specs: {
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
            pricing_variants: {
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
            financing_table: {
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
          required: ["brand", "model", "type", "technical_specs", "pricing_variants"]
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
