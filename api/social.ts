import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  const slug = req.query.slug;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  if (!slug) {
    return res.status(400).send('Missing slug parameter');
  }

  // Cliente Supabase (usando las mismas vars de entorno que el frontend)
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    // Redirigir como fallback si no hay variables (aunque no habrá meta tags personalizados)
    return res.redirect(`${baseUrl}/#/c/${slug}`);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Obtener datos del Tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('name, description, logo_url, share_title, share_description, share_image')
      .eq('slug', slug)
      .eq('is_deleted', false)
      .single();

    if (error || !tenant) {
      console.error('Tenant not found or DB error:', error);
      return res.redirect(`${baseUrl}/#/c/${slug}`);
    }

    // 2. Preparar los metadatos (priorizando los personalizados)
    const title = tenant.share_title || `${tenant.name} | EcoQuote`;
    const description = tenant.share_description || tenant.description || `Solicita tu presupuesto de climatización con ${tenant.name}.`;
    const image = tenant.share_image || tenant.logo_url || `${baseUrl}/og-default.png`;

    // 3. Generar HTML Estático
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}/#/c/${slug}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">

  <script>
    window.location.href = "${baseUrl}/#/c/${slug}";
  </script>
</head>
<body style="font-family: sans-serif; padding: 20px; text-align: center;">
  <h1>Cargando tienda de ${tenant.name}...</h1>
  <p>Si no eres redirigido, <a href="${baseUrl}/#/c/${slug}">haz clic aquí</a>.</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cache de 1 hora para bots, pero permite actualizaciones
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (err) {
    console.error('Fatal error in social proxy:', err);
    return res.redirect(`${baseUrl}/#/c/${slug}`);
  }
}
