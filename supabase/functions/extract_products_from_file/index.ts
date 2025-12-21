import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Always use import {GoogleGenAI} from "@google/genai";
import { GoogleGenAI } from "@google/genai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // 1. Manejo inmediato de preflight OPTIONS (siempre 200 con headers)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    // 2. Validación de método (Solo POST permitido)
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Método no permitido" }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Procesamiento de FormData para archivos
    const formData = await req.formData()
    const file = formData.get('file') as File
    const defaultCategory = formData.get('defaultCategory') as string || 'aire_acondicionado'

    if (!file) {
      return new Response(JSON.stringify({ error: "No se ha proporcionado ningún archivo en el campo 'file'." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Inicialización de Gemini
    // Fix: Use process.env.API_KEY as per GenAI coding guidelines and avoid Deno.env to resolve TS error.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY })
    
    // Conversión del archivo a Base64
    const arrayBuffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64Data = btoa(binary)

    const prompt = `Analiza este documento y extrae una lista de productos para un catálogo de climatización.
    Debes devolver un JSON con esta estructura exacta:
    {
      "products": [
        { 
          "name": "Nombre comercial", 
          "description": "Breve descripción técnica", 
          "price": 123.45, 
          "category": "aire_acondicionado | caldera | termo_electrico",
          "is_active": true
        }
      ]
    }
    
    Reglas de extracción:
    1. Si no detectas la categoría, usa obligatoriamente: ${defaultCategory}
    2. El precio debe ser un número (float) sin símbolos de moneda ni puntos como separadores de miles.
    3. Responde únicamente con el bloque JSON, sin texto adicional.`

    // Uso del modelo gemini-3-flash-preview (recomendado para tareas de extracción)
    // Always use ai.models.generateContent to query GenAI.
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

    // Extracción del texto generado (propiedad .text, no método)
    const responseText = response.text
    if (!responseText) {
      throw new Error("La IA no devolvió una respuesta válida.")
    }

    return new Response(responseText, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })

  } catch (err: any) {
    console.error("Error en extract_products_from_file:", err.message)
    
    // 6. Respuesta de error siempre con CORS
    return new Response(JSON.stringify({ 
      error: err.message || "Error interno del servidor al procesar con IA." 
    }), {
      status: 400,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })
  }
})
