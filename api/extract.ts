
import busboy from "busboy";
import { Buffer } from "node:buffer";
import { GoogleGenAI, Type } from "@google/genai";

// Límite estricto de Vercel Hobby (10s)
export const maxDuration = 10;

/**
 * Normaliza el tipo de producto a las 3 categorías estándar del sistema
 */
function normalizeType(t: string): string {
  const low = (t || "").toLowerCase();
  if (low.includes("aire") || low.includes("split") || low.includes("acondicionado")) return "aire_acondicionado";
  if (low.includes("caldera")) return "caldera";
  if (low.includes("termo")) return "termo_electrico";
  return "aire_acondicionado";
}

/**
 * Utilidad para parsear multipart/form-data con busboy
 */
async function parseMultipart(req: any): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let mimeType = "";

    bb.on("file", (_fieldname, file, info) => {
      const { filename, mimeType: mt } = info;
      fileName = filename;
      mimeType = mt;
      const chunks: Buffer[] = [];
      file.on("data", (data: Buffer) => chunks.push(data));
      file.on("end", () => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on("finish", () => {
      if (!fileBuffer) return reject(new Error("NO_FILE"));
      resolve({ buffer: fileBuffer, fileName, mimeType });
    });

    bb.on("error", (err) => reject(err));
    req.pipe(bb);
  });
}

/**
 * Normaliza valores numéricos (limpia comas, espacios y símbolos)
 */
function cleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "number") return Number.isFinite(val) ? val : fallback;
  const cleaned = String(val).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Recorta strings a una longitud máxima
 */
function truncate(str: any, max = 150): string {
  if (!str) return "";
  return String(str).substring(0, max);
}

export default async function handler(req: any, res: any) {
  const requestId = Math.random().toString(36).substring(2, 8).toUpperCase();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido", requestId, code: "METHOD_NOT_ALLOWED" });
  }

  // Guidelines require using process.env.API_KEY directly for initialization.
  // The SDK must be initialized with the named parameter { apiKey: ... }.
  try {
    const { buffer, mimeType } = await parseMultipart(req);

    if (buffer.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({ error: "Archivo demasiado grande (máx 4.5MB)", code: "FILE_TOO_LARGE", requestId });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `HVAC Expert. Extract technical data to JSON. 
    RULES: 
    - Separate 'installation_kits' from 'extras'.
    - 'installation_kits': Fixed price packages (e.g., "Kit Básico Sabadell").
    - 'extras': Specific materials, pipes, or labor items (e.g., "Metro tubo 3/8", "Canaleta").
    - Numbers: use point as decimal.
    - Output must be valid JSON.`;

    const geminiCall = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          inlineData: { 
            data: buffer.toString("base64"), 
            mimeType: mimeType || "application/pdf" 
          } 
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            model: { type: Type.STRING },
            type: { type: Type.STRING },
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
                  price: { type: Type.NUMBER }
                }
              }
            },
            installation_kits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, price: { type: Type.NUMBER } }
              }
            },
            extras: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, qty: { type: Type.NUMBER }, unit_price: { type: Type.NUMBER } }
              }
            },
            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { months: { type: Type.NUMBER }, coefficient: { type: Type.NUMBER } }
              }
            },
            techSpecs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { title: { type: Type.STRING }, value: { type: Type.STRING } }
              }
            }
          }
        }
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), 8500)
    );

    // Get the extracted text using the .text property (not a method) on the result response object.
    const result: any = await Promise.race([geminiCall, timeoutPromise]);
    const raw = JSON.parse(result.text || "{}");

    const normalized = {
      requestId,
      brand: truncate(raw.brand || "Desconocida", 50),
      model: truncate(raw.model || "Desconocido", 50),
      type: normalizeType(raw.type),
      stock: cleanNumber(raw.stock, 0),
      description: {
        es: truncate(raw.description?.es, 150),
        ca: truncate(raw.description?.ca, 150)
      },
      pricing: (raw.pricing || []).map((p: any) => ({
        name: { es: truncate(p?.name?.es || "Variante", 40), ca: truncate(p?.name?.ca || p?.name?.es || "Variant", 40) },
        price: cleanNumber(p?.price, 0)
      })),
      installation_kits: (raw.installation_kits || []).map((k: any) => ({
        name: truncate(k?.name || "Kit Instalación", 60),
        price: cleanNumber(k?.price, 0)
      })),
      extras: (raw.extras || []).map((e: any) => ({
        name: truncate(e?.name || "Material extra", 100),
        qty: cleanNumber(e?.qty, 1),
        unit_price: cleanNumber(e?.unit_price, 0)
      })),
      financing: (raw.financing || []).map((f: any) => ({
        months: cleanNumber(f?.months, 12),
        coefficient: cleanNumber(f?.coefficient, 0)
      })),
      techSpecs: (raw.techSpecs || []).map((s: any) => ({
        title: truncate(s?.title, 40),
        value: truncate(s?.value, 150)
      }))
    };

    return res.status(200).json(normalized);

  } catch (err: any) {
    if (err?.message === "UPSTREAM_TIMEOUT") {
      return res.status(504).json({ error: "El motor de IA ha tardado demasiado", code: "UPSTREAM_TIMEOUT", requestId });
    }
    return res.status(500).json({ error: "Error interno procesando el archivo", code: "INTERNAL_ERROR", requestId, detail: err.message });
  }
}
