
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase, isConfigured, SUPABASE_URL, saveManualConfig, clearManualConfig } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, QuoteItem, Language, PlatformContent } from './types';
import { translations, formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';

// --- PDF Specific Data ---
const PDF_PRODUCTS = [
  { id: 'cf09', name: 'COMFEE CF 09', price: 829.00, desc: 'Eficiencia A++ en refrigeración, ideal para estancias pequeñas.' },
  { id: 'cf12', name: 'COMFEE CF 12', price: 889.00, desc: 'Clasificación A++, perfecto equilibrio entre potencia y consumo.' },
  { id: 'cf18', name: 'COMFEE CF 18', price: 1139.00, desc: 'Alta capacidad de refrigeración (4601 kcal/h) para grandes espacios.' },
  { id: 'cf2x1', name: 'COMFEE CF 2X1', price: 1489.00, desc: 'Sistema multi-split para climatizar dos estancias con una unidad exterior.' },
];

const PDF_KITS = [
  { id: 'k1', name: 'KIT INSTALACIÓN ITE-3', price: 149.00 },
  { id: 'k2', name: 'KIT INSTALACIÓN ITE-3 2X1', price: 249.00 },
];

const PDF_EXTRAS = [
  { id: 'e1', name: 'METRO LINIAL (3/8)', price: 90.00 },
  { id: 'e2', name: 'METRO LINIAL (1/2)', price: 100.00 },
  { id: 'e4', name: 'MANGUERA 3x2,5mm', price: 10.00 },
  { id: 'e6', name: 'TUBERÍA 1/4 - 3/8', price: 35.00 },
  { id: 'e9', name: 'CANAL 60x60', price: 35.00 },
  { id: 'e12', name: 'TRABAJOS EN ALTURA', price: 80.00 },
  { id: 'e13', name: 'BOMBA DE CONDENSADOS', price: 180.00 },
];

const FINANCING_COEFFICIENTS: Record<number, number> = {
  12: 0.087,
  24: 0.045104,
  36: 0.032206,
  48: 0.0253,
  60: 0.021183,
};

// --- Context & Hooks ---

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  isDemoMode: boolean;
  dbHealthy: boolean | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  enterDemoMode: (asAdmin?: boolean) => void;
  t: (key: keyof typeof translations['es']) => string;
}

const AppContext = createContext<AppContextType | null>(null);

const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

// --- Common Components ---

const LoadingSpinner = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
    <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-500 border-t-transparent shadow-xl"></div>
    <p className="mt-6 text-gray-500 font-black uppercase tracking-widest text-[10px] animate-pulse italic">Conectando...</p>
  </div>
);

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200/50">
      <button onClick={() => setLanguage('es')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'es' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>ES</button>
      <button onClick={() => setLanguage('ca')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'ca' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>CA</button>
    </div>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="mb-4 text-left">
    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">{label}</label>
    <input className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm bg-gray-50/50" {...props} />
  </div>
);

const SuperAdminFloatingBar = () => {
  const { profile } = useApp();
  if (!profile?.is_superadmin) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <Link to="/admin/dashboard" className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-full shadow-2xl border border-white/10 hover:scale-105 transition-all group">
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Panel del Sistema Central</span>
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </Link>
    </div>
  );
};

// --- Public Tenant Website (Web Pública del Cliente) ---

const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { dbHealthy, t, session, memberships, profile, language } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'config' | 'customer'>('config');

  // Configuration State
  const [selectedModel, setSelectedModel] = useState(PDF_PRODUCTS[0]);
  const [selectedKit, setSelectedKit] = useState(PDF_KITS[0]);
  const [extraQtys, setExtraQtys] = useState<Record<string, number>>({});
  const [financingMonths, setFinancingMonths] = useState(12);

  // Customer Form State
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    population: ''
  });

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) sessionStorage.setItem(`atribucion_${slug}`, ref);
  }, [searchParams, slug]);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!isConfigured || !dbHealthy) { setLoading(false); return; }
      const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (data) setTenant(data);
      setLoading(false);
    };
    fetchTenant();
  }, [slug, dbHealthy]);

  const currentTotal = useMemo(() => {
    const extrasTotal = PDF_EXTRAS.reduce((sum, extra) => sum + (extra.price * (extraQtys[extra.id] || 0)), 0);
    return selectedModel.price + selectedKit.price + extrasTotal;
  }, [selectedModel, selectedKit, extraQtys]);

  const monthlyFee = useMemo(() => {
    return currentTotal * FINANCING_COEFFICIENTS[financingMonths];
  }, [currentTotal, financingMonths]);

  const handleExtraQty = (id: string, delta: number) => {
    setExtraQtys(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const handleFinish = async () => {
    // Aquí iría la lógica de guardado real del lead/presupuesto
    alert("Presupuesto enviado. Nos pondremos en contacto pronto.");
    setIsModalOpen(false);
    setModalStep('config');
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-12 text-center">
       <div className="animate-in fade-in zoom-in duration-500">
         <h1 className="text-9xl font-black text-gray-100 mb-4">404</h1>
         <p className="text-gray-400 font-black uppercase tracking-widest text-xs italic">Empresa no encontrada</p>
         <Link to="/" className="mt-10 inline-block text-brand-600 font-black uppercase text-[10px] underline tracking-widest">Volver al inicio</Link>
       </div>
    </div>
  );

  const lowestPrice = Math.min(...PDF_PRODUCTS.map(p => p.price));
  const hasAdminAccess = session && (memberships.some(m => m.tenant?.slug === slug) || profile?.is_superadmin);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-brand-500 selection:text-white animate-in fade-in duration-1000">
      <nav className="flex items-center justify-between px-10 py-8 sticky top-0 bg-white/80 backdrop-blur-xl z-50 border-b border-gray-50">
        <div className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase">{tenant.name}</div>
        <div className="flex items-center gap-10">
           <a href="#catalog" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">Catálogo</a>
           <LanguageSwitcher />
           {hasAdminAccess ? (
             <Link to={`/t/${slug}/dashboard`} className="px-6 py-3 bg-brand-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
                {t('view_admin')}
             </Link>
           ) : (
             <Link to="/login" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">
                {t('login_nav')}
             </Link>
           )}
           <a href="#contact" className="px-8 py-3 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">{t('contact_section')}</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10">
        <section className="py-40 text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
          <div className="inline-block px-6 py-2 bg-brand-50 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-10 border border-brand-100 shadow-sm">✨ Partner Oficial Comfee</div>
          <h1 className="text-[7rem] md:text-[9rem] font-black text-gray-900 tracking-tighter leading-[0.8] mb-12 uppercase italic">{tenant.name}</h1>
          <p className="text-2xl text-gray-400 max-w-3xl mx-auto font-medium leading-relaxed italic opacity-80">Climatización inteligente de alta eficiencia para tu hogar.</p>
        </section>

        {/* Catalog Grid Section */}
        <section id="catalog" className="py-32 scroll-mt-24">
          <div className="mb-20">
             <h2 className="text-4xl font-black text-gray-900 tracking-tight uppercase mb-2 italic">Nuestra Gama</h2>
             <div className="w-20 h-1.5 bg-brand-500 rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-12">
            {/* Unique grouped card for Comfee Gama */}
            <div className="bg-gray-50 border border-gray-100 rounded-[4rem] p-16 shadow-sm hover:shadow-2xl transition-all flex flex-col lg:flex-row gap-12 group">
              <div className="flex-1 space-y-8">
                <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Marca: COMFEE</div>
                <h3 className="text-6xl font-black text-gray-900 tracking-tighter italic uppercase leading-none">Serie Split CF</h3>
                <ul className="space-y-4">
                  {[
                    "Eficiencia Energética A++",
                    "Tecnología Inverter Silenciosa",
                    "Gas R32 Ecológico",
                    "Control Smart WiFi"
                  ].map(spec => (
                    <li key={spec} className="flex items-center gap-3 text-sm text-gray-500 font-bold italic">
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full"></span> {spec}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:w-72 flex flex-col justify-between pt-8 border-t lg:border-t-0 lg:border-l border-gray-200 lg:pl-12">
                <div className="mb-10 lg:mb-0">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Desde</span>
                  <div className="text-6xl font-black text-gray-900 tracking-tighter italic">{formatCurrency(lowestPrice, language)}</div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-7 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] hover:bg-brand-600 transition-all shadow-2xl active:scale-95 flex justify-between px-10 items-center group/btn"
                >
                  Configurar
                  <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-40">
           <div className="bg-gray-900 rounded-[5rem] p-32 text-center text-white relative overflow-hidden shadow-2xl group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 blur-[120px] rounded-full group-hover:bg-brand-500/20 transition-all duration-1000"></div>
              <h2 className="text-7xl font-black tracking-tighter mb-10 italic uppercase">¿Necesitas ayuda?</h2>
              <p className="text-slate-400 text-xl mb-16 max-w-xl mx-auto font-light leading-relaxed">Ponte en contacto con nuestros técnicos expertos hoy mismo.</p>
              <button className="px-16 py-7 bg-white text-gray-900 rounded-[3rem] font-black uppercase tracking-[0.15em] text-xs shadow-2xl hover:bg-brand-500 hover:text-white transition-all transform hover:scale-105">Llamar Ahora</button>
           </div>
        </section>
      </main>

      {/* Configuration Multi-step Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row border border-white/20">
            {/* Modal Body: Left Side */}
            <div className="flex-1 overflow-y-auto p-12 lg:p-20 bg-white scrollbar-hide">
              {modalStep === 'config' ? (
                <div className="space-y-16">
                  <header>
                    <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mb-4">Configuración del Equipo</div>
                    <h2 className="text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Personaliza tu confort</h2>
                  </header>

                  {/* 1. Model selection */}
                  <section>
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-6 block tracking-widest italic">1. Selecciona el modelo</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PDF_PRODUCTS.map(m => (
                        <button 
                          key={m.id} 
                          onClick={() => setSelectedModel(m)}
                          className={`p-8 rounded-[2rem] border-2 text-left transition-all ${selectedModel.id === m.id ? 'border-brand-500 bg-brand-50/50 shadow-xl' : 'border-gray-50 hover:border-gray-100'}`}
                        >
                          <div className="text-sm font-black text-gray-900 uppercase">{m.name}</div>
                          <div className="text-2xl font-black text-brand-600 mt-2 tracking-tighter">{formatCurrency(m.price, language)}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* 2. Installation Kit */}
                  <section>
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-6 block tracking-widest italic">2. Kit de instalación</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PDF_KITS.map(k => (
                        <button 
                          key={k.id} 
                          onClick={() => setSelectedKit(k)}
                          className={`p-8 rounded-[2rem] border-2 text-left transition-all ${selectedKit.id === k.id ? 'border-brand-500 bg-brand-50/50 shadow-xl' : 'border-gray-50 hover:border-gray-100'}`}
                        >
                          <div className="text-xs font-black text-gray-900 uppercase">{k.name}</div>
                          <div className="text-lg font-bold text-gray-400 mt-2">+{formatCurrency(k.price, language)}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* 3. Extras with quantities */}
                  <section>
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-6 block tracking-widest italic">3. Extras adicionales</label>
                    <div className="space-y-3">
                      {PDF_EXTRAS.map(extra => (
                        <div key={extra.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-gray-100 transition-all">
                          <div>
                            <div className="text-[12px] font-bold text-gray-800 italic uppercase">{extra.name}</div>
                            <div className="text-[10px] font-black text-brand-600 mt-1">{formatCurrency(extra.price, language)} / ud.</div>
                          </div>
                          <div className="flex items-center gap-6 bg-white rounded-2xl p-2 shadow-sm">
                            <button 
                              onClick={() => handleExtraQty(extra.id, -1)}
                              className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-brand-600 font-black text-xl"
                            >－</button>
                            <span className="w-6 text-center text-sm font-black text-gray-900">{extraQtys[extra.id] || 0}</span>
                            <button 
                              onClick={() => handleExtraQty(extra.id, 1)}
                              className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-brand-600 font-black text-xl"
                            >＋</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="space-y-16 animate-in slide-in-from-right duration-500">
                  <header>
                    <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mb-4">Paso Final</div>
                    <h2 className="text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Tus datos de contacto</h2>
                  </header>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                      <Input label="Nombre completo" placeholder="Ej: Juan Pérez" value={customerData.name} onChange={(e:any) => setCustomerData({...customerData, name: e.target.value})} />
                    </div>
                    <Input label="Email" type="email" placeholder="juan@ejemplo.com" value={customerData.email} onChange={(e:any) => setCustomerData({...customerData, email: e.target.value})} />
                    <Input label="Teléfono" type="tel" placeholder="600 000 000" value={customerData.phone} onChange={(e:any) => setCustomerData({...customerData, phone: e.target.value})} />
                    <div className="md:col-span-2">
                      <Input label="Dirección de instalación" placeholder="Calle Ejemplo 123" value={customerData.address} onChange={(e:any) => setCustomerData({...customerData, address: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                      <Input label="Población" placeholder="Barcelona" value={customerData.population} onChange={(e:any) => setCustomerData({...customerData, population: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Calculator: Right Side */}
            <div className="w-full lg:w-[450px] bg-slate-900 text-white p-12 lg:p-16 flex flex-col justify-between border-l border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 blur-[100px] rounded-full"></div>
              
              <div className="relative z-10">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-400 mb-12">Resumen</h4>
                
                <div className="space-y-6 mb-12">
                   <div className="flex justify-between items-start">
                     <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Modelo</span>
                        <span className="text-sm font-bold text-slate-200">{selectedModel.name}</span>
                     </div>
                     <span className="font-black text-brand-500">{formatCurrency(selectedModel.price, language)}</span>
                   </div>
                   <div className="flex justify-between items-start">
                     <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Instalación</span>
                        <span className="text-sm font-bold text-slate-200">{selectedKit.name}</span>
                     </div>
                     <span className="font-black text-brand-500">{formatCurrency(selectedKit.price, language)}</span>
                   </div>

                   {/* List extra summaries if qty > 0 */}
                   {PDF_EXTRAS.filter(e => extraQtys[e.id]).map(e => (
                     <div key={e.id} className="flex justify-between items-start text-[11px] font-bold text-slate-400 animate-in fade-in">
                       <span>{e.name} (x{extraQtys[e.id]})</span>
                       <span>{formatCurrency(e.price * extraQtys[e.id], language)}</span>
                     </div>
                   ))}
                </div>

                <div className="pt-10 border-t border-white/10">
                   <label className="text-[10px] font-black uppercase text-brand-400 tracking-[0.2em] block mb-6 italic">Opciones de Financiación</label>
                   <div className="grid grid-cols-5 gap-2 mb-8">
                     {[12, 24, 36, 48, 60].map(m => (
                       <button 
                        key={m} 
                        onClick={() => setFinancingMonths(m)}
                        className={`py-4 rounded-xl text-[10px] font-black border transition-all ${financingMonths === m ? 'bg-brand-500 border-brand-500 text-white shadow-xl shadow-brand-500/30' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                       >
                         {m}m
                       </button>
                     ))}
                   </div>
                   <div className="bg-white/5 p-10 rounded-[2.5rem] text-center border border-white/5 relative group">
                      <div className="absolute inset-0 bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block mb-3 tracking-[0.2em]">Cuota Mensual Est.</span>
                      <span className="text-5xl font-black text-brand-500 tracking-tighter italic leading-none">{formatCurrency(monthlyFee, language)}</span>
                   </div>
                </div>
              </div>

              <div className="relative z-10 pt-12 border-t border-white/20">
                 <div className="flex justify-between items-center mb-10">
                   <span className="text-xl font-black italic tracking-tighter text-slate-400 uppercase">Total Presupuesto</span>
                   <span className="text-5xl font-black text-white tracking-tighter italic">{formatCurrency(currentTotal, language)}</span>
                 </div>
                 
                 {modalStep === 'config' ? (
                   <button 
                    onClick={() => setModalStep('customer')}
                    className="w-full py-8 bg-brand-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-brand-500 transition-all active:scale-95 flex justify-between px-12 items-center"
                   >
                     Siguiente Paso
                     <span className="text-lg">→</span>
                   </button>
                 ) : (
                   <div className="flex gap-4">
                      <button 
                        onClick={() => setModalStep('config')}
                        className="flex-1 py-8 bg-white/5 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/10 transition-all"
                      >Atrás</button>
                      <button 
                        onClick={handleFinish}
                        className="flex-[2] py-8 bg-brand-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-brand-500 transition-all active:scale-95"
                      >Generar Presupuesto</button>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="py-24 border-t border-gray-50 text-center bg-gray-50/30">
         <div className="text-2xl font-black text-gray-200 mb-6 tracking-tighter italic uppercase">{tenant.name}</div>
         <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">© 2024 · {tenant.name} · Climatización Profesional</div>
      </footer>
    </div>
  );
};

const QuoteEditor = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, session, language } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Quote>>({
    status: 'draft',
    client_name: '',
    client_dni: '',
    client_address: '',
    client_population: '',
    client_email: '',
    client_phone: '',
    maintenance_no: '',
    total_amount: 0,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [],
    financing_months: 12
  });

  const addItem = (description: string, price: number) => {
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      quote_id: id || 'new',
      description,
      quantity: 1,
      unit_price: price,
      total: price
    };
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
      if (data) setCustomers(data);
    };
    fetchCustomers();
    
    // Check for pre-selected product from URL
    const productId = searchParams.get('productId');
    if (productId && id === 'new') {
      const product = PDF_PRODUCTS.find(p => p.id === productId);
      if (product) {
        addItem(product.name, product.price);
      }
    }
  }, [tenant.id, id, searchParams]);

  const subtotal = useMemo(() => {
    return (formData.items || []).reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  }, [formData.items]);

  const monthlyFee = useMemo(() => {
    if (!formData.financing_months) return 0;
    const coeff = FINANCING_COEFFICIENTS[formData.financing_months];
    return subtotal * coeff;
  }, [subtotal, formData.financing_months]);

  const updateItemQty = (id: string, qty: number) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(item => item.id === id ? { ...item, quantity: qty, total: qty * item.unit_price } : item)
    }));
  };

  const removeItem = (id: string) => {
    setFormData(prev => ({ ...prev, items: (prev.items || []).filter(item => item.id !== id) }));
  };

  const handleCustomerSelect = (custId: string) => {
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setFormData(prev => ({
        ...prev,
        customer_id: custId,
        client_name: cust.name,
        client_email: cust.email,
        client_phone: cust.phone || '',
        client_dni: cust.dni || '',
        client_address: cust.address || '',
        client_population: cust.population || ''
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    // Dummy save
    setTimeout(() => {
      setLoading(false);
      navigate(`/t/${tenant.slug}/quotes`);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-700 pb-24">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-4xl font-black text-gray-900 tracking-tighter">{t('new_quote')}</h3>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mt-2">Ref: {new Date().getFullYear()}-XXXX</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate(-1)} className="px-6 py-3 text-gray-400 text-[10px] font-black uppercase">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="px-10 py-4 bg-brand-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">
            {loading ? 'Guardando...' : 'Finalizar y Congelar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-10 rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span> Datos del Cliente
            </h4>
            <div className="mb-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Seleccionar de Base de Datos</label>
              <select onChange={(e) => handleCustomerSelect(e.target.value)} className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                <option value="">-- Nuevo Cliente --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Nombre" value={formData.client_name} onChange={(e:any) => setFormData({...formData, client_name: e.target.value})} />
              <Input label={t('dni')} value={formData.client_dni} onChange={(e:any) => setFormData({...formData, client_dni: e.target.value})} />
              <div className="md:col-span-2">
                <Input label={t('address')} value={formData.client_address} onChange={(e:any) => setFormData({...formData, client_address: e.target.value})} />
              </div>
              <Input label={t('population')} value={formData.client_population} onChange={(e:any) => setFormData({...formData, client_population: e.target.value})} />
              <Input label={t('maintenance_no')} value={formData.maintenance_no} onChange={(e:any) => setFormData({...formData, maintenance_no: e.target.value})} />
            </div>
          </section>

          <section className="bg-white p-10 rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span> Conceptos
            </h4>
            <table className="w-full text-left mb-8">
              <thead className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50">
                <tr>
                  <th className="py-4">Descripción</th>
                  <th className="py-4 text-center">Cant.</th>
                  <th className="py-4 text-right">Precio</th>
                  <th className="py-4 text-right">Total</th>
                  <th className="py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(formData.items || []).map(item => (
                  <tr key={item.id} className="text-sm">
                    <td className="py-4 font-bold text-gray-700">{item.description}</td>
                    <td className="py-4"><input type="number" value={item.quantity} onChange={(e) => updateItemQty(item.id, parseInt(e.target.value))} className="w-16 mx-auto block bg-gray-50 border border-gray-100 rounded-lg py-1 px-2 text-center" /></td>
                    <td className="py-4 text-right text-gray-400">{formatCurrency(item.unit_price, language)}</td>
                    <td className="py-4 text-right font-black text-gray-900">{formatCurrency(item.total, language)}</td>
                    <td className="py-4 text-right"><button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 px-2">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {PDF_PRODUCTS.map(p => <button key={p.name} onClick={() => addItem(p.name, p.price)} className="px-4 py-2 bg-gray-50 hover:bg-brand-50 hover:text-brand-600 border border-gray-100 rounded-xl text-[10px] font-black transition-all">{p.name}</button>)}
              </div>
              <button onClick={() => addItem('Concepto Manual', 0)} className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-brand-500 hover:text-brand-600 transition-all">+ Añadir Concepto Personalizado</button>
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <div className="bg-slate-900 text-white p-10 rounded-[2.8rem] shadow-2xl relative overflow-hidden sticky top-32">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 mb-8">Resumen</h4>
            <div className="space-y-4 mb-10">
              <div className="flex justify-between text-sm opacity-60"><span>Subtotal</span><span>{formatCurrency(subtotal, language)}</span></div>
              <div className="flex justify-between text-4xl font-black pt-4 border-t border-white/10"><span>TOTAL</span><span>{formatCurrency(subtotal, language)}</span></div>
            </div>
            <div className="pt-8 border-t border-white/10">
              <label className="text-[9px] font-black uppercase tracking-widest text-brand-400 block mb-4">Financiación</label>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[12, 24, 36, 48, 60].map(m => (
                  <button key={m} onClick={() => setFormData({...formData, financing_months: m})} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${formData.financing_months === m ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>{m}m</button>
                ))}
              </div>
              <div className="bg-white/5 p-6 rounded-2xl text-center">
                 <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Cuota Mensual</div>
                 <div className="text-2xl font-black text-brand-500">{formatCurrency(monthlyFee, language)}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const Customers = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, session } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', dni: '', address: '', population: '' });

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    if (data) setCustomers(data);
  };

  useEffect(() => { fetchCustomers(); }, [tenant.id]);

  const handleCreate = async () => {
    const ref = sessionStorage.getItem(`atribucion_${tenant.slug}`);
    const { error } = await supabase.from('customers').insert([{ ...newCust, tenant_id: tenant.id, created_by: session?.user.id, referred_by: ref || null }]);
    if (error) alert(error.message);
    else { setIsCreating(false); setNewCust({ name: '', email: '', phone: '', dni: '', address: '', population: '' }); fetchCustomers(); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{t('customers')}</h3>
        <button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Nuevo Cliente</button>
      </div>
      {isCreating && (
        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Input label="Nombre" value={newCust.name} onChange={(e:any) => setNewCust({...newCust, name: e.target.value})} />
             <Input label="Email" value={newCust.email} onChange={(e:any) => setNewCust({...newCust, email: e.target.value})} />
             <Input label="Teléfono" value={newCust.phone} onChange={(e:any) => setNewCust({...newCust, phone: e.target.value})} />
           </div>
           <div className="flex gap-4"><button onClick={handleCreate} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl">Guardar</button></div>
        </div>
      )}
      <div className="bg-white border border-gray-100 rounded-[2.8rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Cliente</th><th className="px-10 py-6">Contacto</th><th className="px-10 py-6 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-10 py-6"><div className="font-black text-gray-900">{c.name}</div></td>
                <td className="px-10 py-6 text-sm text-gray-500">{c.email}</td>
                <td className="px-10 py-6 text-right"><button className="text-brand-600 font-black text-[9px] uppercase tracking-widest">Ver Ficha</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Quotes = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const fetchQuotes = async () => {
    const { data } = await supabase.from('quotes').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    if (data) setQuotes(data as any);
  };

  useEffect(() => { fetchQuotes(); }, [tenant.id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{t('quotes')}</h3>
        <button onClick={() => navigate(`/t/${tenant.slug}/quotes/new`)} className="px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Crear Presupuesto</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-[2.8rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Ref</th><th className="px-10 py-6">Cliente</th><th className="px-10 py-6 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quotes.map(q => (
              <tr key={q.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/t/${tenant.slug}/quotes/${q.id}`)}>
                <td className="px-10 py-6 font-black text-gray-900">{q.quote_no || `#Q-${q.id.slice(0,4)}`}</td>
                <td className="px-10 py-6 font-bold text-gray-600">{q.client_name || q.customer?.name || 'Cliente'}</td>
                <td className="px-10 py-6 text-right font-black text-brand-600">{formatCurrency(q.total_amount, language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TenantSettings = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  const [name, setName] = useState(tenant.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({ name }).eq('id', tenant.id);
    if (!error) alert("Ajustes guardados");
    setSaving(false);
  };

  return (
    <div className="max-w-2xl animate-in fade-in duration-500">
      <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-10">{t('settings')}</h3>
      <div className="bg-white p-10 rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
         <Input label="Nombre de la Empresa" value={name} onChange={(e:any) => setName(e.target.value)} />
         <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">Guardar</button>
      </div>
    </div>
  );
};

// --- SuperAdmin Components ---

const AdminLayout = () => {
  const { profile, signOut, t, loading } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && (!profile || !profile.is_superadmin)) navigate('/');
  }, [profile, loading, navigate]);

  if (loading || !profile?.is_superadmin) return <LoadingSpinner />;
  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex min-h-screen bg-[#050505] text-slate-100 font-sans">
      <aside className="w-72 bg-slate-900/40 backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0">
        <div className="p-8 h-24 flex items-center font-black text-2xl uppercase italic">SYSTEM<span className="text-brand-500">ADMIN</span></div>
        <nav className="flex-1 p-6 space-y-2">
          <Link to="/admin/dashboard" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${isActive('dashboard') ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>📊 Dashboard</Link>
          <Link to="/admin/tenants" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${isActive('tenants') ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>🏢 Tenants</Link>
        </nav>
        <div className="p-6 border-t border-white/5"><button onClick={signOut} className="w-full py-4 text-[10px] font-black uppercase text-red-400">🚪 {t('logout')}</button></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-auto p-12"><Outlet /></div>
      </main>
    </div>
  );
};

const AdminDashboard = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
    {[ { label: 'Tenants', val: '24' }, { label: 'Ingresos', val: '8.450€' } ].map((s, i) => (
      <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem]">
        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">{s.label}</div>
        <div className="text-4xl font-black text-white">{s.val}</div>
      </div>
    ))}
  </div>
);

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const { dbHealthy } = useApp();
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('tenants').select('*');
      if (data) setTenants(data as any);
    };
    if (dbHealthy) fetch();
  }, [dbHealthy]);
  return (
    <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest"><tr><th className="px-10 py-6">Empresa</th><th className="px-10 py-6 text-right">Acciones</th></tr></thead>
        <tbody className="divide-y divide-white/5">
          {tenants.map(t => <tr key={t.id}><td className="px-10 py-6 text-white font-black">{t.name}</td><td className="px-10 py-6 text-right"><Link to={`/t/${t.slug}/dashboard`} className="text-brand-500 text-[9px] font-black uppercase">Ver Panel →</Link></td></tr>)}
        </tbody>
      </table>
    </div>
  );
};

// --- Authentication ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { refreshProfile, enterDemoMode } = useApp();
  const navigate = useNavigate();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { await refreshProfile(); navigate('/'); } else alert("Error de acceso.");
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl text-center">
        <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter">Acceso</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl">ENTRAR</button>
        </form>
        <button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} className="w-full py-4 mt-8 text-gray-400 font-black text-[10px] uppercase">Probar Demo</button>
      </div>
    </div>
  );
};

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const navigate = useNavigate();
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (!error) navigate('/login'); else alert(error.message);
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
      <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl">
        <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter">Registro</h2>
        <form onSubmit={handleSignup} className="space-y-6">
          <Input label="Nombre" type="text" value={fullName} onChange={(e: any) => setFullName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <button type="submit" className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl">REGISTRARME</button>
        </form>
      </div>
    </div>
  );
};

const Landing = () => {
  const { session, memberships } = useApp();
  const dashboardLink = memberships.length > 0 ? `/t/${memberships[0].tenant?.slug}/dashboard` : '/onboarding';
  return (
    <div className="min-h-screen bg-white font-sans text-center">
      <main className="max-w-7xl mx-auto px-6 py-40">
        <h1 className="text-8xl font-black text-gray-900 mb-10 tracking-tighter leading-[0.9]">Controla tu negocio con precisión.</h1>
        <Link to={session ? dashboardLink : "/signup"} className="px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] text-sm font-black uppercase tracking-widest shadow-2xl">EMPEZAR GRATIS</Link>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile, session, dbHealthy } = useApp();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (data) setTenant(data);
    };
    if (dbHealthy && slug) fetch();
  }, [slug, dbHealthy]);

  useEffect(() => {
    if (!loading && !session) navigate('/login');
  }, [loading, session, navigate]);

  if (loading || !tenant) return <LoadingSpinner />;

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] font-sans">
      <aside className="w-80 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="p-8 h-24 flex items-center font-black text-xl text-brand-600 uppercase italic">{tenant.name}</div>
        <nav className="flex-1 p-6 space-y-2">
          <Link to={`/t/${slug}/dashboard`} className="block px-6 py-4 font-black text-[10px] uppercase text-gray-400 hover:text-brand-600">📊 Dashboard</Link>
          <Link to={`/t/${slug}/customers`} className="block px-6 py-4 font-black text-[10px] uppercase text-gray-400 hover:text-brand-600">👥 Clientes</Link>
          <Link to={`/t/${slug}/quotes`} className="block px-6 py-4 font-black text-[10px] uppercase text-gray-400 hover:text-brand-600">📄 Presupuestos</Link>
        </nav>
        <div className="p-8 border-t"><button onClick={signOut} className="w-full text-[10px] font-black uppercase text-red-500">Cerrar Sesión</button></div>
      </aside>
      <main className="flex-1 overflow-auto p-12"><Outlet context={{ tenant }} /></main>
      <SuperAdminFloatingBar />
    </div>
  );
};

const Dashboard = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  return (
    <div className="p-12 bg-white rounded-[3.5rem] border border-gray-50 h-80 flex items-center justify-center text-gray-300 font-black uppercase text-xs italic">Hub de {tenant.name}</div>
  );
};

const Onboarding = () => {
    const { session, refreshProfile } = useApp();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const { data: tenant, error } = await supabase.from('tenants').insert([{ name, slug }]).select().single();
        if (!error && tenant) {
            await supabase.from('memberships').insert([{ user_id: session?.user.id, tenant_id: tenant.id, role: 'owner' }]);
            await refreshProfile();
            navigate(`/t/${slug}/dashboard`);
        } else alert("Error: " + error?.message);
    };
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
            <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl">
                <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter">Tu Empresa</h2>
                <form onSubmit={handleCreate} className="space-y-6">
                    <Input label="Nombre de la Empresa" value={name} onChange={(e:any) => setName(e.target.value)} required />
                    <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl">EMPEZAR</button>
                </form>
            </div>
        </div>
    );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'es');

  const setLanguage = (lang: Language) => { setLanguageState(lang); localStorage.setItem('app_lang', lang); }
  const t_func = (key: keyof typeof translations['es']) => (translations[language] as any)[key] || key;

  useEffect(() => {
    if (!isConfigured) { setDbHealthy(false); return; }
    supabase.from('profiles').select('id', { count: 'exact', head: true }).then(({ error }) => setDbHealthy(!error));
  }, []);

  const fetchProfileData = async (userId: string) => {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileData) setProfile(profileData);
    const { data: membershipData } = await supabase.from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId);
    if (membershipData) setMemberships(membershipData as any);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchProfileData(session.user.id).finally(() => setLoading(false));
        else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) fetchProfileData(session.user.id);
        else { setProfile(null); setMemberships([]); }
    });
    return () => subscription.unsubscribe();
  }, [dbHealthy]);

  const refreshProfile = async () => { if (session) await fetchProfileData(session.user.id); };
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); setMemberships([]); };
  
  const enterDemoMode = (asAdmin = false) => { 
    if (asAdmin) {
      setSession({ user: { id: 'admin', email: 'admin@system.com' } } as any);
      setProfile({ id: 'admin', email: 'admin@system.com', is_superadmin: true, full_name: 'Super Administrator' });
      setMemberships([]);
    } else {
      setSession({ user: { id: 'demo', email: 'demo@demo.com' } } as any);
      setProfile({ id: 'demo', email: 'demo@demo.com', is_superadmin: false, full_name: 'Usuario Demo' });
      setMemberships([{ id: 'm1', user_id: 'demo', tenant_id: 't1', role: 'owner', tenant: { id: 't1', name: 'Demo Corp', slug: 'demo', plan: 'pro', created_at: '' } }]);
    }
    setLoading(false); 
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AppContext.Provider value={{ session, profile, memberships, loading, isDemoMode: !!(session?.user?.id === 'demo' || session?.user?.id === 'admin'), dbHealthy, language, setLanguage, t: t_func, refreshProfile, signOut, enterDemoMode }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/c/:slug" element={<PublicTenantWebsite />} />
          <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteEditor />} />
            <Route path="settings" element={<TenantSettings />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="tenants" element={<AdminTenants />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}
