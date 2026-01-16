import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    // URL Base para redirección (fallback)
    const baseUrl = new URL(req.url).origin;

    if (!slug) {
        return new Response('Missing slug parameter', { status: 400 });
    }

    // Cliente Supabase (usando las mismas vars de entorno que el frontend)
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener datos del Tenant
    const { data: tenant, error } = await supabase
        .from('tenants')
        .select('name, description, logo_url, share_title, share_description, share_image')
        .eq('slug', slug)
        .single();

    if (error || !tenant) {
        // Si no existe, redirigir al home genérico
        return Response.redirect(`${baseUrl}/#/c/${slug}`, 302);
    }

    // 2. Preparar los metadatos (priorizando los personalizados)
    const title = tenant.share_title || `${tenant.name} | EcoQuote`;
    const description = tenant.share_description || tenant.description || `Solicita tu presupuesto de climatización con ${tenant.name}.`;
    const image = tenant.share_image || tenant.logo_url || `${baseUrl}/og-default.png`; // Fallback image if needed

    // 3. Generar HTML Estático (esto es lo que ve WhatsApp)
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      
      <!-- Social Cards -->
      <title>${title}</title>
      <meta name="description" content="${description}">
      
      <!-- Facebook / WhatsApp / LinkedIn -->
      <meta property="og:type" content="website">
      <meta property="og:url" content="${baseUrl}/#/c/${slug}">
      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${description}">
      <meta property="og:image" content="${image}">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
      
      <!-- Twitter -->
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${title}">
      <meta name="twitter:description" content="${description}">
      <meta name="twitter:image" content="${image}">

      <!-- Redirect automático para humanos -->
      <script>
        window.location.href = "${baseUrl}/#/c/${slug}";
      </script>
    </head>
    <body style="font-family: sans-serif; padding: 20px; text-align: center;">
      <h1>Redirigiendo a ${tenant.name}...</h1>
      <p>Si no eres redirigido, <a href="${baseUrl}/#/c/${slug}">haz clic aquí</a>.</p>
    </body>
    </html>
  `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
