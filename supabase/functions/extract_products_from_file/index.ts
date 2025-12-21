import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.34.0"

// Encabezados CORS robustos para peticiones desde el navegador
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Manejo crítico de la petición preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    // Validar que el método sea POST
    if (req.method !== 'POST') {
      throw new Error("Solo se permiten peticiones POST");
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const defaultCategory = formData.get('defaultCategory') as string || 'aire_acondicionado'

    if (!file) {
      throw new Error("No se ha proporcionado ningún archivo en la petición.");
    }

    // Fix: Use process.env.API_KEY directly as per mandatory guidelines and removed prohibited manual definition of process.env
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Procesamiento del archivo a Base64
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

    // Uso de gemini-3-flash-preview para tareas de extracción
    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: file.type
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    })

    // Acceso directo a .text según las especificaciones del SDK
    const responseText = result.text;
    
    if (!responseText) {
      throw new Error("El modelo de IA no pudo generar una respuesta válida para este archivo.");
    }

    return new Response(responseText, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })

  } catch (error: any) {
    console.error("Edge Function Error:", error.message);
    
    // Todas las respuestas de error deben incluir también los encabezados CORS
    return new Response(JSON.stringify({ 
      error: error.message || "Error interno al procesar el archivo con IA." 
    }), {
      status: 400,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })
  }
})
