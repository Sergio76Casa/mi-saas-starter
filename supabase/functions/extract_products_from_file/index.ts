
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // LOG CRÍTICO PARA IDENTIFICAR EJECUCIÓN
  console.log("!!! EDGE FUNCTION TRIGGERED - VERSION: v2-i18n-es-ca - TIMESTAMP:", new Date().toISOString());

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const systemPrompt = `Extrae datos técnicos. Idiomas: es/ca. Formato: JSON con pricing, installationKits, extras, financing.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: systemPrompt }, { inlineData: { data: base64Data, mimeType: file.type || "application/pdf" } }] }],
      config: { responseMimeType: "application/json" }
    });

    const raw = JSON.parse(response.text || "{}");
    
    // Simplificación del procesado para este snippet de diagnóstico
    const clean: any = {
      brand: raw.brand || "Desconocida",
      model: raw.model || "Desconocido",
      type: "aire_acondicionado",
      pricing: raw.pricing || [{ name: { es: "Precio Base", ca: "Preu Base" }, price: 0 }],
      installationKits: raw.installationKits || [],
      extras: raw.extras || [],
      financing: raw.financing || [],
      __version: "v2-i18n-es-ca", // FIRMA DE VERSIÓN
      __deployed_at: new Date().toISOString()
    };

    console.log("!!! SENDING RESPONSE WITH VERSION:", clean.__version);

    return new Response(JSON.stringify(clean), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("!!! EDGE ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
