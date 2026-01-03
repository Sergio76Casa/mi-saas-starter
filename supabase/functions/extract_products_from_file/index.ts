
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    // En Deno (Supabase), se prefiere Deno.env, pero mantenemos la compatibilidad solicitada.
    const apiKey = (globalThis as any).process?.env?.API_KEY || (globalThis as any).Deno?.env.get("API_KEY");
    
    if (!apiKey) throw new Error("API_KEY missing in Edge Function environment");

    const ai = new GoogleGenAI({ apiKey });
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { text: "Extract tech specs from HVAC document as JSON." }, 
          { inlineData: { data: base64Data, mimeType: file.type || "application/pdf" } }
        ] 
      },
      config: { responseMimeType: "application/json" }
    });

    return new Response(response.text, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
