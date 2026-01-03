
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
  if (str.includes("caldera")) return "caldera";
  if (str.includes("termo") || str.includes("calentador")) return "termo_electrico";
  if (str.includes("aire") || str.includes("split") || str.includes("clima")) return "aire_acondicionado";
  return "aire_acondicionado"; 
};

/**
 * Extrae datos del producto usando el modelo Gemini.
 */
export async function extractProductWithGemini(file: File): Promise<any> {
  // Siguiendo estrictamente la instrucción: obtener exclusivamente de process.env.API_KEY
  // Usar la referencia directa facilita que Vite realice el reemplazo estático en Vercel.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("La API_KEY de Gemini no está llegando al navegador. Verifica que esté configurada en las Environment Variables de Vercel.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToBase64(file);

  const systemInstruction = `
    Extract HVAC technical data, FINANCING, and STOCK. 
    Languages: es/ca. 
    IMPORTANT: The field 'type' MUST be exactly one of these: 'aire_acondicionado', 'caldera', 'termo_electrico'.
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

  return {
    brand: String(raw.brand || "Desconocida"),
    model: String(raw.model || "Desconocido"),
    reference: String(raw.reference || ""),
    type: normType(raw.type),
    status: (['active', 'draft', 'inactive'].includes(raw.status) ? raw.status : 'active'),
    stock: toNum(raw.stock) || 0,
    description: normI18n(raw.description, "Descripción no disponible"),
    pricing: ensureArray(raw.pricing).map((p: any, i: number) => ({
      id: `p${i + 1}`,
      name: normI18n(p.name, "Precio Base"),
      price: toNum(p.price),
      cost: toNum(p.cost)
    })),
    financing: ensureArray(raw.financing).map((f: any, i: number) => ({
      id: `f${i + 1}`,
      label: normI18n(f.label, `${f.months || 12} meses`),
      months: toNum(f.months) || 12,
      commission: toNum(f.commission),
      coefficient: toNum(f.coefficient) || 0.087
    })),
    techSpecs: ensureArray(raw.techSpecs).map((t: any) => ({
      title: String(t.title || "").trim(),
      description: String(t.value || "").trim()
    })).filter((x: any) => x.title),
    __version: "v9-static-rebound",
    __extracted_at: new Date().toISOString()
  };
}
