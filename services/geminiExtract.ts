import { GoogleGenAI, Type } from "@google/genai";

/**
 * En Vite (browser) la API key DEBE venir de import.meta.env.VITE_GEMINI_API_KEY
 * process.env NO existe en el navegador.
 */
const getApiKey = (): string => {
  // Vite build-time
  const fromVite = (import.meta as any)?.env?.VITE_GEMINI_API_KEY;

  // Fallbacks (por si algún hosting inyecta globals)
  const fromGlobalEnv = (globalThis as any)?.__ENV?.VITE_GEMINI_API_KEY;
  const fromProcess = (globalThis as any)?.process?.env?.VITE_GEMINI_API_KEY;

  const key = fromVite || fromGlobalEnv || fromProcess || "";
  return String(key).trim();
};

/**
 * Convierte un archivo File en una cadena Base64 pura.
 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });

/**
 * Limpia bloques Markdown ```json ... ```
 */
const stripMarkdownJson = (text: string): string => {
  if (!text) return "{}";
  return text.replace(/```json\n?|```/g, "").trim();
};

/**
 * Normalización robusta de arrays: objeto -> [objeto], null -> [].
 */
const ensureArray = (x: any): any[] => {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object" && Object.keys(x).length > 0) return [x];
  return [];
};

const toNum = (v: any): number => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v || "0").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
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

const normType = (
  t: any
): "aire_acondicionado" | "aerotermia" | "caldera" | "termo_electrico" => {
  const str = String(t || "").toLowerCase();
  if (str.includes("aire") || str.includes("ac") || str.includes("clima")) return "aire_acondicionado";
  if (str.includes("aerotermia")) return "aerotermia";
  if (str.includes("caldera")) return "caldera";
  if (str.includes("termo")) return "termo_electrico";
  return "aire_acondicionado";
};

export async function extractProductWithGemini(file: File): Promise<any> {
  const API_KEY = getApiKey();

  // Logs para verificar INYECCIÓN REAL en el build
  console.log("[Gemini] VITE key present?", !!API_KEY, "len=", API_KEY?.length || 0);
  console.log("[Gemini] import.meta.env keys:", Object.keys((import.meta as any)?.env || {}));

  if (!API_KEY) {
    throw new Error(
      "Falta VITE_GEMINI_API_KEY. En Vercel debes definirla en Settings → Environment Variables (Production) y redeploy (sin cache)."
    );
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const base64Data = await fileToBase64(file);

  const systemInstruction = `Actúa como un extractor técnico experto de climatización.
OBJETIVO: Extraer datos a JSON bilingüe.
IDIOMAS: SOLO 'es' y 'ca'. Si falta uno, copia el otro.
NÚMEROS: NUMBER puro, sin símbolos.
ESTRUCTURA: brand, model, reference, type, description{es,ca}, technical{}, pricing[], installationKits[], extras[], financing[].`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: systemInstruction },
          { inlineData: { data: base64Data, mimeType: file.type || "application/pdf" } },
        ],
      },
    ],
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
            properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } },
          },
          technical: { type: Type.OBJECT },
          pricing: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          installationKits: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          extras: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          financing: { type: Type.ARRAY, items: { type: Type.OBJECT } },
        },
      },
    },
  });

  console.log("[Gemini] response.text ->", response.text);

  let raw: any = {};
  try {
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

    pricing: ensureArray(raw.pricing).length
      ? ensureArray(raw.pricing).map((p: any, i: number) => ({
          id: p.id || `p${i + 1}`,
          name: normI18n(p.name, "Precio Base"),
          price: toNum(p.price),
          cost: toNum(p.cost),
        }))
      : [{ id: "p1", name: { es: "Precio Base", ca: "Preu Base" }, price: 0, cost: 0 }],

    installationKits: ensureArray(raw.installationKits).length
      ? ensureArray(raw.installationKits).map((k: any, i: number) => ({
          id: k.id || `k${i + 1}`,
          name: normI18n(k.name, "Instalación Básica"),
          price: toNum(k.price),
        }))
      : [{ id: "k1", name: { es: "Instalación Básica", ca: "Instal·lació Bàsica" }, price: 0 }],

    extras: ensureArray(raw.extras).length
      ? ensureArray(raw.extras).map((e: any, i: number) => ({
          id: e.id || `e${i + 1}`,
          name: normI18n(e.name, "Soportes"),
          price: toNum(e.price),
        }))
      : [{ id: "e1", name: { es: "Soportes", ca: "Suports" }, price: 0 }],

    financing: ensureArray(raw.financing).length
      ? ensureArray(raw.financing).map((f: any) => ({
          label: normI18n(f.label, `${f.months || 12} meses`),
          months: toNum(f.months) || 12,
          commission: toNum(f.commission),
          coefficient: toNum(f.coefficient) || 0.087,
        }))
      : [{ label: { es: "12 Meses", ca: "12 Mesos" }, months: 12, commission: 0, coefficient: 0.087 }],
  };

  clean.__version = "frontend-gemini-v4";
  clean.__extracted_at = new Date().toISOString();

  console.log("[Gemini] clean ->", clean);
  return clean;
}
