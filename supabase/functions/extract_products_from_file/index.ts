import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "@google/genai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const defaultCategory = formData.get('defaultCategory') as string || 'aire_acondicionado'

    if (!file) throw new Error("No se ha subido ningún archivo")

    // Fix: Access the API key exclusively via process.env.API_KEY as per the @google/genai coding guidelines.
    // The environment assumes this variable is pre-configured and accessible in this context.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Conversión de archivo a base64 para el SDK de Gemini
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
    
    Reglas:
    1. Si no detectas la categoría, usa obligatoriamente: ${defaultCategory}
    2. El precio debe ser un número sin símbolos.
    3. Solo devuelve el JSON, sin texto extra.`

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

    // Access the .text property directly as per the @google/genai documentation (not a method).
    const responseText = result.text;
    if (!responseText) throw new Error("La IA no devolvió contenido");

    return new Response(responseText, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    // IMPORTANTE: Incluir corsHeaders en la respuesta de error para que el browser pueda leerla
    return new Response(JSON.stringify({ error: error.message || "Error desconocido en el servidor" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})