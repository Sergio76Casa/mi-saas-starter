import { GoogleGenAI, Type } from "@google/genai";

/**
 * Convierte un archivo File en una cadena Base64 pura.
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Limpia bloques de código Markdown del string de respuesta.
 */
const stripMarkdownJson = (text: string): string => {
  if (!text) return "{}";
  return text.replace(/```json\n?|```/g, "").trim();
};

/**
 * Normalización robusta de arrays: acepta objeto -> [objeto], null -> [].
 */
const ensureArray = (x: any): any[] => Array.isArray(x) ? x : (x && typeof x === "object" ? [x] : []);

/**
 * Normalización bilingüe robusta. Siempre devuelve {es, ca}.
 */
const normI18n = (obj: any, def = ""): { es: string; ca: string } => {
  if (!obj) return { es: def, ca: def };
  if (typeof obj === "string") return { es: obj, ca: obj };
  return {
    es: obj.es || obj.ca || def,
    ca: obj.ca || obj.es || def,
  };
};

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v || '0').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const normType = (t: any): "aire_acondicionado" | "aerotermia" | "caldera" | "termo_electrico" => {
  const str = String(t || "").toLowerCase();
  if (str.includes("aire") || str.includes("ac") || str.includes("clima")) return "aire_acondicionado";
  if (str.includes("aerotermia")) return "aerotermia";
  if (str.includes("caldera")) return "caldera";
  if (str.includes("termo")) return "termo_electrico";
  return "aire_acondicionado";
};

export async function extractProductWithGemini(file: File): Promise<any> {
  // Use the process.env.API_KEY directly as specified in the Google GenAI guidelines.
  // This also resolves the "Property 'env' does not exist on type 'ImportMeta'" error.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToBase64(file);

  const systemInstruction = `Actúa como un extractor técnico experto de climatización. 
OBJETIVO: Extraer datos a JSON bilingüe.
IDIOMAS: SOLO 'es' y 'ca'. Si falta uno, tradúcelo.
NÚMEROS: Formato NUMBER puro, sin símbolos de moneda.
ESTRUCTURA: JSON con brand, model, reference, type, description, technical{}, pricing[], installationKits[], extras[], financing[].`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: systemInstruction },
        { inlineData: { data: base64Data, mimeType: file.type || 'application/pdf' } }
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
          description: { 
            type: Type.OBJECT, 
            properties: { 
              es: { type: Type.STRING }, 
              ca: { type: Type.STRING } 
            } 
          },
          technical: { 
            type: Type.OBJECT, 
            properties: {
              btu: { type: Type.STRING },
              efficiency: { type: Type.STRING },
              refrigerant: { type: Type.STRING }
            } 
          },
          pricing: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
                price: { type: Type.NUMBER },
                cost: { type: Type.NUMBER }
              }
            } 
          },
          installationKits: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
                price: { type: Type.NUMBER }
              }
            } 
          },
          extras: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
                price: { type: Type.NUMBER }
              }
            } 
          },
          financing: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                label: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
                months: { type: Type.NUMBER },
                commission: { type: Type.NUMBER },
                coefficient: { type: Type.NUMBER }
              }
            } 
          }
        }
      }
    }
  });

  console.log("[Gemini] response.text ->", response.text);

  let raw: any = {};
  try {
    // Access response.text directly as it is a property on GenerateContentResponse.
    raw = JSON.parse(stripMarkdownJson(response.text || "{}"));
  } catch (e) {
    console.error("[Gemini] Error parsing JSON response", e);
    raw = {};
  }
  
  console.log("[Gemini] raw parsed ->", raw);

  const clean: any = {
    brand: String(raw.brand || "Desconocida"),
    model: String(raw.model || "Desconocido"),
    reference: String(raw.reference || ""),
    type: normType(raw.type),
    description: normI18n(raw.description, "Descripción no disponible"),
    technical: raw.technical || {},
    
    pricing: ensureArray(raw.pricing).length > 0 
      ? ensureArray(raw.pricing).map((p: any, i: number) => ({
          id: p.id || `p${i+1}`,
          name: normI18n(p.name, "Modelo Base"),
          price: toNum(p.price),
          cost: toNum(p.cost)
        }))
      : [{ id: "p1", name: { es: "Precio Base", ca: "Preu Base" }, price: 0, cost: 0 }],

    installationKits: ensureArray(raw.installationKits).length > 0
      ? ensureArray(raw.installationKits).map((k: any, i: number) => ({
          id: k.id || `k${i+1}`,
          name: normI18n(k.name, "Instalación Básica"),
          price: toNum(k.price)
        }))
      : [{ id: "k1", name: { es: "Instalación Básica", ca: "Instal·lació Bàsica" }, price: 0 }],

    extras: ensureArray(raw.extras).length > 0
      ? ensureArray(raw.extras).map((e: any, i: number) => ({
          id: e.id || `e${i+1}`,
          name: normI18n(e.name, "Soportes"),
          price: toNum(e.price)
        }))
      : [{ id: "e1", name: { es: "Soportes", ca: "Suports" }, price: 0 }],

    financing: ensureArray(raw.financing).length > 0
      ? ensureArray(raw.financing).map((f: any) => ({
          label: normI18n(f.label, `${f.months || 12} meses`),
          months: toNum(f.months) || 12,
          commission: toNum(f.commission),
          coefficient: toNum(f.coefficient) || 0.087
        }))
      : [{ label: { es: "12 Meses", ca: "12 Mesos" }, months: 12, commission: 0, coefficient: 0.087 }]
  };

  clean.__version = "frontend-gemini-v3";
  clean.__extracted_at = new Date().toISOString();

  console.log("[Gemini] clean ->", clean);
  return clean;
}