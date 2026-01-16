
import React, { useState, useEffect, useMemo } from 'react';
// Import routing hooks from react-router to avoid export issues in react-router-dom
import { useParams } from 'react-router';
// Helmet removed in favor of manual component
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant, Branch, Product } from '../../types';
import { formatCurrency } from '../../i18n';
import { useApp } from '../../AppProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Input } from '../../components/common/Input';
import { PublicQuoteConfigurator } from './PublicQuoteConfigurator';
import { PublicFooter } from '../../components/public/PublicFooter';

const LOCAL_I18N = {
  es: {
    nav_home: 'Inicio',
    nav_products: 'Productos',
    nav_contact: 'Contacto',
    error_404_msg: 'Error: Empresa no encontrada',
    error_404_btn: 'Volver',
    back_to_catalog: 'Volver al catálogo',
    step_model: 'Selecciona Potencia / Modelo',
    step_install: 'Tipo de Instalación',
    step_extras: 'Extras de Instalación',
    step_payment: 'Opciones de Pago',
    summary_title: 'Resumen',
    summary_total: 'Total Estimado',
    btn_save_quote: 'Guardar Presupuesto',
    btn_view_tech: 'Ver Ficha Técnica Original',
    payment_cash: 'Pago al Contado',
    vat_included: 'IVA e instalación incluidos',
    selected_variant: 'Modelo',
    selected_kit: 'Instalación',
    selected_extras: 'Extras',
    none: 'Ninguno',
    more_features: '+ {count} características más →',
    share_msg: '¡Enlace copiado!',
    share_btn: 'Compartir',
    since: 'Desde',
    footer_copy: 'Todos los derechos reservados',
    modal_close: 'Cerrar',
    configure_btn: 'Configurar ahora',
    hero_title_1: 'Climatización para',
    hero_title_2: 'tu hogar ideal',
    hero_desc: 'Encuentra el equipo perfecto con nuestra herramienta de selección inteligente.',
    hero_cta_catalog: 'Ver Catálogo',
    catalog_title: 'Catálogo Destacado',
    catalog_subtitle: 'Equipos seleccionados con la mejor relación calidad-precio',
    filter_type: 'Tipo de equipo',
    all_types: 'Todos los tipos',
    filter_brand: 'Marca',
    all_brands: 'Todas las marques',
    filter_price: 'Precio máximo',
    filter_search: 'Buscar por modelo',
    link_install: 'Instalación',
    link_maint: 'Mantenimiento',
    link_repair: 'Reparación',
    link_warranty: 'Garantías',
    link_privacy: 'Privacidad',
    link_cookies: 'Cookies',
    link_legal: 'Aviso Legal',
    menu_open: 'Menú',
    menu_close: 'Cerrar'
  },
  ca: {
    nav_home: 'Inici',
    nav_products: 'Productes',
    nav_contact: 'Contacte',
    error_404_msg: 'Error: Empresa no trobada',
    error_404_btn: 'Tornar',
    back_to_catalog: 'Tornar al catàleg',
    step_model: 'Selecciona Potència / Model',
    step_install: 'Tipus d\'Instal·lació',
    step_extras: 'Extras d\'Instal·lació',
    step_payment: 'Opcions de Pagament',
    summary_title: 'Resum',
    summary_total: 'Total Estimat',
    btn_save_quote: 'Desar Pressupost',
    btn_view_tech: 'Veure Fitxa Tècnica Original',
    payment_cash: 'Pagament al Comptat',
    vat_included: 'IVA i instal·lació inclosos',
    selected_variant: 'Model',
    selected_kit: 'Instal·lació',
    selected_extras: 'Extras',
    none: 'Cap',
    more_features: '+ {count} característiques més →',
    share_msg: 'Enllaç copiat!',
    share_btn: 'Compartir',
    since: 'Des de',
    footer_copy: 'Tots els drets reservats',
    modal_close: 'Tancar',
    configure_btn: 'Configurar ara',
    hero_title_1: 'Climatització per a',
    hero_title_2: 'la teva llar ideal',
    hero_desc: 'Troba l\'equip perfecte amb la nostra eina de selecció intel·ligent.',
    hero_cta_catalog: 'Veure Catàleg',
    catalog_title: 'Catàleg Destacat',
    catalog_subtitle: 'Equips seleccionats amb la millor relació qualitat-preu',
    filter_type: 'Tipus d\'equip',
    all_types: 'Tots els tipus',
    filter_brand: 'Marca',
    all_brands: 'Totes les marques',
    filter_price: 'Preu màxim',
    filter_search: 'Cercar per model',
    link_install: 'Instal·lació',
    link_maint: 'Manteniment',
    link_repair: 'Reparació',
    link_warranty: 'Garanties',
    link_privacy: 'Privacitat',
    link_cookies: 'Cookies',
    link_legal: 'Avís Legal',
    menu_open: 'Menú',
    menu_close: 'Tancar'
  }
} as const;

export const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { language, setLanguage } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isError, setIsError] = useState(false);

  const [view, setView] = useState<'landing' | 'configurator'>('landing');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(5000);

  const tt = (key: keyof typeof LOCAL_I18N['es'], params?: Record<string, any>) => {
    let msg = (LOCAL_I18N[language] as any)?.[key] ?? (LOCAL_I18N.es as any)[key];
    if (!msg) return key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        msg = msg.replace(`{${k}}`, String(v));
      });
    }
    return msg;
  };

  useEffect(() => {
    const fetchCatalog = async () => {
      if (!isConfigured) return;

      setIsDataReady(false);
      setIsError(false);
      setTenant(null);
      setBranches([]);

      try {
        const { data: tData, error: tError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .eq('is_deleted', false)
          .single();

        if (tError || !tData) { setIsError(true); return; }

        setTenant(tData as any);

        const { data: bData } = await supabase
          .from('tenant_branches')
          .select('*')
          .eq('tenant_id', tData.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (bData) setBranches(bData);

        if (tData.status === 'active') {
          const { data: pData } = await supabase
            .from('products')
            .select('*')
            .eq('tenant_id', tData.id)
            .eq('status', 'active')
            .or('is_deleted.eq.false,is_deleted.is.null');

          if (pData) {
            const normalized = pData.map(p => {
              let pricingArr = p.pricing;
              if (typeof pricingArr === 'string') try { pricingArr = JSON.parse(pricingArr); } catch (e) { pricingArr = []; }
              let desc = p.description;
              if (typeof desc === 'string') try { desc = JSON.parse(desc); } catch (e) { desc = { es: '', ca: '' }; }
              let kits = p.installation_kits;
              if (typeof kits === 'string') try { kits = JSON.parse(kits); } catch (e) { kits = []; }
              let extras = p.extras;
              if (typeof extras === 'string') try { extras = JSON.parse(extras); } catch (e) { extras = []; }

              const prices = (pricingArr || []).map((v: any) => v.price).filter((p: any) => typeof p === 'number');
              const price = prices.length > 0 ? Math.min(...prices) : (p.price || 0);

              return { ...p, price, pricing: pricingArr, description: desc, installation_kits: kits, extras: extras };
            });
            setDbProducts(normalized as Product[]);
            if (normalized.length > 0) setMaxPriceFilter(Math.max(...normalized.map(p => p.price)));
          }
        }
      } catch (err) { setIsError(true); } finally { setIsDataReady(true); }
    };
    fetchCatalog();
  }, [slug]);

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    dbProducts.forEach(p => {
      if ((categoryFilter === 'all' || p.type === categoryFilter) && p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [dbProducts, categoryFilter]);

  const absoluteMaxPrice = useMemo(() => dbProducts.length > 0 ? Math.max(...dbProducts.map(p => p.price)) : 0, [dbProducts]);

  const filteredProducts = useMemo(() => {
    return dbProducts.filter(p => {
      const matchesType = categoryFilter === 'all' || p.type === categoryFilter;
      const matchesBrand = !brandFilter || p.brand === brandFilter;
      const matchesPrice = p.price <= maxPriceFilter;
      const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesBrand && matchesPrice && matchesSearch;
    });
  }, [dbProducts, categoryFilter, brandFilter, maxPriceFilter, searchTerm]);

  const handleOpenConfigurator = (product: Product) => {
    setSelectedProduct(product);
    setDetailProduct(null);
    setView('configurator');
    window.scrollTo(0, 0);
  };

  /**
   * handleShare: Actualizado para usar la nueva ruta de /share/:slug
   * que genera la tarjeta de previsualización para WhatsApp.
   */
  const handleShare = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();


    // El link de compartir apunta a la nueva API de Metadata Proxy para que WhatsApp lea la imagen
    const shareUrl = `${window.location.origin}/api/social?slug=${slug}`;
    const prefill = tenant?.whatsapp_prefill_text || `¡Hola! Mira este equipo: ${product.brand} ${product.model}. Puedes verlo aquí:`;

    if (navigator.share) {
      navigator.share({
        title: tenant?.share_title || `${product.brand} ${product.model}`,
        text: prefill,
        url: shareUrl
      }).catch(() => {
        // Fallback a portapapeles si falla
        navigator.clipboard.writeText(shareUrl);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      });
    } else {
      // Fallback a WhatsApp Web/App directo
      const waUrl = `https://wa.me/?text=${encodeURIComponent(prefill + " " + shareUrl)}`;
      window.open(waUrl, '_blank');

      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  const getTechSpecs = (product: Product) => {
    if (!product.features) return [];
    try {
      const parsed = typeof product.features === 'string' ? JSON.parse(product.features) : product.features;
      return parsed.techSpecs || [];
    } catch (e) { return []; }
  };

  const scrollToCatalog = () => {
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const scrollToContact = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  if (!isDataReady) return <LoadingSpinner />;

  if (isError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-center p-10">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 mb-4">{tt('error_404_msg')}</h1>
          <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">{tt('error_404_btn')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600/20 overflow-x-hidden transition-all duration-500">



      {/* SEO & Meta Tags - Managed manually for reliability */}
      {tenant && <TenantSEOMetadata tenant={tenant} />}

      {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          {tt('share_msg')}
        </div>
      )}

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[150] transition-all duration-500 lg:hidden ${isMobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
        <div className="flex flex-col h-full p-10">
          <div className="flex justify-between items-center mb-16">
            <span className="text-xl font-black italic text-white uppercase">{tenant?.name}</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-full text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex flex-col gap-8 text-center">
            <button onClick={() => { setView('landing'); window.scrollTo(0, 0); setIsMobileMenuOpen(false); }} className="text-3xl font-black text-white uppercase italic tracking-tighter">{tt('nav_home')}</button>
            <button onClick={scrollToCatalog} className="text-3xl font-black text-white uppercase italic tracking-tighter">{tt('nav_products')}</button>
            <button onClick={scrollToContact} className="text-3xl font-black text-white uppercase italic tracking-tighter">{tt('nav_contact')}</button>
          </div>

          <div className="mt-auto flex flex-col gap-6">
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => { setLanguage('es'); setIsMobileMenuOpen(false); }} className={`text-xl font-black ${language === 'es' ? 'text-blue-500' : 'text-white/40'}`}>ES</button>
              <button onClick={() => { setLanguage('ca'); setIsMobileMenuOpen(false); }} className={`text-xl font-black ${language === 'ca' ? 'text-blue-500' : 'text-white/40'}`}>CA</button>
            </div>
            <a href="#/login" className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black uppercase text-sm tracking-widest text-center">
              Panel Gestión
            </a>
          </div>
        </div>
      </div>

      {detailProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetailProduct(null)}></div>
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
              <button
                onClick={(e) => handleShare(e, detailProduct)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors shadow-sm"
                title={tt('share_btn')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              </button>
              <button onClick={() => setDetailProduct(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 text-left">
              <div className="flex flex-col md:flex-row gap-10 items-center border-b border-slate-100 pb-10">
                <div className="w-56 h-56 shrink-0 bg-slate-50 rounded-2xl p-6 flex items-center justify-center shadow-inner">
                  {detailProduct.image_url ? <img src={detailProduct.image_url} className="w-full h-full object-contain" alt={detailProduct.model} /> : <div className="text-slate-200 uppercase font-black text-[10px]">Sin Imagen</div>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {detailProduct.brand_logo_url && <img src={detailProduct.brand_logo_url} className="h-4 w-auto object-contain grayscale opacity-60" alt="" />}
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{detailProduct.brand}</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic mb-1 leading-none">{detailProduct.model}</h2>
                  <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                    {detailProduct.type?.replace(/_/g, ' ')}
                  </div>
                  {detailProduct.description?.[language] && <p className="text-slate-500 font-medium italic text-sm leading-relaxed max-w-xl">"{detailProduct.description[language]}"</p>}
                </div>
              </div>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">Especificaciones Técnicas</h4>
                  <div className="space-y-4">
                    {getTechSpecs(detailProduct).map((spec: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-3">
                        <span className="text-[10px] font-black uppercase text-slate-400">{spec.title}</span>
                        <span className="text-xs font-bold text-slate-700">{spec.value || spec.description}</span>
                      </div>
                    ))}
                    {getTechSpecs(detailProduct).length === 0 && <p className="text-xs italic text-slate-300">No hay especificaciones adicionales.</p>}
                  </div>
                </div>
                <div className="space-y-8">
                  {detailProduct.pdf_url && (
                    <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100">
                      <h5 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Documentación</h5>
                      <a href={detailProduct.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-4 text-slate-600 hover:text-blue-600 transition-all group">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest italic">Ver Ficha Técnica PDF</span>
                      </a>
                    </div>
                  )}
                  <button onClick={() => handleOpenConfigurator(detailProduct)} className="w-full py-5 bg-blue-600 text-white rounded-xl font-black uppercase text-[12px] tracking-widest shadow-xl shadow-blue-900/10 hover:bg-blue-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-4">
                    {tt('configure_btn')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md z-[100] border-b border-slate-200 transition-all duration-300">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 md:px-10">
          <button onClick={() => { setView('landing'); window.scrollTo(0, 0); }} className="flex items-center gap-3 hover:scale-105 transition-transform">
            {tenant?.use_logo_on_web && tenant?.logo_url ? (
              <img src={tenant.logo_url} className="h-10 w-auto object-contain" alt={tenant?.name} />
            ) : (
              <span className="text-xl font-black italic tracking-tighter uppercase text-slate-900">{tenant?.name}</span>
            )}
          </button>

          <div className="hidden lg:flex items-center gap-12">
            <button onClick={() => { setView('landing'); window.scrollTo(0, 0); }} className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">{tt('nav_home')}</button>
            <button onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })} className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">{tt('nav_products')}</button>
            <button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">{tt('nav_contact')}</button>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Language Selector (Hidden on smallest mobile, shown inside menu) */}
            <div className="hidden sm:flex items-center gap-3 bg-slate-100/80 px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-[10px] font-black uppercase text-slate-600 outline-none cursor-pointer">
                <option value="es">ES</option>
                <option value="ca">CA</option>
              </select>
            </div>

            {/* Login Button (Hidden on smallest mobile, shown inside menu) */}
            <a href="#/login" className="hidden sm:flex w-12 h-12 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 active:scale-95 group">
              <svg className="w-5 h-5 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>

            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden w-12 h-12 flex items-center justify-center bg-slate-900 text-white rounded-xl shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
          </div>
        </div>
      </nav>

      {view === 'landing' ? (
        <main className="pb-24 pt-20">
          <div className="px-6 md:px-10 pt-10">
            <section className="max-w-7xl mx-auto relative rounded-3xl h-[500px] md:h-[650px] overflow-hidden flex items-center bg-slate-900 shadow-2xl group border border-slate-800 transition-all duration-700">
              <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[4s]" alt="" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent"></div>
              <div className="relative px-10 md:px-24 max-w-4xl z-10 text-left">
                <h1 className="text-5xl md:text-8xl font-black text-white leading-tight tracking-tighter mb-8 uppercase italic animate-in slide-in-from-bottom-6 duration-700">
                  {tt('hero_title_1')} <br /><span className="text-blue-500 drop-shadow-xl">{tt('hero_title_2')}</span>
                </h1>
                <p className="text-lg md:text-2xl text-white/70 max-w-xl font-medium mb-12 italic animate-in slide-in-from-bottom-8 duration-1000 delay-150">{tt('hero_desc')}</p>
                <button onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })} className="px-12 py-6 bg-blue-600 text-white rounded-xl font-black uppercase text-[12px] tracking-[0.15em] shadow-2xl shadow-blue-600/30 hover:bg-blue-500 hover:scale-[1.05] active:scale-95 transition-all animate-in zoom-in-50 duration-700 delay-300">
                  {tt('hero_cta_catalog')}
                </button>
              </div>
            </section>
          </div>

          <section id="catalog" className="py-24 px-6 md:px-10 scroll-mt-24">
            <div className="max-w-7xl mx-auto">
              <div className="text-left mb-16 animate-in fade-in duration-700">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 uppercase italic text-slate-900">{tt('catalog_title')}</h2>
                <p className="text-slate-500 font-medium text-lg italic">{tt('catalog_subtitle')}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-8 mb-16 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-end text-left transition-all duration-300 hover:shadow-md">
                <div className="md:col-span-12 lg:col-span-3">
                  <Input
                    label={tt('filter_search')}
                    placeholder="Ej: Comfee..."
                    value={searchTerm}
                    onChange={(e: any) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="md:col-span-12 lg:col-span-5 overflow-hidden">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5">{tt('filter_type')}</label>
                  <div className="flex lg:flex-nowrap flex-wrap gap-2 items-center overflow-x-auto no-scrollbar pb-1">
                    {['all', 'aire_acondicionado', 'caldera', 'termo_electrico'].map(id => (
                      <button
                        key={id}
                        onClick={() => setCategoryFilter(id)}
                        className={`px-3 py-1.5 rounded-xl text-[8px] font-black tracking-widest transition-all uppercase border-2 whitespace-nowrap ${categoryFilter === id ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-900/20' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {id === 'all' ? tt('all_types').split(' ')[0] : id.split('_')[0].replace('aire', 'aire acc.')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-6 lg:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">{tt('filter_brand')}</label>
                  <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 text-[10px] font-black uppercase outline-none focus:border-blue-600 transition-colors appearance-none cursor-pointer">
                    <option value="">{tt('all_brands')}</option>
                    {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="md:col-span-6 lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{tt('filter_price')}</label>
                    <span className="text-[14px] font-black text-blue-600 tabular-nums">{maxPriceFilter} €</span>
                  </div>
                  <input type="range" min="0" max={absoluteMaxPrice || 5000} step="10" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {filteredProducts.map(p => {
                  const specs = getTechSpecs(p);
                  const remainingCount = Math.max(0, specs.length - 3);

                  return (
                    <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden text-left transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/10 hover:scale-[1.03] group relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="h-80 bg-slate-50/50 flex items-center justify-center p-12 overflow-hidden relative">
                        <div className="absolute top-6 right-6 z-20 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-4 group-hover:translate-x-0">
                          <button onClick={(e) => handleShare(e, p)} className="w-10 h-10 bg-white text-slate-400 hover:text-blue-600 rounded-full flex items-center justify-center shadow-md border border-slate-100 transition-all hover:scale-110" title={tt('share_btn')}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDetailProduct(p); }} className="w-10 h-10 bg-white text-slate-400 hover:text-blue-600 rounded-full flex items-center justify-center shadow-md border border-slate-100 transition-all hover:scale-110" title="Ver características">
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                        </div>

                        {p.image_url ? (
                          <img src={p.image_url} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" alt={p.model} />
                        ) : (
                          <div className="text-slate-200 uppercase font-black text-xs italic">Sin Imagen</div>
                        )}
                      </div>

                      <div className="p-8 flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-4">
                          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                            {p.type?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] font-black uppercase text-slate-300 tracking-[0.2em]">{p.brand}</span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-6 min-h-[64px] line-clamp-2">{p.model}</h3>

                        <div className="space-y-3 mb-8 flex-1">
                          {specs.slice(0, 3).map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 text-slate-500">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full opacity-30"></div>
                              <span className="text-[11px] font-bold italic tracking-wide">{s.title}: <span className="text-slate-900 not-italic">{s.value || s.description}</span></span>
                            </div>
                          ))}
                          {remainingCount > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDetailProduct(p); }}
                              className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 hover:underline pt-2 block transition-colors"
                            >
                              {tt('more_features', { count: remainingCount })}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{tt('since')}</span>
                            <span className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">{formatCurrency(p.price, language)}</span>
                          </div>
                          <button
                            onClick={() => handleOpenConfigurator(p)}
                            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-900/10 hover:scale-110 active:scale-95 group/btn"
                          >
                            <svg className="w-6 h-6 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7M3 12h18" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="pb-24 pt-32 px-6 md:px-10 bg-slate-50 min-h-screen">
          <PublicQuoteConfigurator
            product={selectedProduct!}
            tenant={tenant}
            language={language}
            onBack={() => setView('landing')}
            translations={LOCAL_I18N}
          />
        </main>
      )}

      <PublicFooter
        tenant={tenant}
        branches={branches}
        language={language}
        translations={LOCAL_I18N}
      />
    </div>
  );
};

// Internal component to handle SEO reliably without external dependencies
function TenantSEOMetadata({ tenant }: { tenant: any }) {
  React.useEffect(() => {
    if (!tenant) return;

    // Update Title
    document.title = `${tenant.name} | EcoQuote`;

    // Helper to update or create meta tag
    const updateMeta = (name: string, content: string, isProperty: boolean = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector);

      if (!element) {
        element = document.createElement('meta');
        if (isProperty) {
          element.setAttribute('property', name);
        } else {
          element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
      // Mark as managed by us for potential cleanup if we needed it
      element.setAttribute('data-manage-seo', 'true');
    };

    // Standard Description
    updateMeta('description', tenant.description || `Solicita tu presupuesto de climatización con ${tenant.name}.`);

    // Open Graph
    updateMeta('og:title', `${tenant.name} - Climatización y Presupuestos`, true);
    updateMeta('og:description', tenant.description || `Solicita tu presupuesto de climatización con ${tenant.name}.`, true);
    updateMeta('og:url', window.location.href, true);
    updateMeta('og:type', 'website', true);

    if (tenant.logo_url) {
      updateMeta('og:image', tenant.logo_url, true);
    }

    // Cleanup function: optional, but good practice to reset title or tags on unmount
    return () => {
      // document.title = 'EcoQuote'; // Optional: reset title
    };
  }, [tenant]);

  return null;
}
