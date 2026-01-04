
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant } from '../../types';
import { formatCurrency } from '../../i18n';
import { useApp } from '../../AppProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

type PublicCatalogResponse = { 
  tenant: { 
    id?: string; 
    name: string; 
    slug: string;
    status?: string;
    logo_url?: string;
    use_logo_on_web?: boolean;
    is_deleted?: boolean;
  }; 
  products: Array<{ 
    id: string; 
    brand: string;
    model: string;
    description?: any; 
    features?: any;
    price: number; 
    type?: string;
    status?: string;
    image_url?: string;
    brand_logo_url?: string;
    pdf_url?: string;
    pricing?: any;
  }>; 
};

const LOCAL_I18N = {
  es: {
    nav_home: 'Inicio',
    nav_products: 'Productos',
    nav_contact: 'Contacto',
    error_404_msg: 'Error: Empresa no encontrada',
    error_404_btn: 'Volver',
    inactive_title: 'Servicio Suspendido',
    inactive_msg: 'Este espacio digital está desactivado temporalmente.',
    inactive_btn: 'Volver al inicio',
    hero_title_1: 'Clima perfecto,',
    hero_title_2: 'Ahorro real.',
    hero_desc: 'Soluciones de climatización de alta eficiencia para tu hogar.',
    hero_cta_catalog: 'Ver Catálogo',
    catalog_title: 'Catálogo Destacado',
    catalog_subtitle: 'Encuentra el equipo ideal para tu hogar.',
    no_products_filter: 'No hay productos que coincidan con los filtros.',
    wizard_models_available: 'Modelos Disponibles',
    footer_copy: 'EcoQuote AI · Smart Installation Solution',
    filter_type: 'TIPO DE EQUIPO',
    filter_brand: 'MARCA',
    filter_price: 'PRECIO MÁXIMO',
    all_brands: 'Todas las marcas',
    all_types: 'Tots',
    specs_title: 'Especificaciones Técnicas',
    variants_title: 'VARIANTES DISPONIBLES',
    base_price: 'Precio base',
    configure_btn: 'Configurar Presupuesto',
    more_features: '+ {count} características más',
    share_msg: '¡Enlace copiado!',
    since: 'Desde'
  },
  ca: {
    nav_home: 'Inici',
    nav_products: 'Productes',
    nav_contact: 'Contacte',
    error_404_msg: 'Error: Empresa no trobada',
    error_404_btn: 'Tornar',
    inactive_title: 'Servei Suspès',
    inactive_msg: 'Aquest espai digital està desactivat temporalment.',
    inactive_btn: 'Tornar a l\'inici',
    hero_title_1: 'Clima perfecte,',
    hero_title_2: 'Estalvi real.',
    hero_desc: 'Solucions de climatització d’alta eficiència per a la teva llar.',
    hero_cta_catalog: 'Veure Catàleg',
    catalog_title: 'Catàleg Destacat',
    catalog_subtitle: 'Troba l\'equip ideal per a la teva llar.',
    no_products_filter: 'No hi ha productes que coincideixin amb els filtres.',
    wizard_models_available: 'Models Disponibles',
    footer_copy: 'EcoQuote AI · Smart Installation Solution',
    filter_type: 'TIPUS D\'EQUIP',
    filter_brand: 'MARCA',
    filter_price: 'PREU MÀXIM',
    all_brands: 'Totes les marques',
    all_types: 'Tots',
    specs_title: 'Especificacions Tècniques',
    variants_title: 'VARIANTS DISPONIBLES',
    base_price: 'Preu base',
    configure_btn: 'Configurar Pressupost',
    more_features: '+ {count} característiques més',
    share_msg: 'Enllaç copiat!',
    since: 'Des de'
  }
} as const;

export const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { language, setLanguage, session } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [dbProducts, setDbProducts] = useState<PublicCatalogResponse['products']>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isError, setIsError] = useState(false);
  const [rlsError, setRlsError] = useState(false);
  const navigate = useNavigate();

  const tt = (key: keyof typeof LOCAL_I18N['es']) => LOCAL_I18N[language]?.[key] ?? LOCAL_I18N.es[key];

  const [view, setView] = useState<'landing' | 'wizard'>('landing');
  const [detailProduct, setDetailProduct] = useState<any>(null);
  
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(5000);

  useEffect(() => {
    const fetchCatalog = async () => {
      if (!isConfigured) return;
      setIsDataReady(false);
      setIsError(false);
      try {
        const { data: tData, error: tError } = await supabase.from('tenants').select('*').eq('slug', slug).eq('is_deleted', false).single();
        if (tError || !tData) { setIsError(true); return; }
        setTenant(tData as any);
        if (tData.status === 'active') {
          const { data: pData, error: pError } = await supabase.from('products').select('*').eq('tenant_id', tData.id).eq('status', 'active').or('is_deleted.eq.false,is_deleted.is.null');
          if (pError) {
            if (pError.message.toLowerCase().includes('permission denied')) setRlsError(true);
            setDbProducts([]);
          } else if (pData) {
            const normalized = pData.map(p => {
              let pricingArr = p.pricing;
              if (typeof pricingArr === 'string') try { pricingArr = JSON.parse(pricingArr); } catch(e) { pricingArr = []; }
              const prices = (pricingArr || []).map((v: any) => v.price).filter((p: any) => typeof p === 'number');
              const price = prices.length > 0 ? Math.min(...prices) : (p.price || 0);
              return { ...p, price, pricing: pricingArr };
            });
            setDbProducts(normalized);
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
      return matchesType && matchesBrand && matchesPrice;
    });
  }, [dbProducts, categoryFilter, brandFilter, maxPriceFilter]);

  const handleShare = (product: any) => {
    const url = window.location.href + `?id=${product.id}`;
    navigator.clipboard.writeText(url);
    alert(tt('share_msg'));
  };

  const getTechSpecs = (product: any) => {
    try {
      if (!product.features) return [];
      const parsed = typeof product.features === 'string' ? JSON.parse(product.features) : product.features;
      return parsed.techSpecs || [];
    } catch (e) { return []; }
  };

  if (!isDataReady) return <LoadingSpinner />;
  if (isError || !tenant) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
       <div>
         <h1 className="text-9xl font-black text-slate-100 mb-4 italic uppercase">404</h1>
         <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{tt('error_404_msg')}</p>
         <Link to="/" className="mt-10 inline-block px-8 py-3 bg-blue-600 text-white rounded-full font-black uppercase text-[10px]">{tt('error_404_btn')}</Link>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-600/20 overflow-x-hidden">
      {/* Detail Modal */}
      {detailProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetailProduct(null)}></div>
           <div className="relative bg-white w-full max-w-4xl max-h-full overflow-hidden rounded-[2rem] shadow-2xl flex flex-col animate-in zoom-in-95">
              <button onClick={() => setDetailProduct(null)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 z-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>

              <div className="flex-1 overflow-y-auto">
                {/* Header Modal */}
                <div className="p-8 md:p-12 border-b border-slate-50 flex flex-col md:flex-row gap-10 items-center">
                   <div className="w-40 h-40 shrink-0 bg-slate-50 rounded-3xl p-4 flex items-center justify-center">
                      {detailProduct.image_url ? <img src={detailProduct.image_url} className="w-full h-full object-contain" alt={detailProduct.model} /> : <div className="text-slate-200 uppercase font-black text-[10px]">IMG</div>}
                   </div>
                   <div className="text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        {detailProduct.brand_logo_url && <img src={detailProduct.brand_logo_url} className="h-4 w-auto object-contain grayscale" alt="" />}
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{detailProduct.brand}</span>
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic mb-1">{detailProduct.model}</h2>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{detailProduct.type?.replace(/_/g, ' ')}</p>
                   </div>
                </div>

                {/* Body Specs */}
                <div className="p-8 md:p-12">
                   <h3 className="flex items-center gap-3 text-lg font-black uppercase italic tracking-tight mb-8">
                     <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                     {tt('specs_title')}
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {getTechSpecs(detailProduct).map((spec: any, i: number) => (
                        <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                           <div className="w-6 h-6 shrink-0 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mt-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                           </div>
                           <div>
                              <h4 className="text-[11px] font-black uppercase text-slate-900 mb-1">{spec.title}</h4>
                              <p className="text-xs text-slate-500 font-medium leading-relaxed">{spec.description || spec.value}</p>
                           </div>
                        </div>
                      ))}
                   </div>

                   {/* Variantes en Modal */}
                   <div className="mt-12">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 mb-6">{tt('variants_title')}</h3>
                      <div className="flex flex-wrap gap-3">
                         {(detailProduct.pricing || []).map((v: any, i: number) => (
                           <div key={i} className="px-5 py-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[12px] font-bold">
                             <span className="text-slate-600">{v.name?.[language] || v.variant}: </span>
                             <span className="text-blue-600 font-black">{formatCurrency(v.price, language)}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-8 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                 <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 tracking-widest">{tt('base_price')}</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(detailProduct.price, language)}</span>
                 </div>
                 <button onClick={() => { setDetailProduct(null); setView('wizard'); }} className="w-full md:w-auto px-12 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-4">
                    {tt('configure_btn')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-white/80 backdrop-blur-md z-[100] border-b border-gray-100">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 md:px-10">
          <button onClick={() => setView('landing')} className="flex items-center gap-3 shrink-0">
            {tenant.use_logo_on_web && tenant.logo_url ? (
              <img src={tenant.logo_url} className="h-8 md:h-10 w-auto object-contain" alt={tenant.name} />
            ) : (
              <span className="text-lg md:text-xl font-black italic tracking-tighter uppercase text-slate-900">{tenant.name}</span>
            )}
          </button>
          
          <div className="hidden lg:flex items-center gap-1 bg-gray-50/50 p-1 rounded-2xl border border-gray-100/50">
            <button onClick={() => setView('landing')} className={`px-6 py-2 rounded-xl text-[13px] font-bold transition-all ${view === 'landing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{tt('nav_home')}</button>
            <button onClick={() => { setView('landing'); setTimeout(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="px-6 py-2 rounded-xl text-[13px] font-bold text-slate-500 hover:text-slate-900">{tt('nav_products')}</button>
            <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-2 rounded-xl text-[13px] font-bold text-slate-500 hover:text-slate-900">{tt('nav_contact')}</button>
          </div>

          <div className="flex items-center gap-3 md:gap-5 shrink-0">
              <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-[11px] font-black uppercase text-slate-400 outline-none cursor-pointer">
                 <option value="es">ES</option>
                 <option value="ca">CA</option>
              </select>
              <button onClick={() => navigate(session ? `/t/${slug}/dashboard` : `/login?returnTo=${encodeURIComponent(`/t/${slug}/dashboard`)}`)} className="w-10 h-10 flex items-center justify-center text-slate-400 bg-white hover:bg-slate-50 hover:text-slate-900 rounded-xl border border-gray-100 shadow-sm transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </button>
          </div>
        </div>
      </nav>

      {view === 'landing' ? (
        <main className="pb-20 pt-20">
          <div className="px-4 md:px-8 pt-8">
            <section className="max-w-7xl mx-auto relative rounded-[2rem] h-[400px] md:h-[550px] overflow-hidden flex items-center bg-slate-900">
              <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
              <div className="relative px-8 md:px-20 max-w-4xl z-10 text-left">
                <h1 className="text-4xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter mb-6 uppercase italic">
                  {tt('hero_title_1')} <br/>
                  <span className="text-blue-500">{tt('hero_title_2')}</span>
                </h1>
                <p className="text-sm md:text-lg text-white/80 max-w-xl font-medium mb-10 italic">{tt('hero_desc')}</p>
                <button onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">{tt('hero_cta_catalog')}</button>
              </div>
            </section>
          </div>

          <section id="catalog" className="py-20 px-4 md:px-8 scroll-mt-24">
             <div className="max-w-7xl mx-auto">
               <div className="text-left mb-10">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2 uppercase italic">{tt('catalog_title')}</h2>
                  <p className="text-slate-400 font-medium text-sm italic">{tt('catalog_subtitle')}</p>
               </div>
               
               {/* Filters */}
               <div className="bg-white border border-gray-200 rounded-[2rem] p-6 md:p-8 mb-12 shadow-md grid grid-cols-1 md:grid-cols-12 gap-8 items-start text-left">
                  <div className="md:col-span-6">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">{tt('filter_type')}</label>
                    <div className="flex flex-wrap gap-2">
                      {['all', 'aire_acondicionado', 'caldera', 'termo_electrico'].map(id => (
                        <button key={id} onClick={() => setCategoryFilter(id)} className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${categoryFilter === id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100'}`}>
                          {id === 'all' ? tt('all_types') : id.replace(/_/g, ' ').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">{tt('filter_brand')}</label>
                    <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-[11px] font-black uppercase outline-none">
                      <option value="">{tt('all_brands')}</option>
                      {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">{tt('filter_price')}</label>
                      <span className="text-[13px] font-black text-blue-600">{maxPriceFilter} €</span>
                    </div>
                    <input type="range" min="0" max={absoluteMaxPrice || 5000} step="10" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
               </div>

               {/* Grid de Productos Corregida (Imagen 1) */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredProducts.map(p => {
                    const specs = getTechSpecs(p);
                    return (
                      <div key={p.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-md flex flex-col overflow-hidden text-left transition-all hover:shadow-xl group relative">
                         {/* Brand Badge Top Left */}
                         <div className="absolute top-6 left-6 z-10 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
                            {p.brand_logo_url && <img src={p.brand_logo_url} className="h-3 w-auto object-contain grayscale opacity-60" alt="" />}
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{p.brand}</span>
                         </div>

                         {/* Action Column Right */}
                         <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
                            <button onClick={() => handleShare(p)} className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 border border-slate-100 shadow-sm transition-all" title="Compartir">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                            </button>
                            <button 
                              disabled={!p.pdf_url} 
                              onClick={() => p.pdf_url && window.open(p.pdf_url, '_blank')} 
                              className={`w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center border border-slate-100 shadow-sm transition-all ${p.pdf_url ? 'text-slate-400 hover:text-blue-600' : 'text-slate-100 cursor-not-allowed'}`} 
                              title="Ficha Técnica"
                            >
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            </button>
                            <button onClick={() => setDetailProduct(p)} className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 border border-slate-100 shadow-sm transition-all" title="Ver Detalles">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                         </div>

                         {/* Image Section */}
                         <div className="h-64 bg-slate-50/50 flex items-center justify-center p-12 overflow-hidden">
                            {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" alt={p.model} /> : <div className="text-slate-200 uppercase font-black text-xs italic">S/I</div>}
                         </div>

                         {/* Content Section */}
                         <div className="p-8">
                            <div className="flex items-center gap-2 mb-4">
                               <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.243 14.95a1 1 0 101.414-1.414l-.707-.707a1 1 0 10-1.414 1.414l.707.707zM14.95 5.05a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707z" /></svg>
                                  <span className="text-[9px] font-black uppercase tracking-widest">{p.type?.replace(/_/g, ' ')}</span>
                               </div>
                            </div>
                            
                            <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest block mb-1">{p.brand}</span>
                            <h3 className="text-2xl font-black text-blue-600 tracking-tighter uppercase italic leading-none mb-6 group-hover:text-slate-900 transition-colors">{p.model}</h3>

                            {/* Features list (checkmarks) */}
                            <ul className="space-y-2 mb-8 min-h-[80px]">
                               {specs.slice(0, 3).map((spec: any, i: number) => (
                                 <li key={i} className="flex items-center gap-2 text-slate-500">
                                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                    <span className="text-[11px] font-bold truncate">{spec.title}</span>
                                 </li>
                               ))}
                               {specs.length > 3 && (
                                 <li className="pt-1">
                                    <button onClick={() => setDetailProduct(p)} className="text-[10px] font-black uppercase text-blue-600 hover:underline">{tt('more_features').replace('{count}', (specs.length - 3).toString())} →</button>
                                 </li>
                               )}
                            </ul>

                            <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                               <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase text-slate-300">{tt('since')}</span>
                                  <span className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(p.price, language)}</span>
                               </div>
                               <button onClick={() => { setDetailProduct(p); setView('wizard'); }} className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7M3 12h18"/></svg>
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
        <div className="max-w-5xl mx-auto py-24 px-4 text-left animate-in slide-in-from-bottom-8">
           <div className="bg-white p-6 md:p-20 rounded-[2rem] border border-slate-100 shadow-2xl">
              <h2 className="text-3xl font-black tracking-tighter mb-8 italic uppercase">{tt('wizard_models_available')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* FIX: Removed reference to undefined 'selectedProduct' variable */}
                  {dbProducts.map(p => (
                    <button key={p.id} onClick={() => setDetailProduct(p)} className={`p-6 rounded-[2rem] border-2 text-left transition-all border-slate-100 bg-white hover:border-blue-200`}>
                        <h3 className="font-black text-xl text-slate-900 uppercase italic mb-2">{p.brand} {p.model}</h3>
                        <p className="text-2xl font-black text-blue-600 tracking-tighter">{formatCurrency(p.price, language)}</p>
                    </button>
                  ))}
              </div>
              <div className="flex gap-4 mt-12 pt-8 border-t border-slate-50">
                <button onClick={() => setView('landing')} className="px-10 py-5 border-2 border-slate-100 rounded-xl font-black uppercase text-[10px] text-slate-400 hover:bg-slate-50 transition-colors">Volver</button>
                <button onClick={() => setView('landing')} className="flex-1 py-5 bg-slate-900 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-black transition-all">Confirmar</button>
              </div>
           </div>
        </div>
      )}

      <footer className="py-20 border-t border-slate-100 text-center bg-white">
         <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic">© 2025 · {tt('footer_copy')}</div>
      </footer>
    </div>
  );
};
