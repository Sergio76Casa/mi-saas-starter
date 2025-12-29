
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
      return new Response(JSON.stringify({ error: "Documento no detectado." }), {
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

    const prompt = `Analiza este documento técnico de climatización y devuelve un JSON con esta estructura exacta. 
    Traduce todos los campos de texto (labels, names) a los idiomas: es, ca, en, fr.
    
    ESTRUCTURA REQUERIDA:
    - brand: Nombre de la marca.
    - model: Nombre del modelo.
    - type: "aire_acondicionado", "caldera", "termo_electrico" o "aerotermia".
    - pricing_list: [{ "name": { "es": "...", "ca": "..." }, "price": 0 }]
    - technical_data: [{ "label": { "es": "...", "ca": "..." }, "value": "..." }]
    - kits: [{ "name": { "es": "...", "ca": "..." }, "price": 0 }]
    - extras: [{ "name": { "es": "...", "ca": "..." }, "price": 0 }]
    - financing: [{ "label": { "es": "...", "ca": "..." }, "months": 12, "coefficient": 0 }]`

    const translationSchema = {
      type: Type.OBJECT,
      properties: {
        es: { type: Type.STRING },
        ca: { type: Type.STRING },
        en: { type: Type.STRING },
        fr: { type: Type.STRING }
      },
      required: ["es", "ca"]
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
            type: { type: Type.STRING },
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
            pricing_list: {
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
                  coefficient: { type: Type.NUMBER }
                },
                required: ["label", "months", "coefficient"]
              }
            }
          },
          required: ["brand", "model", "type", "technical_data", "pricing_list"]
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
