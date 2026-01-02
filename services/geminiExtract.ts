import { GoogleGenAI, Type } from "@google/genai";

type ProductType = "aire_acondicionado" | "aerotermia" | "caldera" | "termo_electrico";
type I18nText = { es: string; ca: string };

type PricingItem = { id: string; name: I18nText; price: number; cost: number };
type KitItem = { id: string; name: I18nText; price: number };
type ExtraItem = { id: string; name: I18nText; price: number };
type FinancingItem = { label: I18nText; months: number; commission: number; coefficient: number };
type TechSpecItem = { title: string; description: string };

export type ExtractedProduct = {
  brand: string;
  model: string;
  reference: string;
  type: ProductType;
  description: I18nText;

  pricing: PricingItem[];
  installationKits: KitItem[];
  extras: ExtraItem[];
  financing: FinancingItem[];

  // Para la UI (tabla ficha técnica)
  techSpecs: TechSpecItem[];

  __version: string;
  __extracted_at: string;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
  });

const stripMarkdownJson = (text: string): string => {
  if (!text) return "{}";
  return text.replace(/```json\s*|```/g, "").trim();
};

const ensureArray = (x: any): any[] => {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object" && Object.keys(x).length > 0) return [x];
  return [];
};

const toNum = (v: any): number => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "0").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const normI18n = (obj: any, def = ""): I18nText => {
  if (!obj) return { es: def, ca: def };
  if (typeof obj === "string") return { es: obj, ca: obj };
  return {
    es: obj.es || obj.ca || def,
    ca: obj.ca || obj.es || def,
  };
};

const normType = (t: any): ProductType => {
  const str = String(t || "").toLowerCase();
  if (str.includes("aerotermia")) return "aerotermia";
  if (str.includes("caldera")) return "caldera";
  if (str.includes("termo")) return "termo_electrico";
  if (str.includes("aire") || str.includes("ac") || str.includes("clima")) return "aire_acondicionado";
  return "aire_acondicionado";
};

/**
 * ✅ API KEY en FRONTEND (Vite):
 * - Local: .env -> VITE_GEMINI_API_KEY=xxxx
 * - Vercel: Settings -> Environment Variables -> VITE_GEMINI_API_KEY (Production/Preview)
 */
const getApiKey = (): string => {
  // Vite (browser)
  const viteKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY;
  if (viteKey && String(viteKey).trim()) return String(viteKey).trim();

  // Fallbacks (por si algún entorno inyecta globalmente)
  const g: any = globalThis as any;
  const fallback =
    g?.VITE_GEMINI_API_KEY ||
    g?.process?.env?.VITE_GEMINI_API_KEY ||
    g?.process?.env?.API_KEY;

  return fallback ? String(fallback).trim() : "";
};

const getResponseText = (response: any): string => {
  // El SDK suele exponer .text
  if (typeof response?.text === "string") return response.text;

  // Fallback por si cambia estructura
  const t =
    response?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ||
    response?.response?.text;

  return typeof t === "string" ? t : "";
};

// ✅ Schema SIN objetos vacíos (y evitando technical{} dinámico con technicalSpecs[])
const RESPONSE_SCHEMA: any = {
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
        ca: { type: Type.STRING },
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
            properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } },
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
            properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } },
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
            properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } },
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
            properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } },
          },
          months: { type: Type.NUMBER },
          commission: { type: Type.NUMBER },
          coefficient: { type: Type.NUMBER },
        },
      },
    },

    // 🔥 Clave: ficha técnica como array para evitar technical{} dinámico
    technicalSpecs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          value: { type: Type.STRING },
        },
      },
    },
  },
};

export async function extractProductWithGemini(file: File): Promise<ExtractedProduct> {
  const apiKey = getApiKey();

  console.log("[Gemini] key present? ->", !!apiKey);
  if (!apiKey) {
    throw new Error(
      "Falta VITE_GEMINI_API_KEY. En local: crea .env con VITE_GEMINI_API_KEY=... y reinicia. En Vercel: Settings → Environment Variables → VITE_GEMINI_API_KEY y redeploy."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToBase64(file);

  const systemInstruction = `
Actúa como extractor técnico experto de climatización.
DEVUELVE SOLO JSON válido (sin markdown).
Idiomas obligatorios: es y ca. Si falta uno, copia el otro.
Números: solo NUMBER (sin € ni textos).
Estructura EXACTA:
{
 brand, model, reference, type,
 description:{es,ca},
 pricing:[{id,name:{es,ca},price,cost}],
 installationKits:[{id,name:{es,ca},price}],
 extras:[{id,name:{es,ca},price}],
 financing:[{label:{es,ca},months,commission,coefficient}],
 technicalSpecs:[{title,value}]
}
technicalSpecs debe contener filas útiles (potencia, tensión, refrigerante, COP/SEER, etc.) si aparecen en el documento.
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
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = getResponseText(response);
  console.log("[Gemini] response.text (first 800) ->", text.slice(0, 800));

  let raw: any = {};
  try {
    raw = JSON.parse(stripMarkdownJson(text || "{}"));
  } catch (e) {
    console.error("[Gemini] Error parsing JSON response", e);
    raw = {};
  }

  console.log("[Gemini] raw parsed ->", raw);

  const pricingArr = ensureArray(raw.pricing);
  const kitsArr = ensureArray(raw.installationKits);
  const extrasArr = ensureArray(raw.extras);
  const financingArr = ensureArray(raw.financing);
  const techArr = ensureArray(raw.technicalSpecs);

  const clean: ExtractedProduct = {
    brand: String(raw.brand || "Desconocida"),
    model: String(raw.model || "Desconocido"),
    reference: String(raw.reference || ""),
    type: normType(raw.type),
    description: normI18n(raw.description, "Descripción no disponible"),

    pricing:
      pricingArr.length > 0
        ? pricingArr.map((p: any, i: number) => ({
            id: String(p.id || `p${i + 1}`),
            name: normI18n(p.name, "Precio Base"),
            price: toNum(p.price),
            cost: toNum(p.cost),
          }))
        : [{ id: "p1", name: { es: "Precio Base", ca: "Preu Base" }, price: 0, cost: 0 }],

    installationKits:
      kitsArr.length > 0
        ? kitsArr.map((k: any, i: number) => ({
            id: String(k.id || `k${i + 1}`),
            name: normI18n(k.name, "Instalación Básica"),
            price: toNum(k.price),
          }))
        : [{ id: "k1", name: { es: "Instalación Básica", ca: "Instal·lació Bàsica" }, price: 0 }],

    extras:
      extrasArr.length > 0
        ? extrasArr.map((e: any, i: number) => ({
            id: String(e.id || `e${i + 1}`),
            name: normI18n(e.name, "Soportes"),
            price: toNum(e.price),
          }))
        : [{ id: "e1", name: { es: "Soportes", ca: "Suports" }, price: 0 }],

    financing:
      financingArr.length > 0
        ? financingArr.map((f: any) => ({
            label: normI18n(f.label, `${toNum(f.months) || 12} meses`),
            months: toNum(f.months) || 12,
            commission: toNum(f.commission),
            coefficient: toNum(f.coefficient) || 0.087,
          }))
        : [{ label: { es: "12 Meses", ca: "12 Mesos" }, months: 12, commission: 0, coefficient: 0.087 }],

    techSpecs:
      techArr.length > 0
        ? techArr
            .map((t: any) => ({
              title: String(t.title || "").trim(),
              description: String(t.value || "").trim(),
            }))
            .filter((x: any) => x.title && x.description)
        : [],

    __version: "frontend-gemini-v4",
    __extracted_at: new Date().toISOString(),
  };

  console.log("[Gemini] clean ->", clean);
  return clean;
}
