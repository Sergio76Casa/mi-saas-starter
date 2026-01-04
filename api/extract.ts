
import busboy from 'busboy';
// Fix: Import Buffer from node:buffer to resolve "Cannot find name 'Buffer'" errors.
import { Buffer } from 'node:buffer';
import { GoogleGenAI, Type } from "@google/genai";

// Configuración de Vercel para Node Serverless Runtime
// maxDuration permite extender el timeout (por defecto 10s en Hobby, hasta 60s en Pro)
export const maxDuration = 60;

/**
 * Utilidad para parsear el stream multipart de Node.js usando busboy
 */
// Fix: Added explicit Buffer type from node:buffer import
async function parseMultipart(req: any): Promise<{ buffer: Buffer, fileName: string, mimeType: string }> {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    // Fix: Added explicit Buffer type from node:buffer import
    let fileBuffer: Buffer | null = null;
    let fileName = '';
    let mimeType = '';

    bb.on('file', (_name, file, info) => {
      const { filename, mimeType: mt } = info;
      fileName = filename;
      mimeType = mt;
      const chunks: any[] = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        // Fix: Use global Buffer now available via import
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on('finish', () => {
      if (fileBuffer) {
        resolve({ buffer: fileBuffer, fileName, mimeType });
      } else {
        reject(new Error('No se encontró ningún archivo en la petición'));
      }
    });

    bb.on('error', (err) => reject(err));
    
    // Inyectar el stream de la petición al parser de busboy
    req.pipe(bb);
  });
}

export default async function handler(req: any, res: any) {
  const requestId = Math.random().toString(36).substring(7).toUpperCase();

  // Log para confirmar que estamos en Node Serverless Runtime y NO en Edge
  console.log(`[${requestId}] [Extract] Recibido: Petición iniciada en Node.js (Serverless Runtime)`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido', requestId });
  }

  // Fix: The API key must be obtained exclusively from process.env.API_KEY
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error(`[${requestId}] [Extract] Error: API_KEY no configurada`);
    return res.status(500).json({ 
      error: 'Configuración incompleta: Falta API_KEY.', 
      code: 'KEY_MISSING',
      requestId 
    });
  }

  try {
    // Parseo del archivo usando busboy (Node.js Streams)
    const { buffer, mimeType } = await parseMultipart(req);
    
    if (buffer.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({ 
        error: 'Archivo demasiado grande (máx 4.5MB).', 
        code: 'FILE_TOO_LARGE',
        requestId 
      });
    }

    const base64Data = buffer.toString('base64');

    // Fix: Initialize GoogleGenAI exclusively with process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = "HVAC Expert. Extract technical data and installation materials/extras to JSON. Languages: es/ca. For extras: if quantity is missing use 1. If unit price is missing but total exists, unit_price = total / qty.";

    // Llamada a Gemini con timeout real configurable
    const geminiCall = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: systemInstruction },
          { inlineData: { data: base64Data, mimeType: mimeType || "application/pdf" } },
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
            description: { type: Type.OBJECT, properties: { es: { type: Type.STRING }, ca: { type: Type.STRING } } },
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
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  unit_price: { type: Type.NUMBER }
                }
              }
            },
            financing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  months: { type: Type.NUMBER },
                  coefficient: { type: Type.NUMBER }
                }
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

    // Timeout de 45 segundos para la respuesta de Gemini (dentro del margen de 60s de Node Serverless)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('UPSTREAM_TIMEOUT')), 45000)
    );

    const response = await Promise.race([geminiCall, timeoutPromise]) as any;
    // Fix: Access .text property directly instead of calling it as a function
    const raw = JSON.parse(response.text || "{}");
    
    const normalized = {
      ...raw,
      requestId,
      brand: raw.brand || "Desconocida",
      model: raw.model || "Desconocido",
      pricing: (raw.pricing || []).map((p: any, i: number) => ({
        id: `p${i + 1}`,
        name: p.name || { es: "Precio Base", ca: "Preu Base" },
        price: p.price || 0,
        cost: p.cost || 0
      })),
      extras: (raw.extras || []).map((e: any) => ({
        name: e.name || "Material extra",
        qty: e.qty || 1,
        unit_price: e.unit_price || 0
      })),
      __extracted_at: new Date().toISOString()
    };

    return res.status(200).json(normalized);

  } catch (err: any) {
    console.error(`[${requestId}] Error en API Extract:`, err);
    return res.status(500).json({ 
      error: `Fallo en la extracción: ${err.message || 'Error desconocido'}`,
      code: err.message === 'UPSTREAM_TIMEOUT' ? "UPSTREAM_TIMEOUT" : "INTERNAL_ERROR",
      requestId
    });
  }
}
