
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

  // Uso exclusivo de VITE_GEMINI_API_KEY
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "VITE_GEMINI_API_KEY no configurada", code: "KEY_MISSING", requestId });
  }

  try {
    const { buffer, mimeType } = await parseMultipart(req);

    // Límite de tamaño: 4.5MB
    if (buffer.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({ error: "Archivo demasiado grande (máx 4.5MB)", code: "FILE_TOO_LARGE", requestId });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Instrucción de sistema: Se libera el límite de 8 para 'extras'
    const systemInstruction = `HVAC Expert. Extract technical data to JSON. 
    RULES: 
    - MAX 8 items for pricing, techSpecs, and financing.
    - NO LIMIT for 'extras': Extract EVERY installation material, extra, or accessory found.
    - Descriptions: max 150 chars. 
    - Numbers: use point as decimal, no symbols (€, %, etc).
    - If quantity is missing or 0, use 1.
    - If total is present but unit_price is missing, calculate unit_price = total / qty.
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
              properties: { 
                es: { type: Type.STRING }, 
                ca: { type: Type.STRING } 
              }
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
            extras: {
              type: Type.ARRAY,
              description: "Extract all items without limit",
              items: {
                type: Type.OBJECT,
                properties: { 
                  name: { type: Type.STRING }, 
                  qty: { type: Type.NUMBER }, 
                  unit_price: { type: Type.NUMBER },
                  total: { type: Type.NUMBER }
                }
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

    const result = (await Promise.race([geminiCall, timeoutPromise])) as any;
    const raw = JSON.parse(result.text || "{}");

    // Normalización Final
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
      pricing: (raw.pricing || []).slice(0, 8).map((p: any, i: number) => ({
        id: `p${i + 1}`,
        name: {
          es: truncate(p?.name?.es || "Variante", 40),
          ca: truncate(p?.name?.ca || p?.name?.es || "Variant", 40)
        },
        price: cleanNumber(p?.price, 0),
        cost: cleanNumber(p?.cost, 0)
      })),
      // EXTRAS COMPLETO - Sin slice
      extras: (raw.extras || []).map((e: any) => {
        const qty = cleanNumber(e?.qty, 1) || 1;
        let unit_price = cleanNumber(e?.unit_price, 0);
        const total = cleanNumber(e?.total, 0);
        
        if (unit_price === 0 && total > 0) {
          unit_price = total / qty;
        } else if (unit_price > 0 && qty === 1 && total > unit_price) {
          // Si qty es 1 pero el total es mayor que el unit_price, algo falló en la extracción de qty
          // pero respetamos lo que diga Gemini.
        }

        return {
          name: truncate(e?.name || "Material extra", 100),
          qty,
          unit_price: unit_price || total
        };
      }),
      financing: (raw.financing || []).slice(0, 8).map((f: any) => ({
        months: cleanNumber(f?.months, 12),
        coefficient: cleanNumber(f?.coefficient, 0)
      })),
      techSpecs: (raw.techSpecs || []).slice(0, 8).map((s: any) => ({
        title: truncate(s?.title, 40),
        value: truncate(s?.value, 150)
      })),
      __extracted_at: new Date().toISOString()
    };

    return res.status(200).json(normalized);

  } catch (err: any) {
    if (err?.message === "UPSTREAM_TIMEOUT") {
      return res.status(504).json({ error: "El motor de IA ha tardado demasiado", code: "UPSTREAM_TIMEOUT", requestId });
    }
    return res.status(500).json({ 
      error: "Error interno procesando el archivo", 
      code: "INTERNAL_ERROR", 
      requestId,
      detail: err.message 
    });
  }
}
