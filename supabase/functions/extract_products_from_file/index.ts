
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

    const prompt = `Analiza este catálogo de climatización. Extrae la información técnica y comercial. 
    IMPORTANTE: Todos los nombres, etiquetas y marcas DEBEN ser objetos con traducciones es y ca.`

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
            brand: translationSchema,
            model: translationSchema,
            type: { type: Type.STRING, description: "aire_acondicionado, caldera, termo_electrico, aerotermia" },
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
                  variant: translationSchema,
                  price: { type: Type.NUMBER }
                },
                required: ["variant", "price"]
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
