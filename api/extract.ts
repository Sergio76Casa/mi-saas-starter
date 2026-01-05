
import busboy from "busboy";
import { Buffer } from "node:buffer";
import { GoogleGenAI, Type } from "@google/genai";

// En Vercel Hobby el límite estricto es 10s.
export const maxDuration = 10;

/**
 * Parse multipart/form-data usando busboy
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
      file.on("error", (err: any) => reject(err));
    });

    bb.on("finish", () => {
      if (!fileBuffer) {
        reject(new Error("No se encontró ningún archivo"));
        return;
      }
      resolve({ buffer: fileBuffer, fileName, mimeType });
    });

    bb.on("error", (err) => reject(err));
    req.pipe(bb);
  });
}

function toNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const n = Number(val.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export default async function handler(req: any, res: any) {
  const requestId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const startedAt = Date.now();

  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido", requestId });

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "VITE_GEMINI_API_KEY no configurada",
      code: "KEY_MISSING",
      requestId,
    });
  }

  try {
    const { buffer, mimeType } = await parseMultipart(req);

    if (buffer.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({ error: "Archivo demasiado grande (máx 4.5MB)", code: "FILE_TOO_LARGE", requestId });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = "HVAC Expert. Extract technical data to JSON. LIMIT: Max 8 items per array. Be extremely concise.";

    const geminiCall = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: systemInstruction },
          { inlineData: { data: buffer.toString("base64"), mimeType: mimeType || "application/pdf" } },
        ],
      },
      config: {
        responseMimeType: "application/json",
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
              description: "Max 8 variants",
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
              description: "Max 8 materials",
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
              description: "Max 8 technical specifications",
              items: {
                type: Type.OBJECT,
                properties: { title: { type: Type.STRING }, value: { type: Type.STRING } }
              }
            }
          }
        }
      },
    });

    // Timeout de 8.5s para Hobby (10s total)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), 8500)
    );

    const result = (await Promise.race([geminiCall, timeoutPromise])) as any;
    const raw = JSON.parse(result.text || "{}");

    const normalized = {
      ...raw,
      requestId,
      brand: raw.brand || "Desconocida",
      model: raw.model || "Desconocido",
      pricing: (raw.pricing || []).slice(0, 8).map((p: any, i: number) => ({
        id: `p${i + 1}`,
        name: p?.name || { es: "Precio Base", ca: "Preu Base" },
        price: toNumber(p?.price, 0),
        cost: toNumber(p?.cost, 0),
      })),
      extras: (raw.extras || []).slice(0, 8).map((e: any) => ({
        name: e?.name || "Material extra",
        qty: toNumber(e?.qty, 1) || 1,
        unit_price: toNumber(e?.unit_price, 0),
      })),
      __extracted_at: new Date().toISOString(),
    };

    return res.status(200).json(normalized);
  } catch (err: any) {
    const isTimeout = err?.message === "UPSTREAM_TIMEOUT";
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? "La IA ha tardado demasiado" : `Fallo: ${err.message}`,
      code: isTimeout ? "UPSTREAM_TIMEOUT" : "INTERNAL_ERROR",
      requestId,
    });
  }
}
