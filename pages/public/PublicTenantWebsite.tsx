
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant, Branch, Product } from '../../types';
import { formatCurrency } from '../../i18n';
import { useApp } from '../../AppProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PublicQuoteConfigurator } from './PublicQuoteConfigurator';

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
    since: 'Desde',
    footer_copy: 'Todos los derechos reservados',
    modal_close: 'Cerrar',
    configure_btn: 'Configurar ahora',
    hero_title_1: 'Climatización para',
    hero_title_2: 'tu hogar ideal',
    hero_desc: 'Encuentra el equipo perfecto con nuestra herramienta de selección inteligente.',
    hero_cta_catalog: 'Ver Catálogo',
    catalog_title: 'Nuestro Catálogo',
    catalog_subtitle: 'Equipos seleccionados con la mejor relación calidad-precio',
    filter_type: 'Tipo de equipo',
    all_types: 'Todos los tipos',
    filter_brand: 'Marca',
    all_brands: 'Todas las marcas',
    filter_price: 'Precio máximo',
    link_install: 'Instalación',
    link_maint: 'Mantenimiento'
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
    since: 'Des de',
    footer_copy: 'Tots els drets reservats',
    modal_close: 'Tancar',
    configure_btn: 'Configurar ara',
    hero_title_1: 'Climatització per a',
    hero_title_2: 'la teva llar ideal',
    hero_desc: 'Troba l\'equip perfecte amb la nostra eina de selecció intel·ligent.',
    hero_cta_catalog: 'Veure Catàleg',
    catalog_title: 'El Nostre Catàleg',
    catalog_subtitle: 'Equips seleccionats amb la millor relació qualitat-preu',
    filter_type: 'Tipus d\'equip',
    all_types: 'Tots els tipus',
    filter_brand: 'Marca',
    all_brands: 'Totes les marques',
    filter_price: 'Preu màxim',
    link_install: 'Instal·lació',
    link_maint: 'Manteniment'
  }
} as const;

const FOOTER_MODAL_CONTENT: Record<string, any> = {
  instalacion: {
    title: { es: 'Instalación', ca: 'Instal·lació' },
    img: 'https://images.unsplash.com/photo-1621905252507-b35220adcfba?q=80&w=2070&auto=format&fit=crop',
    desc: {
      es: 'Instalación profesional, limpia y certificada. Te asesoramos y dejamos el equipo listo para funcionar con máxima eficiencia.',
      ca: 'Instal·lació professional, neta i certificada. T’assessorem i deixem l’equip a punt per funcionar amb la màxima eficiència.'
    }
  },
  mantenimiento: {
    title: { es: 'Mantenimiento', ca: 'Manteniment' },
    img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2069&auto=format&fit=crop',
    desc: {
      es: 'Revisiones periódicas para alargar la vida útil del equipo, mejorar el rendimiento y reducir el consumo.',
      ca: 'Revisions periòdiques per allargar la vida útil de l’equip, millorar el rendiment i reduir el consum.'
    }
  }
};

export const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { language, setLanguage } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isError, setIsError] = useState(false);

  const [view, setView] = useState<'landing' | 'configurator'>('landing');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeFooterModal, setActiveFooterModal] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(5000);

  const tt = (key: keyof typeof LOCAL_I18N['es'], params?: Record<string, any>) => {
    let msg = (LOCAL_I18N[language] as any)?.[key] ?? (LOCAL_I18N.es as any)[key];
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        msg = msg.replace(`{${k}}`, v);
      });
    }
    return msg;
  };

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
          const { data: pData } = await supabase.from('products').select('*').eq('tenant_id', tData.id).eq('status', 'active').or('is_deleted.eq.false,is_deleted.is.null');
          
          if (pData) {
            const normalized = pData.map(p => {
              let pricingArr = p.pricing;
              if (typeof pricingArr === 'string') try { pricingArr = JSON.parse(pricingArr); } catch(e) { pricingArr = []; }
              
              let desc = p.description;
              if (typeof desc === 'string') try { desc = JSON.parse(desc); } catch(e) { desc = { es: '', ca: '' }; }

              let kits = p.installation_kits;
              if (typeof kits === 'string') try { kits = JSON.parse(kits); } catch(e) { kits = []; }

              let extras = p.extras;
              if (typeof extras === 'string') try { extras = JSON.parse(extras); } catch(e) { extras = []; }

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
      return matchesType && matchesBrand && matchesPrice;
    });
  }, [dbProducts, categoryFilter, brandFilter, maxPriceFilter]);

  const handleOpenConfigurator = (product: Product) => {
    setSelectedProduct(product);
    setDetailProduct(null);
    setView('configurator');
    window.scrollTo(0, 0);
  };

  const handleShare = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `${product.brand} ${product.model}`, url });
    } else {
      navigator.clipboard.writeText(url);
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

  if (!isDataReady) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-600/20 overflow-x-hidden">
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          {tt('share_msg')}
        </div>
      )}

      {/* Detail Modal (Characteristics) */}
      {detailProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetailProduct(null)}></div>
           <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in-95">
              <button onClick={() => setDetailProduct(null)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 z-10 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="flex-1 overflow-y-auto p-8 md:p-12 text-left">
                <div className="flex flex-col md:flex-row gap-10 items-center border-b border-slate-50 pb-10">
                   <div className="w-48 h-48 shrink-0 bg-slate-50 rounded-[2rem] p-6 flex items-center justify-center">
                      {detailProduct.image_url ? <img src={detailProduct.image_url} className="w-full h-full object-contain" alt={detailProduct.model} /> : <div className="text-slate-200 uppercase font-black text-[10px]">IMG</div>}
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {detailProduct.brand_logo_url && <img src={detailProduct.brand_logo_url} className="h-4 w-auto object-contain grayscale" alt="" />}
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{detailProduct.brand}</span>
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic mb-1">{detailProduct.model}</h2>
                      <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">{detailProduct.type?.replace(/_/g, ' ')}</p>
                      {detailProduct.description?.[language] && <p className="text-slate-500 font-medium italic text-sm leading-relaxed max-w-xl">"{detailProduct.description[language]}"</p>}
                   </div>
                </div>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                   <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] mb-6">Especificaciones Técnicas</h4>
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
                        <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                           <h5 className="text-[10px] font-black uppercase text-blue-600 mb-4 tracking-widest">Documentación</h5>
                           <a href={detailProduct.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-blue-700 hover:text-blue-900 transition-colors">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-widest italic">Ver Ficha Técnica PDF</span>
                           </a>
                        </div>
                      )}
                      <div className="flex flex-col gap-4">
                        <button onClick={() => handleOpenConfigurator(detailProduct)} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-4">
                           {tt('configure_btn')}
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                        </button>
                      </div>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Footer Modal (Instalación/Mantenimiento) */}
      {activeFooterModal && FOOTER_MODAL_CONTENT[activeFooterModal] && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveFooterModal(null)}></div>
           <div className="relative bg-white w-full max-w-xl overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in-95">
              <button onClick={() => setActiveFooterModal(null)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/40 z-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="h-48 relative overflow-hidden">
                <img src={FOOTER_MODAL_CONTENT[activeFooterModal].img} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent text-white"></div>
              </div>
              <div className="p-10 md:p-12 text-center">
                <h3 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 mb-6">{FOOTER_MODAL_CONTENT[activeFooterModal].title[language]}</h3>
                <p className="text-slate-500 font-medium leading-relaxed italic text-lg">{FOOTER_MODAL_CONTENT[activeFooterModal].desc[language]}</p>
                <button onClick={() => setActiveFooterModal(null)} className="mt-10 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-black transition-all">{tt('modal_close')}</button>
              </div>
           </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-white/80 backdrop-blur-md z-[100] border-b border-gray-100">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 md:px-10">
          <button onClick={() => setView('landing')} className="flex items-center gap-3">
            {tenant?.use_logo_on_web && tenant?.logo_url ? (
              <img src={tenant.logo_url} className="h-8 md:h-10 w-auto object-contain" alt={tenant?.name} />
            ) : (
              <span className="text-lg md:text-xl font-black italic tracking-tighter uppercase text-slate-900">{tenant?.name}</span>
            )}
          </button>
          <div className="flex items-center gap-4">
              <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-[11px] font-black uppercase text-slate-400 outline-none cursor-pointer">
                 <option value="es">ES</option>
                 <option value="ca">CA</option>
              </select>
          </div>
        </div>
      </nav>

      {view === 'landing' ? (
        <main className="pb-20 pt-20">
          <div className="px-4 md:px-8 pt-8">
            <section className="max-w-7xl mx-auto relative rounded-[2.5rem] h-[400px] md:h-[550px] overflow-hidden flex items-center bg-slate-900 shadow-xl">
              <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
              <div className="relative px-8 md:px-20 max-w-4xl z-10 text-left">
                <h1 className="text-4xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter mb-6 uppercase italic">
                  {tt('hero_title_1')} <br/><span className="text-blue-500">{tt('hero_title_2')}</span>
                </h1>
                <p className="text-sm md:text-lg text-white/80 max-w-xl font-medium mb-10 italic">{tt('hero_desc')}</p>
                <button onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-600/20 hover:scale-105 transition-all">{tt('hero_cta_catalog')}</button>
              </div>
            </section>
          </div>

          <section id="catalog" className="py-20 px-4 md:px-8 scroll-mt-24">
             <div className="max-w-7xl mx-auto">
               <div className="text-left mb-10">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2">{tt('catalog_title')}</h2>
                  <p className="text-slate-400 font-medium text-sm italic">{tt('catalog_subtitle')}</p>
               </div>
               
               {/* Filters */}
               <div className="bg-white border border-gray-100 rounded-[2rem] p-6 md:p-8 mb-12 shadow-md grid grid-cols-1 md:grid-cols-12 gap-8 items-start text-left">
                  <div className="md:col-span-12 lg:col-span-6">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">{tt('filter_type')}</label>
                    <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center">
                      {['all', 'aire_acondicionado', 'caldera', 'termo_electrico'].map(id => (
                        <button key={id} onClick={() => setCategoryFilter(id)} className={`px-4 py-2 rounded-full text-[9px] font-black tracking-widest transition-all shrink-0 ${categoryFilter === id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100'}`}>
                          {id === 'all' ? tt('all_types') : id.replace(/_/g, ' ').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-6 lg:col-span-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">{tt('filter_brand')}</label>
                    <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-[11px] font-black uppercase outline-none">
                      <option value="">{tt('all_brands')}</option>
                      {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-6 lg:col-span-3">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">{tt('filter_price')}</label>
                      <span className="text-[13px] font-black text-blue-600">{maxPriceFilter} €</span>
                    </div>
                    <input type="range" min="0" max={absoluteMaxPrice || 5000} step="10" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
               </div>

               {/* Grid */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredProducts.map(p => {
                    const specs = getTechSpecs(p);
                    const remainingCount = Math.max(0, specs.length - 3);

                    return (
                      <div key={p.id} className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm flex flex-col overflow-hidden text-left transition-all hover:shadow-xl group">
                          {/* Top Section / Image */}
                          <div className="h-64 bg-slate-50/50 flex items-center justify-center p-12 overflow-hidden relative">
                             {/* Floating Icons */}
                             <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
                                <button onClick={(e) => handleShare(e, p)} className="w-9 h-9 bg-white text-slate-400 hover:text-blue-600 rounded-full flex items-center justify-center shadow-sm border border-slate-100 transition-all hover:scale-110" title="Compartir">
                                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                                </button>
                                {p.pdf_url && (
                                  <a href={p.pdf_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-9 h-9 bg-white text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center shadow-sm border border-slate-100 transition-all hover:scale-110" title="Ficha Técnica">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                                  </a>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setDetailProduct(p); }} className="w-9 h-9 bg-white text-slate-400 hover:text-green-600 rounded-full flex items-center justify-center shadow-sm border border-slate-100 transition-all hover:scale-110" title="Ver características">
                                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                </button>
                             </div>

                             {p.image_url ? (
                               <img src={p.image_url} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" alt={p.model} />
                             ) : (
                               <div className="text-slate-200 uppercase font-black text-xs italic">S/I</div>
                             )}
                          </div>

                          {/* Info Section */}
                          <div className="p-8 flex flex-col flex-1">
                              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-full self-start mb-4">
                                {p.type?.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest block mb-1">{p.brand}</span>
                              <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-tight mb-6">{p.model}</h3>
                              
                              {/* Characteristics List */}
                              <div className="space-y-2 mb-6 flex-1">
                                 {specs.slice(0, 3).map((s: any, i: number) => (
                                   <div key={i} className="flex items-center gap-2 text-slate-500">
                                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                      <span className="text-[11px] font-medium italic">{s.title}: {s.value || s.description}</span>
                                   </div>
                                 ))}
                                 {remainingCount > 0 && (
                                   <button 
                                    onClick={(e) => { e.stopPropagation(); setDetailProduct(p); }}
                                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline pt-2 block"
                                   >
                                      {tt('more_features', { count: remainingCount })}
                                   </button>
                                 )}
                              </div>

                              {/* Price and Action */}
                              <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-auto">
                                 <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase text-slate-300">{tt('since')}</span>
                                    <span className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(p.price, language)}</span>
                                 </div>
                                 <button 
                                   onClick={() => handleOpenConfigurator(p)}
                                   className="w-12 h-12 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95"
                                 >
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
        /* CONFIGURATOR VIEW */
        <main className="pb-24 pt-24 px-4 md:px-8">
           <PublicQuoteConfigurator 
              product={selectedProduct!}
              tenant={tenant}
              language={language}
              onBack={() => setView('landing')}
              translations={LOCAL_I18N}
           />
        </main>
      )}

      {/* Footer */}
      <footer className="bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white pt-24 pb-12 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20 text-left">
            <div className="space-y-8 text-left">
              <div className="flex items-center gap-3">
                {tenant?.use_logo_on_web && tenant?.logo_url ? (
                  <img src={tenant.logo_url} className="h-10 w-auto object-contain brightness-0 invert" alt={tenant?.name} />
                ) : (
                  <span className="text-2xl font-black italic tracking-tighter uppercase text-white">{tenant?.name}</span>
                )}
              </div>
              <p className="text-slate-400 text-[13px] font-medium leading-relaxed max-w-xs italic">
                {language === 'ca' 
                  ? (tenant?.footer_description_ca || tenant?.footer_description_es || "Som experts en solucions de climatització.")
                  : (tenant?.footer_description_es || tenant?.footer_description_ca || "Expertos en climatización.")
                }
              </p>
            </div>
            <div className="space-y-8 text-left">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Servicios</h4>
              <ul className="space-y-4">
                <li><button onClick={() => setActiveFooterModal('instalacion')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic">{tt('link_install')}</button></li>
                <li><button onClick={() => setActiveFooterModal('mantenimiento')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic">{tt('link_maint')}</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
              © 2025 · {tenant?.name} · {tt('footer_copy')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
