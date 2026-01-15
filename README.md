
# SaaS Multi-tenant Bilingüe (ES/CA)

Sistema completo para gestión de empresas con soporte para dos webs (Plataforma y Cliente) y dos idiomas.

## Estructura de Rutas

1. **Plataforma Principal**
   - `/` : Landing Page (Editable desde Superadmin).
   - `/pricing`: Precios.
   - `/admin`: Panel Superadmin (CMS Global, Estadísticas).

2. **Webs de Clientes**
   - `/c/[slug]`: Web pública de cada empresa (ej: `/c/mi-empresa`).
   - `/p/[id]`: Vista pública de un presupuesto.

3. **Panel de Gestión (Tenant)**
   - `/t/[slug]/dashboard`: Resumen.
   - `/t/[slug]/website`: CMS para editar la web pública (`/c/[slug]`).
   - `/t/[slug]/quotes`: Gestión de presupuestos.

## Idiomas (i18n)

- Todo el sistema soporta Español (ES) y Catalán (CA).
- El idioma se selecciona en la barra superior y se guarda en `localStorage`.
- Los PDFs y formatos de moneda (EUR) respetan el idioma seleccionado.

## Instalación

1. Crear proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en el Editor SQL.
3. Configurar `.env` con URL y KEY de Supabase.
4. `npm install` y `npm start`.

## Gestión de Contenidos (CMS)

- **Tabla `platform_content`**: Guarda los textos de la web principal.
- **Tabla `tenant_content`**: Guarda los textos de las webs de los clientes.
