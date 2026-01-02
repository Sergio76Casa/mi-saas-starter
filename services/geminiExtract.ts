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

/**
 * Normaliza el tipo de producto a uno de los valores permitidos por el sistema.
 */
const normType = (t: any): string => {
  const str = String(t || "").toLowerCase();
  if (str.includes("caldera")) return "caldera";
  if (str.includes("termo") || str.includes("calentador")) return "termo_electrico";
  if (str.includes("aire") || str.includes("split") || str.includes("clima")) return "aire_acondicionado";
  if (str.includes("aerotermia")) return "aerotermia";
  return "aire_acondicionado"; // Valor por defecto
};

export async function extractProductWithGemini(file: File): Promise<any> {
  const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || (globalThis as any)?.process?.env?.API_KEY;

  if (!API_KEY) throw new Error("API Key no configurada.");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const base64Data = await fileToBase64(file);

  const systemInstruction = `
    Extract HVAC technical data, FINANCING, and STOCK. 
    Languages: es/ca. 
    IMPORTANT: The field 'type' MUST be exactly one of these: 'aire_acondicionado', 'caldera', 'termo_electrico'.
    - If it's an air conditioner or heat pump, use 'aire_acondicionado'.
    - If it's a gas/oil boiler, use 'caldera'.
    - If it's an electric water heater or thermo, use 'termo_electrico'.
    Return only valid JSON.
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
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          brand: { type: Type.STRING },
          model: { type: Type.STRING },
          reference: { type: Type.STRING },
          type: { type: Type.STRING },
          status: { type: Type.STRING },
          stock: { type: Type.INTEGER },
          description: { 
            type: Type.OBJECT, 
            properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } 
          },
          pricing: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
                price: { type: Type.NUMBER },
                cost: { type: Type.NUMBER }
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
    status: (['active', 'draft', 'inactive'].includes(raw.status) ? raw.status : 'active'),
    stock: toNum(raw.stock) || 0,
    description: normI18n(raw.description, "Descripción no disponible"),
    pricing: ensureArray(raw.pricing).map((p, i) => ({
      id: `p${i + 1}`,
      name: normI18n(p.name, "Precio Base"),
      price: toNum(p.price),
      cost: toNum(p.cost)
    })),
    installationKits: [],
    extras: [],
    financing: ensureArray(raw.financing).map((f, i) => ({
      id: `f${i + 1}`,
      label: normI18n(f.label, `${f.months || 12} meses`),
      months: toNum(f.months) || 12,
      commission: toNum(f.commission),
      coefficient: toNum(f.coefficient) || 0.087
    })),
    techSpecs: ensureArray(raw.techSpecs).map(t => ({
      title: String(t.title || "").trim(),
      description: String(t.value || "").trim()
    })).filter(x => x.title),
    __version: "frontend-gemini-v7-fixed-types",
    __extracted_at: new Date().toISOString()
  };

  if (clean.pricing.length === 0) clean.pricing = [{ id: "p1", name: { es: "Precio Base", ca: "Preu Base" }, price: 0, cost: 0 }];
  return clean;
}