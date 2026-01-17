
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY");
        if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) throw new Error("No se ha enviado ningún archivo");

        const mimeType = file.type || "application/octet-stream";
        const bytes = new Uint8Array(await file.arrayBuffer());
        const base64 = encodeBase64(bytes);

        const prompt = `Actúa como un experto en climatización (HVAC). Extrae los datos técnicos a JSON estricto.
    Reglas:
    - Separate 'installation_kits' from 'extras'.
    - 'installation_kits': Paquetes de precio fijo.
    - 'extras': Materiales por cantidad.
    - Numbers: usa punto (.) como decimal.
    Esquema: { "brand": "string", "model": "string", "type": "aire_acondicionado" | "caldera" | "termo_electrico", "stock": number, "description": { "es": "string", "ca": "string" }, "pricing": [{ "name": { "es": "string", "ca": "string" }, "price": number }], "installation_kits": [{ "name": "string", "price": number }], "extras": [{ "name": "string", "qty": number, "unit_price": number }], "financing": [{ "months": number, "coefficient": number }], "techSpecs": [{ "title": "string", "value": "string" }] }`;

        // Usamos el endpoint v1 (estable) con gemini-1.5-flash
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const chatResp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64 } }
                    ]
                }]
            })
        });

        if (!chatResp.ok) {
            const errorText = await chatResp.text();
            console.error("Gemini raw error:", errorText);
            throw new Error(`Gemini Error: ${errorText}`);
        }

        const data = await chatResp.json();
        const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Limpieza de JSON
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : resultText;

        return new Response(jsonStr, {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Error en extract-ia:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
