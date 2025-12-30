
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
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) throw new Error("No file provided");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const systemPrompt = `Extrae datos técnicos del producto. Idiomas: 'es' y 'ca'. Tipo: aire_acondicionado|aerotermia|caldera|termo_electrico. Números: sin símbolos.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { parts: [{ text: systemPrompt }, { inlineData: { data: base64Data, mimeType: file.type || 'application/pdf' } }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            model: { type: Type.STRING },
            type: { type: Type.STRING },
            price: { type: Type.NUMBER },
            description: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
            technical: { type: Type.OBJECT, properties: { powerCooling: { type: Type.STRING }, efficiency: { type: Type.STRING } } },
            pricing: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } }, price: { type: Type.NUMBER } } } },
            installationKits: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } }, price: { type: Type.NUMBER } } } },
            extras: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } }, price: { type: Type.NUMBER } } } },
            financing: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } }, months: { type: Type.NUMBER }, coefficient: { type: Type.NUMBER } } } }
          }
        }
      }
    });

    const raw = JSON.parse(response.text || '{}');
    
    // --- POST-PROCESADO ROBUSTO ---
    const toNum = (v: any) => {
      if (typeof v === 'number') return v;
      const n = parseFloat(String(v || '0').replace(',', '.').replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? 0 : n;
    };

    const normI18n = (obj: any, def = "") => ({
      es: obj?.es || obj?.ca || def,
      ca: obj?.ca || obj?.es || def
    });

    const normType = (t: string) => {
      const val = String(t || '').toLowerCase();
      if (val.includes('aire')) return 'aire_acondicionado';
      if (val.includes('aero')) return 'aerotermia';
      if (val.includes('cald')) return 'caldera';
      if (val.includes('term')) return 'termo_electrico';
      return 'aire_acondicionado';
    };

    // Construcción final garantizada
    const clean = {
      brand: raw.brand || "Marca desconocida",
      model: raw.model || "Modelo desconocido",
      type: normType(raw.type || raw.category || ""),
      description: normI18n(raw.description),
      technical: raw.technical || {},
      // Garantizar que pricing tenga al menos 1 fila y use el price raíz si existe
      pricing: (raw.pricing && raw.pricing.length > 0) 
        ? raw.pricing.map((p: any) => ({ name: normI18n(p.name, "Estándar"), price: toNum(p.price) }))
        : [{ name: { es: "Precio Base", ca: "Preu Base" }, price: toNum(raw.price || 0) }],
      // Garantizar kits
      installationKits: (raw.installationKits && raw.installationKits.length > 0)
        ? raw.installationKits.map((k: any) => ({ name: normI18n(k.name), price: toNum(k.price) }))
        : [{ name: { es: "Instalación Básica", ca: "Instal·lació Bàsica" }, price: 0 }],
      // Garantizar extras
      extras: (raw.extras && raw.extras.length > 0)
        ? raw.extras.map((e: any) => ({ name: normI18n(e.name), price: toNum(e.price) }))
        : [{ name: { es: "Soportes", ca: "Suports" }, price: 0 }],
      // Garantizar financiación con coeficientes reales si faltan
      financing: (raw.financing && raw.financing.length > 0)
        ? raw.financing.map((f: any) => ({ label: normI18n(f.label), months: toNum(f.months), coefficient: toNum(f.coefficient) }))
        : [
            { label: { es: "12 Meses", ca: "12 Mesos" }, months: 12, coefficient: 0.087 },
            { label: { es: "24 Meses", ca: "24 Mesos" }, months: 24, coefficient: 0.045 }
          ]
    };

    // Alias para compatibilidad con el frontend anterior
    (clean as any).installation_kits = clean.installationKits;

    return new Response(JSON.stringify(clean), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
