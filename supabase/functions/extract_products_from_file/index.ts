import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Prompt mejorado: más directivo para tablas de precio/kits/financiación y i18n es/ca
    const systemPrompt = `
Eres un extractor de fichas de producto desde PDFs e imágenes.

Objetivo: devolver SOLO un JSON válido que cumpla el schema.
Idiomas: SOLO 'es' y 'ca'. Si falta catalán, copia el español (y viceversa).
Números: devuelve NUMBER sin símbolos (€), sin separadores de miles, con punto decimal.
type: normaliza a uno de: aire_acondicionado | aerotermia | caldera | termo_electrico

INSTRUCCIONES DE EXTRACCIÓN (busca en tablas y texto):
- Marca (brand), modelo (model), referencia/SKU (reference), descripción comercial.
- Precio/PVP/tarifa: si hay varios, crea variantes en pricing[].
- Kits/instalación/material incluido: installationKits[].
- Extras/accesorios: extras[].
- Financiación: busca "financiación", "cuotas", "meses", "coeficiente", "TIN/TAE".
- Datos técnicos: potencia frío/calor, eficiencia, gas, voltaje, garantía.

Si una sección NO existe en el documento, devuelve el array vacío (el backend aplicará defaults).
Devuelve SOLO JSON. Sin texto adicional.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type || "application/pdf",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        // Schema ampliado: reference, ids, cost, commission y technical completo
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            model: { type: Type.STRING },
            reference: { type: Type.STRING },
            type: { type: Type.STRING },
            price: { type: Type.NUMBER },
            description: {
              type: Type.OBJECT,
              properties: {
                es: { type: Type.STRING },
                ca: { type: Type.STRING },
              },
            },
            technical: {
              type: Type.OBJECT,
              properties: {
                powerCooling: { type: Type.STRING },
                powerHeating: { type: Type.STRING },
                efficiency: { type: Type.STRING },
                gasType: { type: Type.STRING },
                voltage: { type: Type.STRING },
                warranty: { type: Type.STRING },
              },
            },
            pricing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: {
                    type: Type.OBJECT,
                    properties: {
                      es: { type: Type.STRING },
                      ca: { type: Type.STRING },
                    },
                  },
                  price: { type: Type.NUMBER },
                  cost: { type: Type.NUMBER },
                },
              },
            },
            installationKits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: {
                    type: Type.OBJECT,
                    properties: {
                      es: { type: Type.STRING },
                      ca: { type: Type.STRING },
                    },
                  },
                  price: { type: Type.NUMBER },
                },
              },
            },
            extras: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: {
                    type: Type.OBJECT,
                    properties: {
                      es: { type: Type.STRING },
                      ca: { type: Type.STRING },
                    },
                  },
                  price: { type: Type.NUMBER },
                },
              },
            },
            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: {
                    type: Type.OBJECT,
                    properties: {
                      es: { type: Type.STRING },
                      ca: { type: Type.STRING },
                    },
                  },
                  months: { type: Type.NUMBER },
                  commission: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER },
                },
              },
            },
          },
          required: ["brand", "model", "type"],
        },
      },
    });

    const raw = JSON.parse(response.text || "{}");

    // --- POST-PROCESADO ROBUSTO ---
    const toNum = (v: any) => {
      if (typeof v === "number") return v;
      const n = parseFloat(String(v || "0").replace(",", ".").replace(/[^0-9.-]/g, ""));
      return isNaN(n) ? 0 : n;
    };

    const normI18n = (obj: any, def = "") => {
      if (typeof obj === "string") return { es: obj, ca: obj };
      return {
        es: obj?.es || obj?.ca || def,
        ca: obj?.ca || obj?.es || def,
      };
    };

    const ensureArray = (x: any) => {
      if (!x) return [];
      if (Array.isArray(x)) return x;
      return [x];
    };

    const normType = (t: string) => {
      const val = String(t || "").toLowerCase();
      if (val.includes("aire")) return "aire_acondicionado";
      if (val.includes("aero")) return "aerotermia";
      if (val.includes("cald")) return "caldera";
      if (val.includes("term")) return "termo_electrico";
      return "aire_acondicionado";
    };

    const rawPricing = ensureArray(raw.pricing);
    const rawKits = ensureArray(raw.installationKits || raw.installation_kits);
    const rawExtras = ensureArray(raw.extras);
    const rawFin = ensureArray(raw.financing);

    // Construcción final garantizada (arrays + i18n {es,ca} + numbers + defaults)
    const clean: any = {
      brand: raw.brand || "Marca desconocida",
      model: raw.model || "Modelo desconocido",
      reference: raw.reference || raw.sku || raw.code || "",
      type: normType(raw.type || raw.category || ""),
      description: normI18n(raw.description),
      technical: {
        powerCooling: raw?.technical?.powerCooling || raw?.technical_data?.powerCooling || "",
        powerHeating: raw?.technical?.powerHeating || raw?.technical_data?.powerHeating || "",
        efficiency: raw?.technical?.efficiency || raw?.technical_data?.efficiency || "",
        gasType: raw?.technical?.gasType || raw?.technical_data?.gasType || "",
        voltage: raw?.technical?.voltage || raw?.technical_data?.voltage || "",
        warranty: raw?.technical?.warranty || raw?.technical_data?.warranty || "",
      },

      pricing:
        rawPricing.length > 0
          ? rawPricing.map((p: any, idx: number) => ({
              id: String(p.id || `p${idx + 1}`),
              name: normI18n(p.name || p.variant || p.label, "Precio Base"),
              price: toNum(p.price ?? raw.price ?? 0),
              cost: toNum(p.cost ?? 0),
            }))
          : [
              {
                id: "p1",
                name: { es: "Precio Base", ca: "Preu Base" },
                price: toNum(raw.price || 0),
                cost: 0,
              },
            ],

      installationKits:
        rawKits.length > 0
          ? rawKits.map((k: any, idx: number) => ({
              id: String(k.id || `k${idx + 1}`),
              name: normI18n(k.name || k.label, "Instalación Básica"),
              price: toNum(k.price),
            }))
          : [
              {
                id: "k1",
                name: { es: "Instalación Básica", ca: "Instal·lació Bàsica" },
                price: 0,
              },
            ],

      extras:
        rawExtras.length > 0
          ? rawExtras.map((e: any, idx: number) => ({
              id: String(e.id || `e${idx + 1}`),
              name: normI18n(e.name || e.label, "Soportes"),
              price: toNum(e.price),
            }))
          : [
              {
                id: "e1",
                name: { es: "Soportes", ca: "Suports" },
                price: 0,
              },
            ],

      financing:
        rawFin.length > 0
          ? rawFin.map((f: any) => ({
              label: normI18n(f.label || f.name, "12 Meses"),
              months: toNum(f.months) || 12,
              commission: toNum(f.commission || 0),
              coefficient: toNum(f.coefficient || 0),
            }))
          : [
              {
                label: { es: "12 Meses", ca: "12 Mesos" },
                months: 12,
                commission: 0,
                coefficient: 0.087,
              },
            ],
    };

    // ✅ PONLO AQUÍ (firma de versión)
    (clean as any).__version = "v2-i18n-es-ca";

    // Alias para compatibilidad con frontend
    clean.installation_kits = clean.installationKits;

    return new Response(JSON.stringify(clean), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
