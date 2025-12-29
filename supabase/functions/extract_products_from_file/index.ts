
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
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const prompt = `Analiza este documento de climatización y extrae los datos técnicos.
    DEVUELVE ÚNICAMENTE UN JSON PLANO SIN TRADUCCIONES.
    REGLAS:
    1. 'brand' y 'model' deben ser STRINGS simples.
    2. 'type' debe ser: aire_acondicionado, caldera, termo_electrico o aerotermia.
    3. Si no encuentras un campo, deja el string vacío o el array vacío.`

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType: file.type || 'application/pdf' } }
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
                  label: { type: Type.STRING },
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
                  variant: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                },
                required: ["variant", "price"]
              }
            },
            installation_kits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                }
              }
            },
            extras: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                }
              }
            },
            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  months: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ["brand", "model", "type", "pricing"]
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
