
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
    const defaultCategory = formData.get('defaultCategory') as string || 'aire_acondicionado'

    if (!file || file.size === 0) {
      return new Response(JSON.stringify({ error: "Falta el archivo o el documento está vacío." }), {
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

    const prompt = `Eres un experto en climatización y traducción técnica. Analiza el PDF adjunto y extrae los datos técnicos y comerciales en formato JSON estrictamente válido para una tienda online.
        
    IMPORTANTE: Para todos los campos de texto visibles al usuario (nombre, título, descripción, etiquetas), DEBES generar un objeto con traducciones en 4 idiomas: Español (es), Inglés (en), Catalán (ca) y Francés (fr).

    REGLAS:
    1. Precios (price, cost, commission, coefficient) deben ser NUMBER.
    2. "technical": Extrae datos técnicos clave como potencia, gas, eficiencia. Si no están, déjalos vacíos.
    3. Si el PDF tiene tablas de financiación con coeficientes (ej: 0.087), úsalos.
    4. "type": Infiere si es Aire Acondicionado, Aerotermia, Caldera o Termo Eléctrico.
    5. Devuelve SOLO el JSON válido, sin markdown.`

    const translationSchema = {
      type: Type.OBJECT,
      properties: {
        es: { type: Type.STRING },
        en: { type: Type.STRING },
        ca: { type: Type.STRING },
        fr: { type: Type.STRING }
      },
      required: ["es", "en", "ca", "fr"]
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
            reference: { type: Type.STRING },
            type: { type: Type.STRING },
            description: translationSchema,
            technical: {
              type: Type.OBJECT,
              properties: {
                powerCooling: { type: Type.STRING },
                powerHeating: { type: Type.STRING },
                efficiency: { type: Type.STRING },
                gasType: { type: Type.STRING },
                voltage: { type: Type.STRING },
                warranty: { type: Type.STRING }
              }
            },
            features: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: translationSchema,
                  description: translationSchema,
                  icon: { type: Type.STRING }
                },
                required: ["title", "description", "icon"]
              }
            },
            pricing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: translationSchema,
                  price: { type: Type.NUMBER },
                  cost: { type: Type.NUMBER }
                },
                required: ["id", "name", "price"]
              }
            },
            installationKits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: translationSchema,
                  price: { type: Type.NUMBER }
                },
                required: ["id", "name", "price"]
              }
            },
            extras: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: translationSchema,
                  price: { type: Type.NUMBER }
                },
                required: ["id", "name", "price"]
              }
            },
            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: translationSchema,
                  months: { type: Type.NUMBER },
                  commission: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER }
                },
                required: ["label", "months", "coefficient"]
              }
            }
          },
          required: ["brand", "model", "type", "description", "technical", "features", "pricing"]
        }
      }
    })

    const responseText = response.text;
    if (!responseText) {
      return new Response(JSON.stringify({ error: "La IA no pudo procesar el contenido." }), {
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
