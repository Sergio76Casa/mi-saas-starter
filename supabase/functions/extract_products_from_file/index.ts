import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.34.0"

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

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Error de configuración: API_KEY no encontrada." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const arrayBuffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64Data = btoa(binary)

    const prompt = `Analiza este documento y extrae una lista de productos para un catálogo de climatización.
    
    Responde ÚNICAMENTE con un objeto JSON con esta estructura:
    {
      "products": [
        { 
          "brand": "MARCA (Ej: LG, Daikin)", 
          "model": "MODELO/SERIE (Ej: Libero Smart, Sensira)", 
          "variant": "VARIANTE/POTENCIA (Ej: SM 09, TXC35D, 12L)",
          "description": "Descripción técnica concisa", 
          "price": 123.45, 
          "category": "aire_acondicionado | caldera | termo_electrico"
        }
      ],
      "error": "Mensaje si no hay productos o el archivo es ilegible, de lo contrario null"
    }
    
    Reglas Estrictas:
    1. SEGMENTACIÓN: Separa marca de modelo y de variante.
    2. NORMALIZACIÓN BRAND: Mayúsculas consistentes (Ej: "MITSUBISHI").
    3. NORMALIZACIÓN MODEL: Nombre de la serie sin la marca delante.
    4. NORMALIZACIÓN VARIANT: El código de potencia o modelo específico que diferencia precios.
    5. CATEGORY: Usar "${defaultCategory}" si no se detecta otra claramente.
    6. No respondas con texto descriptivo, solo el JSON puro.`

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
        responseMimeType: "application/json"
      }
    })

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
