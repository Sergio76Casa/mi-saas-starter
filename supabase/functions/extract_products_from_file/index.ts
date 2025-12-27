

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Always use import {GoogleGenAI} from "@google/genai";
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
    const defaultCategory = formData.get('defaultCategory') as string || 'aire_acondicionado'

    if (!file || file.size === 0) {
      return new Response(JSON.stringify({ error: "Falta el archivo o el documento está vacío." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Always use the API key directly from process.env.API_KEY as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const arrayBuffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64Data = btoa(binary)

    const prompt = `Analiza este documento y extrae una lista de productos para un catálogo de climatización.
    
    Reglas Estrictas:
    1. SEGMENTACIÓN: Separa marca de modelo y de variante.
    2. NORMALIZACIÓN BRAND: Mayúsculas consistentes (Ej: "MITSUBISHI").
    3. NORMALIZACIÓN MODEL: Nombre de la serie sin la marca delante.
    4. NORMALIZACIÓN VARIANT: El código de potencia o modelo específico que diferencia precios.
    5. CATEGORY: Usar "${defaultCategory}" si no se detecta otra claramente.`

    // Using gemini-3-flash-preview for document extraction tasks
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
        // The recommended way is to configure a responseSchema for the expected output
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  brand: { type: Type.STRING },
                  model: { type: Type.STRING },
                  variant: { type: Type.STRING },
                  description: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                },
                required: ["brand", "model", "price", "category"]
              }
            },
            error: { type: Type.STRING }
          },
          required: ["products"]
        }
      }
    })

    // Access text output using the .text property directly.
    const responseText = response.text;
    if (!responseText) {
      return new Response(JSON.stringify({ error: "La IA no pudo procesar el contenido del archivo." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(responseText, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error("Error en Edge Function:", err.message)
    return new Response(JSON.stringify({ 
      error: "Error interno al procesar el documento." 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
