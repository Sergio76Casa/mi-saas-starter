
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant } from '../../types';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

/**
 * TenantSharePage: 
 * Esta página tiene una doble función:
 * 1. Servir los Meta Tags necesarios para que WhatsApp/Facebook/Google generen la tarjeta de preview.
 * 2. Redirigir al usuario real a la web pública de la empresa.
 */
export const TenantSharePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchTenantData = async () => {
      if (!isConfigured || !slug) return;
      
      try {
        const { data, error: tError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .eq('is_deleted', false)
          .single();

        if (tError || !data) {
          setError(true);
          setLoading(false);
          return;
        }

        setTenant(data as Tenant);
        
        // --- Actualización dinámica de Meta Tags (Útil para crawlers modernos) ---
        const title = data.share_title || `${data.name} - Climatización Premium`;
        const description = data.share_description || `Especialistas en confort para tu hogar. Consulta nuestro catálogo de equipos de climatización.`;
        const image = data.share_image_url || data.logo_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop';

        document.title = title;

        // Actualizar OG Tags
        const updateMeta = (property: string, content: string) => {
          let element = document.querySelector(`meta[property="${property}"]`);
          if (!element) {
            element = document.createElement('meta');
            element.setAttribute('property', property);
            document.head.appendChild(element);
          }
          element.setAttribute('content', content);
        };

        updateMeta('og:title', title);
        updateMeta('og:description', description);
        updateMeta('og:image', image);
        updateMeta('og:url', window.location.href);
        updateMeta('og:type', 'website');

        setLoading(false);

        // Redirigir al usuario real a la landing page después de un breve delay
        // El delay permite que el crawler capture el estado inicial si es necesario
        setTimeout(() => {
          navigate(`/c/${slug}`);
        }, 1500);

      } catch (err) {
        setError(true);
        setLoading(false);
      }
    };

    fetchTenantData();
  }, [slug, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-center p-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic text-slate-900 mb-4">Empresa no encontrada</h1>
          <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px]">Ir al inicio</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-10 text-center">
      <LoadingSpinner />
      <div className="mt-8 space-y-2">
        <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
          {tenant?.name || 'Cargando...'}
        </h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">
          Generando previsualización y redirigiendo...
        </p>
      </div>
    </div>
  );
};
