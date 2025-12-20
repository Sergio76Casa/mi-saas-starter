import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Fix: Always use the standard import for @google/genai
import { GoogleGenAI } from "@google/genai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const defaultCategory = formData.get('defaultCategory') as string || 'aire_acondicionado'

    if (!file) throw new Error("No file uploaded")

    // Fix: Obtain API key exclusively from process.env.API_KEY as per coding guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Convert file to base64 for processing with Gemini
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Fix: Select an appropriate model name (gemini-3-flash-preview) for multimodal extraction tasks
    const modelName = 'gemini-3-flash-preview'
    
    const prompt = `Analiza este documento y extrae una lista de productos para un catálogo de climatización.
    Debes devolver un JSON con esta estructura:
    {
      "products": [
        { 
          "name": "Nombre comercial del producto", 
          "description": "Breve descripción técnica", 
          "price": 123.45, 
          "category": "aire_acondicionado | caldera | termo_electrico",
          "is_active": true
        }
      ]
    }
    
    Reglas:
    1. Si no puedes detectar la categoría, usa obligatoriamente: ${defaultCategory}
    2. El precio debe ser un número sin símbolos de moneda.
    3. Responde exclusivamente con el JSON.`

    // Fix: Use the correct contents structure with parts and approved configuration
    const result = await ai.models.generateContent({
      model: modelName,
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

    // Fix: Access the extracted text output directly via the .text property
    const text = result.text
    return new Response(text, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
