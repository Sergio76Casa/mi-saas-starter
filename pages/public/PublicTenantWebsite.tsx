
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
    all_types: 'Todos'
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
    all_types: 'Tots'
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
  
  // Estados de Filtros
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(5000);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      if (!isConfigured) return;
      
      setIsDataReady(false);
      setIsError(false);
      setRlsError(false);

      try {
        const { data: tData, error: tError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .eq('is_deleted', false)
          .single();

        if (tError || !tData) {
          setIsError(true);
          return;
        }

        setTenant(tData as any);

        if (tData.status === 'active') {
          const { data: pData, error: pError } = await supabase
            .from('products')
            .select('*')
            .eq('tenant_id', tData.id)
            .eq('status', 'active');

          if (pError) {
            if (pError.message.toLowerCase().includes('permission denied') || pError.code === '42501' || pError.message.includes('Unauthorized')) {
              setRlsError(true);
            }
            setDbProducts([]);
          } else if (pData) {
            const normalized = pData.map(p => {
              let price = 0;
              let pricingArr = p.pricing;
              
              if (typeof pricingArr === 'string') {
                try { pricingArr = JSON.parse(pricingArr); } catch(e) { pricingArr = []; }
              }

              if (Array.isArray(pricingArr) && pricingArr.length > 0) {
                const prices = pricingArr.map((v: any) => v.price).filter((p: any) => typeof p === 'number');
                price = prices.length > 0 ? Math.min(...prices) : (p.price || 0);
              } else if (p.price) {
                price = p.price;
              }
              
              return { ...p, price, pricing: pricingArr };
            });
            setDbProducts(normalized);
            
            // Establecer precio máximo inicial basado en el catálogo cargado
            if (normalized.length > 0) {
              const globalMax = Math.max(...normalized.map(p => p.price));
              setMaxPriceFilter(globalMax);
            }
          }
        }
      } catch (err) {
        setIsError(true);
      } finally {
        setIsDataReady(true);
      }
    };
    
    fetchCatalog();
  }, [slug]);

  // Cálculo de marcas disponibles según el tipo seleccionado
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    dbProducts.forEach(p => {
      if (categoryFilter === 'all' || p.type === categoryFilter) {
        if (p.brand) brands.add(p.brand);
      }
    });
    return Array.from(brands).sort();
  }, [dbProducts, categoryFilter]);

  // Precio máximo absoluto para el slider
  const absoluteMaxPrice = useMemo(() => {
    if (dbProducts.length === 0) return 0;
    return Math.max(...dbProducts.map(p => p.price));
  }, [dbProducts]);

  // Grupos de marcas filtrados
  const filteredGroups = useMemo(() => {
    const groups: Record<string, { brand: string, minPrice: number, products: any[] }> = {};
    
    dbProducts.forEach(p => {
      const matchesType = categoryFilter === 'all' || p.type === categoryFilter;
      const matchesBrand = !brandFilter || p.brand === brandFilter;
      const matchesPrice = p.price <= maxPriceFilter;

      if (matchesType && matchesBrand && matchesPrice) {
        if (!groups[p.brand]) {
          groups[p.brand] = { brand: p.brand, minPrice: p.price || 0, products: [] };
        }
        groups[p.brand].products.push(p);
        if (p.price > 0 && (p.price < groups[p.brand].minPrice || groups[p.brand].minPrice === 0)) {
          groups[p.brand].minPrice = p.price;
        }
      }
    });
    return Object.values(groups);
  }, [dbProducts, categoryFilter, brandFilter, maxPriceFilter]);

  const navigateToHome = () => { setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigateToCatalog = () => {
    const el = document.getElementById('catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    else setView('landing');
  };

  const handleAdminClick = () => {
    const adminUrl = `/t/${slug}/dashboard`;
    if (!session) navigate(`/login?returnTo=${encodeURIComponent(adminUrl)}`);
    else navigate(adminUrl);
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

  if (tenant.status === 'inactive') return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
       <div className="max-w-2xl">
         <h2 className="text-5xl font-black text-white uppercase italic mb-8">{tt('inactive_title')}</h2>
         <p className="text-slate-400 mb-10">{tt('inactive_msg')}</p>
         <Link to="/" className="px-10 py-4 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest">{tt('inactive_btn')}</Link>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-600/20 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-white/80 backdrop-blur-md z-[100] border-b border-gray-100">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 md:px-10">
          <button onClick={navigateToHome} className="flex items-center gap-3">
            {tenant.use_logo_on_web && tenant.logo_url ? (
              <img src={tenant.logo_url} className="h-8 md:h-10 w-auto object-contain" alt={tenant.name} />
            ) : (
              <span className="text-lg md:text-xl font-black italic tracking-tighter uppercase text-slate-900">{tenant.name}</span>
            )}
          </button>
          
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={navigateToHome} className={`px-5 py-2.5 rounded-xl text-[13px] font-bold ${view === 'landing' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}>{tt('nav_home')}</button>
            <button onClick={navigateToCatalog} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-500">{tt('nav_products')}</button>
          </div>

          <div className="flex items-center gap-4">
              <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-[11px] font-black uppercase text-slate-600 outline-none cursor-pointer">
                 <option value="es">ES</option>
                 <option value="ca">CA</option>
              </select>
              <button onClick={handleAdminClick} className="w-10 h-10 flex items-center justify-center text-slate-400 bg-white hover:bg-slate-50 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </button>
          </div>
        </div>
      </nav>

      {view === 'landing' ? (
        <main className="pb-20 pt-20">
          <div className="px-4 md:px-8 pt-8">
            <section className="max-w-7xl mx-auto relative rounded-[2rem] h-[400px] md:h-[550px] overflow-hidden flex items-center text-left bg-slate-900 shadow-2xl">
              <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Home" />
              <div className="relative px-8 md:px-20 max-w-4xl z-10">
                <h1 className="text-4xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter mb-6 uppercase italic">
                  {tt('hero_title_1')} <br/>
                  <span className="text-blue-500">{tt('hero_title_2')}</span>
                </h1>
                <p className="text-sm md:text-lg text-white/80 max-w-xl font-medium mb-10 italic">{tt('hero_desc')}</p>
                <div className="flex gap-4">
                  <button onClick={navigateToCatalog} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest">{tt('hero_cta_catalog')}</button>
                </div>
              </div>
            </section>
          </div>

          <section id="catalog" className="py-20 px-4 md:px-8 scroll-mt-24">
             <div className="max-w-7xl mx-auto">
               <div className="text-left mb-6">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2">{tt('catalog_title')}</h2>
                  <p className="text-slate-400 font-medium text-sm mb-10">{tt('catalog_subtitle')}</p>
               </div>
               
               {/* FILTROS INTEGRADOS */}
               <div className="bg-white border border-gray-100 rounded-[2rem] p-6 md:py-7 md:px-9 mb-10 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                  {/* Tipo de equipo */}
                  <div className="md:col-span-6">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300 mb-3">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h7"/></svg>
                      {tt('filter_type')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'all', label: tt('all_types') },
                        { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
                        { id: 'caldera', label: 'Caldera' },
                        { id: 'termo_electrico', label: 'Termo Eléctrico' }
                      ].map(type => (
                        <button
                          key={type.id}
                          onClick={() => { setCategoryFilter(type.id); setBrandFilter(''); }}
                          className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${categoryFilter === type.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 hover:border-blue-200'}`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Marca */}
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-300 mb-3">{tt('filter_brand')}</label>
                    <div className="relative">
                      <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="w-full h-10 px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                      >
                        <option value="">{tt('all_brands')}</option>
                        {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Precio Máximo */}
                  <div className="md:col-span-3">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">{tt('filter_price')}</label>
                      <span className="text-[13px] font-black text-blue-600">{maxPriceFilter} €</span>
                    </div>
                    <div className="space-y-4">
                      <input
                        type="range"
                        min="0"
                        max={absoluteMaxPrice || 5000}
                        step="10"
                        value={maxPriceFilter}
                        onChange={(e) => setMaxPriceFilter(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] font-black text-slate-200 uppercase">
                        <span>0 €</span>
                        <span>{absoluteMaxPrice || 0} €</span>
                      </div>
                    </div>
                  </div>
               </div>

               {rlsError ? (
                 <div className="py-20 text-center border-2 border-dashed border-red-200 bg-red-50/50 rounded-[2rem] px-8">
                   <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0-6V9m0 12a9 9 0 110-18 9 9 0 010 18z"/></svg>
                   </div>
                   <p className="text-red-700 font-black uppercase italic text-sm mb-2">Error de Permisos en Base de Datos (401)</p>
                   <p className="text-[11px] text-red-600/70 max-w-md mx-auto leading-relaxed">
                     Supabase ha denegado el acceso a la tabla 'products'. <br/>
                     <strong>Solución:</strong> Ve al SQL Editor de Supabase y ejecuta: <br/>
                     <code className="bg-red-100 px-2 py-1 rounded mt-2 block font-mono text-[10px]">GRANT SELECT ON public.products TO anon;</code>
                   </p>
                 </div>
               ) : filteredGroups.length === 0 ? (
                 <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                   <p className="text-slate-300 font-black uppercase italic text-sm">{tt('no_products_filter')}</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                    {filteredGroups.map(group => (
                      <div key={group.brand} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col text-left hover:shadow-xl transition-all">
                         <div className="h-48 bg-slate-50 rounded-[1.5rem] mb-6 flex items-center justify-center overflow-hidden">
                            {group.products[0]?.image_url ? (
                              <img src={group.products[0].image_url} className="w-full h-full object-contain p-4" alt={group.brand} />
                            ) : (
                              <div className="text-blue-200 uppercase font-black text-xs italic">IMG</div>
                            )}
                         </div>
                         <h3 className="text-3xl font-black mb-2 uppercase italic tracking-tighter">{group.brand}</h3>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Equipos disponibles: {group.products.length}</p>
                         <div className="flex items-center justify-between border-t border-slate-50 pt-6 mt-auto">
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">
                              {group.minPrice > 0 ? formatCurrency(group.minPrice, language) : 'Consultar'}
                            </p>
                            <button onClick={() => { setSelectedProduct(group.products[0]); setView('wizard'); }} className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
             </div>
          </section>
        </main>
      ) : (
        <div className="max-w-5xl mx-auto py-24 px-4 text-left animate-in slide-in-from-bottom-8">
           <div className="bg-white p-6 md:p-20 rounded-[2rem] border border-slate-100 shadow-2xl">
              <h2 className="text-3xl font-black tracking-tighter mb-8 italic uppercase">{tt('wizard_models_available')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dbProducts.filter(p => !selectedProduct || p.brand === selectedProduct.brand).map(p => (
                    <button key={p.id} onClick={() => setSelectedProduct(p)} className={`p-6 rounded-[2rem] border-2 text-left transition-all ${selectedProduct?.id === p.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-white'}`}>
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
