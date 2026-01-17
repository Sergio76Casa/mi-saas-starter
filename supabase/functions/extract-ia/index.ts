
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

        const prompt = `Actúa como un experto en climatización (HVAC). Extrae técnica a JSON estricto.
    Kits vs Extras: Kits son packs fijos, Extras son líneas sueltas.
    Esquema: { "brand": "", "model": "", "type": "aire_acondicionado"|"caldera"|"termo_electrico", "stock": 0, "description": {"es": "", "ca": ""}, "pricing": [{"name": {"es": "", "ca": ""}, "price": 0}], "installation_kits": [{"name": "", "price": 0}], "extras": [{"name": "", "qty": 1, "unit_price": 0}], "financing": [{"months": 12, "coefficient": 0}], "techSpecs": [{"title": "", "value": ""}] }`;

        // REPLICANDO EL MODELO QUE FUNCIONABA: gemini-3-flash-preview
        // Usamos v1beta para modelos preview/experimentales
        const modelName = "gemini-3-flash-preview";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const chatResp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            const errorData = await chatResp.json().catch(() => ({ error: { message: "Error desconocido de Gemini" } }));
            throw new Error(errorData.error?.message || `Gemini Error (${chatResp.status})`);
        }

        const data = await chatResp.json();
        const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Extraer JSON de la respuesta (manejo de posibles markdown fences)
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : (resultText || "{}");

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
