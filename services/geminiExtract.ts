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

const ensureArray = (x: any): any[] => {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object" && Object.keys(x).length > 0) return [x];
  return [];
};

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
  // Detección de API Key inyectada por el entorno
  const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || (globalThis as any)?.process?.env?.API_KEY;

  if (!API_KEY) throw new Error("API Key no configurada.");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const base64Data = await fileToBase64(file);

  // Prompt simplificado para máxima velocidad de respuesta
  const systemInstruction = `Extract technical HVAC data to JSON. Languages: es/ca. Only numbers for prices.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: systemInstruction },
        { inlineData: { data: base64Data, mimeType: file.type || "application/pdf" } },
      ],
    },
    config: {
      // OPTIMIZACIÓN DE LATENCIA: Desactivar presupuesto de pensamiento para extracción directa
      thinkingConfig: { thinkingBudget: 0 },
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

  const raw = JSON.parse(stripMarkdownJson(response.text || "{}"));

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
    __version: "frontend-gemini-v4-turbo",
    __extracted_at: new Date().toISOString()
  };

  if (clean.pricing.length === 0) clean.pricing = [{ id: "p1", name: { es: "Precio Base", ca: "Preu Base" }, price: 0, cost: 0 }];
  return clean;
}