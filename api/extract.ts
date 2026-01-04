// api/extract.ts
import busboy from "busboy";
import { Buffer } from "node:buffer";
import { GoogleGenAI, Type } from "@google/genai";

// Nota: En Vercel Hobby el límite real suele ser ~10s por ejecución.
// Esto NO garantiza más tiempo, pero lo dejamos por claridad.
export const maxDuration = 10;

/**
 * Parse multipart/form-data (Node IncomingMessage) usando busboy
 */
async function parseMultipart(
  req: any
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
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
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
      file.on("error", (err: any) => reject(err));
    });

    bb.on("finish", () => {
      if (!fileBuffer) {
        reject(new Error("No se encontró ningún archivo en la petición"));
        return;
      }
      resolve({ buffer: fileBuffer, fileName, mimeType });
    });

    bb.on("error", (err) => reject(err));

    req.pipe(bb);
  });
}

/**
 * Helpers
 */
function toNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    // soporta coma decimal: "6,50"
    const norm = val.replace(/\s/g, "").replace(",", ".");
    const n = Number(norm);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

async function extractJsonText(result: any): Promise<string> {
  // Casos comunes:
  // - result.text (string)
  // - result.text() (function)
  // - result.response.text() (function)
  if (result?.text) {
    if (typeof result.text === "function") return await result.text();
    if (typeof result.text === "string") return result.text;
  }
  if (result?.response?.text) {
    if (typeof result.response.text === "function") return await result.response.text();
    if (typeof result.response.text === "string") return result.response.text;
  }
  return "";
}

export default async function handler(req: any, res: any) {
  const requestId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const startedAt = Date.now();

  console.log(
    `[${requestId}] [Extract] Recibido: Petición iniciada en Node.js (Serverless Runtime)`
  );

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido", requestId });
  }

  // ✅ Variable correcta en Vercel
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error(`[${requestId}] [Extract] Error: VITE_GEMINI_API_KEY no configurada`);
    return res.status(500).json({
      error: "Configuración incompleta: Falta VITE_GEMINI_API_KEY en el servidor.",
      code: "KEY_MISSING",
      requestId,
    });
  }

  try {
    console.log(`[${requestId}] [Extract] Parseo: Procesando multipart/form-data`);
    const { buffer, mimeType } = await parseMultipart(req);

    // Límite de tamaño (ajusta si lo necesitas)
    // OJO: en Hobby el límite de body puede ser bajo; esto evita reventar memoria.
    if (buffer.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({
        error: "Archivo demasiado grande (máx 4.5MB).",
        code: "FILE_TOO_LARGE",
        requestId,
      });
    }

    const base64Data = buffer.toString("base64");

    // ✅ usa la constante apiKey validada
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction =
      "Eres experto HVAC. Extrae datos técnicos y materiales/extras de instalación en JSON. " +
      "Idiomas: es/ca. Extras: si falta qty usa 1. Si falta unit_price pero existe total y qty, unit_price = total/qty.";

    console.log(`[${requestId}] [Extract] Gemini: llamando a generateContent`);

    const geminiCall = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: systemInstruction },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || "application/pdf",
            },
          },
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
                  name: {
                    type: Type.OBJECT,
                    properties: {
                      es: { type: Type.STRING }, // ✅ FIX
                      ca: { type: Type.STRING }, // ✅ FIX
                    },
                  },
                  price: { type: Type.NUMBER },
                  cost: { type: Type.NUMBER },
                },
              },
            },

            extras: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  unit_price: { type: Type.NUMBER },
                },
              },
            },

            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  months: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER },
                },
              },
            },

            techSpecs: {
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
        },
      },
    });

    // Timeout interno: ajusta según tu realidad en Hobby.
    // Dejamos margen para parseo + respuesta antes del límite duro.
    const elapsed = Date.now() - startedAt;
    const remainingBudgetMs = Math.max(1500, 9000 - elapsed); // objetivo ~9s total
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), remainingBudgetMs)
    );

    const result = (await Promise.race([geminiCall, timeoutPromise])) as any;

    const jsonText = await extractJsonText(result);
    const raw = JSON.parse(jsonText || "{}");

    const normalized = {
      ...raw,
      requestId,

      brand: raw.brand || "Desconocida",
      model: raw.model || "Desconocido",

      description: raw.description || { es: "", ca: "" },

      pricing: (raw.pricing || []).map((p: any, i: number) => ({
        id: `p${i + 1}`,
        name: p?.name || { es: "Precio Base", ca: "Preu Base" },
        price: toNumber(p?.price, 0),
        cost: toNumber(p?.cost, 0),
      })),

      extras: (raw.extras || []).map((e: any) => ({
        name: e?.name || "Material extra",
        qty: toNumber(e?.qty, 1) || 1,
        unit_price: toNumber(e?.unit_price, 0),
      })),

      financing: (raw.financing || []).map((f: any) => ({
        months: toNumber(f?.months, 0),
        coefficient: toNumber(f?.coefficient, 0),
      })),

      techSpecs: (raw.techSpecs || []).map((t: any) => ({
        title: t?.title || "",
        value: t?.value || "",
      })),

      __extracted_at: new Date().toISOString(),
    };

    console.log(`[${requestId}] [Extract] OK: respondiendo JSON normalizado`);
    return res.status(200).json(normalized);
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    const code = msg === "UPSTREAM_TIMEOUT" ? "UPSTREAM_TIMEOUT" : "INTERNAL_ERROR";
    console.error(`[${requestId}] [Extract] Error final:`, err);

    return res.status(500).json({
      error: `Fallo en la extracción: ${msg}`,
      code,
      requestId,
    });
  }
}
