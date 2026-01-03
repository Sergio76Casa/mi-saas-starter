
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant } from '../../types';
import { formatCurrency } from '../../i18n';
import { useApp } from '../../AppProvider';
import { PDF_KITS, PDF_EXTRAS } from '../../data/pdfCatalog';
import { Input } from '../../components/common/Input';
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
    nav_admin: 'Admin',
    nav_admin_btn: 'ADMIN',
    error_404_msg: 'Error: Empresa no encontrada',
    error_404_btn: 'Volver',
    inactive_title: 'Servicio Temporalmente Suspendido',
    inactive_msg: 'Este espacio digital se encuentra en mantenimiento o ha sido desactivado por el administrador.',
    inactive_contact: 'Si necesitas asistencia inmediata o eres el propietario de esta cuenta, por favor contacta con nuestro equipo de soporte técnico.',
    inactive_btn: 'Volver a la plataforma principal',
    hero_badge: 'TECNOLOGÍA INVERTER 2024',
    hero_title_1: 'Clima perfecto,',
    hero_title_2: 'Ahorro real.',
    hero_desc: 'Transforma tu hogar con nuestras soluciones de climatización de alta eficiencia. Instalación profesional, financiación a medida y las mejores marcas del mercado.',
    hero_cta_catalog: 'Ver Catálogo',
    hero_cta_wizard: 'Pedir Presupuesto',
    catalog_title: 'Catálogo Destacado',
    catalog_subtitle: 'Soluciones integrales de climatización profesional.',
    filter_all_brands: 'Todas las marcas',
    no_products_filter: 'No hay productos disponibles en este catálogo',
    wizard_models_available: 'Models disponibles',
    cat_all: 'Todas',
    footer_copy: 'EcoQuote AI · Smart Installation Solution'
  },
  ca: {
    nav_home: 'Inici',
    nav_products: 'Productes',
    nav_contact: 'Contacte',
    nav_admin: 'Admin',
    nav_admin_btn: 'ADMIN',
    error_404_msg: 'Error: Empresa no trobada',
    error_404_btn: 'Tornar',
    inactive_title: 'Servei Temporalment Suspès',
    inactive_msg: 'Aquest espai digital es troba en manteniment o ha estat desactivat per l’administrador.',
    inactive_contact: 'Si necessites assistència immediata o ets el propietari d’aquest compte, si us plau contacta amb el nostre equip de suport tècnic.',
    inactive_btn: 'Tornar a la plataforma principal',
    hero_badge: 'TECNOLOGIA INVERTER 2024',
    hero_title_1: 'Clima perfecte,',
    hero_title_2: 'Estalvi real.',
    hero_desc: 'Transforma la teva llar amb les nostres solucions de climatització d’alta eficiència. Instal·lació profesional, finançament a mida i les millors marques del mercat.',
    hero_cta_catalog: 'Veure Catàleg',
    hero_cta_wizard: 'Demanar Pressupost',
    catalog_title: 'Catàleg Destacat',
    catalog_subtitle: 'Solucions integrals de climatització profesional.',
    filter_all_brands: 'Totes les marques',
    no_products_filter: 'No hi ha productes disponibles en aquest catàleg',
    wizard_models_available: 'Models disponibles',
    cat_all: 'Totes',
    footer_copy: 'EcoQuote AI · Smart Installation Solution'
  }
} as const;

export const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { dbHealthy, language, setLanguage, session, memberships, profile } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [dbProducts, setDbProducts] = useState<PublicCatalogResponse['products']>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const tt = (key: keyof typeof LOCAL_I18N['es']) => LOCAL_I18N[language]?.[key] ?? LOCAL_I18N.es[key];

  const [view, setView] = useState<'landing' | 'wizard'>('landing');
  const [step, setStep] = useState(1);
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState(10000); 

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      if (!isConfigured || dbHealthy === null) return;
      
      setIsDataReady(false);
      setIsError(false);

      try {
        console.log(`Iniciando carga pública para slug: ${slug}`);
        
        // Intentamos obtener el Tenant primero
        const { data: tData, error: tError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .eq('is_deleted', false)
          .single();

        if (tError || !tData) {
          console.error("Empresa no encontrada o error de RLS:", tError?.message);
          setIsError(true);
          return;
        }

        setTenant(tData as any);

        // Si la empresa es activa, cargamos sus productos
        if (tData.status === 'active') {
          console.log(`Cargando productos para tenant_id: ${tData.id}`);
          const { data: pData, error: pError } = await supabase
            .from('products')
            .select('*')
            .eq('tenant_id', tData.id)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .eq('status', 'active')
            .order('brand', { ascending: true });

          if (pError) {
            console.error("Error cargando productos (posible RLS):", pError.message);
            setDbProducts([]);
          } else {
            // Normalización: Asegurar que el precio se extraiga del campo pricing si la columna price es 0 o null
            const normalized = (pData || []).map(p => {
              let price = p.price || 0;
              let pricingArr = p.pricing;
              
              // Si pricing viene como string, lo parseamos
              if (typeof pricingArr === 'string') {
                try { pricingArr = JSON.parse(pricingArr); } catch(e) { pricingArr = []; }
              }

              if ((!price || price === 0) && Array.isArray(pricingArr) && pricingArr.length > 0) {
                price = pricingArr[0].price || 0;
              }
              return { ...p, price, pricing: pricingArr };
            });
            
            console.log(`Se cargaron ${normalized.length} productos correctamente.`);
            setDbProducts(normalized);
          }
        }
      } catch (err) {
        console.error("Error crítico en fetchCatalog:", err);
        setIsError(true);
      } finally {
        setIsDataReady(true);
      }
    };
    
    fetchCatalog();
  }, [slug, dbHealthy]);

  const brandGroups = useMemo(() => {
    const groups: Record<string, { brand: string, minPrice: number, products: any[] }> = {};
    
    dbProducts.forEach(p => {
      const matchesCategory = categoryFilter === 'all' || p.type === categoryFilter;
      const matchesPrice = (p.price || 0) <= maxPrice;
      const matchesBrand = !brandFilter || p.brand === brandFilter;

      if (matchesCategory && matchesPrice && matchesBrand) {
        if (!groups[p.brand]) {
          groups[p.brand] = { 
            brand: p.brand, 
            minPrice: p.price || 0, 
            products: []
          };
        }
        groups[p.brand].products.push(p);
        if (p.price > 0 && (p.price < groups[p.brand].minPrice || groups[p.brand].minPrice === 0)) {
          groups[p.brand].minPrice = p.price;
        }
      }
    });
    return Object.values(groups);
  }, [dbProducts, brandFilter, maxPrice, categoryFilter]);

  const navigateToHome = () => { setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigateToCatalog = () => {
    const scrollToCatalog = () => { const el = document.getElementById('catalog'); if (el) el.scrollIntoView({ behavior: 'smooth' }); };
    if (view !== 'landing') { setView('landing'); setTimeout(scrollToCatalog, 100); } 
    else scrollToCatalog();
  };

  const handleAdminClick = () => {
    const adminUrl = `/t/${slug}/dashboard`;
    if (!session) navigate(`/login?returnTo=${encodeURIComponent(adminUrl)}`);
    else {
      const isMember = memberships.some(m => m.tenant?.slug === slug);
      if (isMember || profile?.is_superadmin) navigate(adminUrl);
      else alert("No tienes permisos para esta empresa.");
    }
  };

  if (!isDataReady) return <LoadingSpinner />;
  
  if (isError || !tenant) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center animate-in fade-in duration-500">
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
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-600/20 overflow-x-hidden animate-in fade-in duration-700">
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
            <button onClick={navigateToHome} className={`px-5 py-2.5 rounded-xl text-[13px] font-bold ${view === 'landing' ? 'bg-[#f0f5ff] text-[#2563eb]' : 'text-slate-500'}`}>{tt('nav_home')}</button>
            <button onClick={navigateToCatalog} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-500">{tt('nav_products')}</button>
            <button onClick={() => setIsContactModalOpen(true)} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-500">{tt('nav_contact')}</button>
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
              <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Modern Home" />
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
               <div className="text-left mb-12">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic mb-2">{tt('catalog_title')}</h2>
                  <p className="text-slate-400 font-bold text-xs italic">{tt('catalog_subtitle')}</p>
               </div>
               
               {brandGroups.length === 0 ? (
                 <div className="py-20 text-center text-slate-300 font-black uppercase italic">{tt('no_products_filter')}</div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                    {brandGroups.map(group => (
                      <div key={group.brand} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col text-left hover:shadow-xl transition-all">
                         <div className="h-48 bg-slate-50 rounded-[1.5rem] mb-6 flex items-center justify-center overflow-hidden">
                            {group.products[0]?.image_url ? (
                              <img src={group.products[0].image_url} className="w-full h-full object-contain p-4" alt={group.brand} />
                            ) : (
                              <div className="text-blue-200 uppercase font-black text-xs italic">IMG</div>
                            )}
                         </div>
                         <h3 className="text-3xl font-black mb-6 uppercase italic tracking-tighter">{group.brand}</h3>
                         <div className="flex items-center justify-between border-t border-slate-50 pt-6 mt-auto">
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">
                              {group.minPrice > 0 ? formatCurrency(group.minPrice, language) : '—'}
                            </p>
                            <button onClick={() => { setSelectedProduct(group.products[0]); setView('wizard'); setStep(1); }} className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-blue-700">
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
                <button onClick={() => setView('landing')} className="px-10 py-5 border-2 border-slate-100 rounded-xl font-black uppercase text-[10px] text-slate-400">Volver</button>
                <button onClick={() => setView('landing')} className="flex-1 py-5 bg-slate-900 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl">Confirmar</button>
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
