import { GoogleGenAI, Type } from "@google/genai";

/**
 * Convierte un archivo File en una cadena Base64 pura.
 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
  });

/**
 * Limpia bloques de código Markdown del string de respuesta.
 */
const stripMarkdownJson = (text: string): string => {
  if (!text) return "{}";
  return text.replace(/```json\s*|```/g, "").trim();
};

/**
 * Normalización robusta de arrays.
 */
const ensureArray = (x: any): any[] => {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object" && Object.keys(x).length > 0) return [x];
  return [];
};

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
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "0").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const normType = (t: any): string => {
  const str = String(t || "").toLowerCase();
  if (str.includes("aerotermia")) return "aerotermia";
  if (str.includes("caldera")) return "caldera";
  if (str.includes("termo")) return "termo_electrico";
  return "aire_acondicionado";
};

export async function extractProductWithGemini(file: File): Promise<any> {
  // BLOQUE DE DETECCIÓN DE API KEY (VITE + LEGACY)
  const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  const legacyKey = (globalThis as any)?.process?.env?.API_KEY as string | undefined;
  const API_KEY = viteKey || legacyKey;

  console.log("[Gemini] key present?", !!API_KEY);
  if (!API_KEY) throw new Error("Falta VITE_GEMINI_API_KEY (o API_KEY legacy).");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const base64Data = await fileToBase64(file);

  const systemInstruction = `
Actúa como extractor técnico experto de climatización.
Extrae datos a JSON bilingüe (es/ca). 
Si falta un idioma, tradúcelo. 
Números sin símbolos.
Estructura exacta: { brand, model, reference, type, description:{es,ca}, pricing:[{id,name:{es,ca},price,cost}], installationKits:[{id,name:{es,ca},price}], extras:[{id,name:{es,ca},price}], financing:[{label:{es,ca},months,commission,coefficient}], techSpecs:[{title,value}] }
`.trim();

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: systemInstruction },
        { inlineData: { data: base64Data, mimeType: file.type || "application/pdf" } },
      ],
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
            properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } 
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
          },
          techSpecs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                value: { type: Type.STRING }
              }
            }
          }
        }
      }
    },
  });

  const text = response.text || "{}";
  let raw: any = {};
  try {
    raw = JSON.parse(stripMarkdownJson(text));
  } catch (e) {
    console.error("[Gemini] Error parsing JSON", e);
    raw = {};
  }

  const clean = {
    brand: String(raw.brand || "Desconocida"),
    model: String(raw.model || "Desconocido"),
    reference: String(raw.reference || ""),
    type: normType(raw.type),
    description: normI18n(raw.description, "Descripción no disponible"),
    
    pricing: ensureArray(raw.pricing).map((p, i) => ({
      id: p.id || `p${i + 1}`,
      name: normI18n(p.name, "Precio Base"),
      price: toNum(p.price),
      cost: toNum(p.cost)
    })),
    
    installationKits: ensureArray(raw.installationKits).map((k, i) => ({
      id: k.id || `k${i + 1}`,
      name: normI18n(k.name, "Instalación Básica"),
      price: toNum(k.price)
    })),
    
    extras: ensureArray(raw.extras).map((e, i) => ({
      id: e.id || `e${i + 1}`,
      name: normI18n(e.name, "Soportes"),
      price: toNum(e.price)
    })),
    
    financing: ensureArray(raw.financing).map(f => ({
      label: normI18n(f.label, "Financiación"),
      months: toNum(f.months) || 12,
      commission: toNum(f.commission),
      coefficient: toNum(f.coefficient) || 0.087
    })),
    
    techSpecs: ensureArray(raw.techSpecs).map(t => ({
      title: String(t.title || "").trim(),
      description: String(t.value || "").trim()
    })).filter(x => x.title),

    __version: "frontend-gemini-v3",
    __extracted_at: new Date().toISOString()
  };

  if (clean.pricing.length === 0) clean.pricing = [{ id: "p1", name: { es: "Precio Base", ca: "Preu Base" }, price: 0, cost: 0 }];
  if (clean.installationKits.length === 0) clean.installationKits = [{ id: "k1", name: { es: "Instalación Básica", ca: "Instal·lació Bàsica" }, price: 0 }];

  console.log("[Gemini] Extracted Data ->", clean);
  return clean;
}