import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.34.0"

// Encabezados CORS obligatorios para que el navegador permita la petición
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // 1. Manejo de Preflight (OPTIONS)
  // Esta parte resuelve el error de "CORS" y el 500 por intentar leer un body inexistente en OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    // 2. Validación de método POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Método no permitido. Use POST." }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Extracción de FormData
    // NO se usa req.json() para evitar "Unexpected end of JSON input" con multipart/form-data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const defaultCategory = formData.get('defaultCategory') as string || 'aire_acondicionado'

    if (!file) {
      return new Response(JSON.stringify({ error: "No se ha encontrado el archivo en el campo 'file'." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Inicialización de Gemini 
    // Siempre usar process.env.API_KEY para la clave de API
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Procesar archivo a Base64
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
    2. El precio debe ser un número (float) sin símbolos de moneda ni separadores de miles de texto.
    3. Responde únicamente con el bloque JSON, sin texto explicativo.`

    // 5. Generación de contenido con Gemini 3 Flash
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

    // Acceso a .text (propiedad, no método)
    const responseText = response.text;
    if (!responseText) {
      throw new Error("El modelo de IA no devolvió datos legibles.");
    }

    // 6. Respuesta exitosa con CORS
    return new Response(responseText, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })

  } catch (err: any) {
    console.error("Error en extract_products_from_file:", err.message)
    
    // 7. Respuesta de error con CORS
    return new Response(JSON.stringify({ 
      error: err.message || "Error al procesar el archivo con IA." 
    }), {
      status: 400,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })
  }
})