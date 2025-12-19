
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase, isConfigured, SUPABASE_URL, saveManualConfig, clearManualConfig } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, QuoteItem, Language, PlatformContent } from './types';
import { translations, formatCurrency, formatDate } from './i18n';

// --- Datos Maestros del PDF ---
const PDF_PRODUCTS = [
  { id: 'cf09', name: 'COMFEE CF 09', price: 829.00, desc: 'Eficiencia A++ en refrigeración y A+ en calefacción.' },
  { id: 'cf12', name: 'COMFEE CF 12', price: 889.00, desc: 'Tecnología Inverter y operación silenciosa de 23 dBA.' },
  { id: 'cf18', name: 'COMFEE CF 18', price: 1139.00, desc: 'Capacidad de refrigeración de hasta 4601 kcal/h.' },
  { id: 'cf2x1', name: 'COMFEE CF 2X1', price: 1489.00, desc: 'Sistema multi-split con refrigerante ecológico R32.' },
];

const PRODUCT_SPECS = [
  "Eficiencia energética A++/A+",
  "Tecnología Inverter ultra silenciosa",
  "Nivel de ruido bajo (23 dBA)",
  "Refrigerante R32 ecológico",
  "Protección anticorrosión Gold Fin"
];

const PDF_KITS = [
  { id: 'k1', name: 'KIT INSTALACIÓN ITE-3', price: 149.00 },
  { id: 'k2', name: 'KIT INSTALACIÓN ITE-3 2X1', price: 249.00 },
];

const PDF_EXTRAS = [
  { id: 'e1', name: 'METRO LINIAL (3/8)', price: 90.00 },
  { id: 'e2', name: 'METRO LINIAL (1/2)', price: 100.00 },
  { id: 'e3', name: 'MANGUERA 3x2,5mm', price: 10.00 },
  { id: 'e4', name: 'TUBERÍA 1/4 - 3/8', price: 35.00 },
  { id: 'e5', name: 'CANAL 60x60', price: 35.00 },
  { id: 'e6', name: 'TRABAJOS EN ALTURA', price: 80.00 },
  { id: 'e7', name: 'BOMBA DE CONDENSADOS', price: 180.00 },
];

const FINANCING_COEFFICIENTS: Record<number, number> = {
  12: 0.087,
  24: 0.045104,
  36: 0.032206,
  48: 0.0253,
  60: 0.021183,
};

// --- Contexto ---
interface AppContextType {
  session: any | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  dbHealthy: boolean | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  signOut: () => Promise<void>;
  t: (key: keyof typeof translations['es']) => string;
}

const AppContext = createContext<AppContextType | null>(null);
const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

// --- Componentes ---
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent shadow-xl"></div>
  </div>
);

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200/50">
      <button onClick={() => setLanguage('es')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${language === 'es' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400'}`}>ES</button>
      <button onClick={() => setLanguage('ca')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${language === 'ca' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400'}`}>CA</button>
    </div>
  );
};

// --- WEB PÚBLICA ---
const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { dbHealthy, language } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal Flow
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'config' | 'customer'>('config');

  // Selection States
  const [selectedModel, setSelectedModel] = useState(PDF_PRODUCTS[0]);
  const [selectedKit, setSelectedKit] = useState(PDF_KITS[0]);
  const [extraQtys, setExtraQtys] = useState<Record<string, number>>({});
  const [financingMonths, setFinancingMonths] = useState(12);

  // Customer Form
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '', population: '' });

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
    const extrasTotal = PDF_EXTRAS.reduce((acc, e) => acc + (e.price * (extraQtys[e.id] || 0)), 0);
    return selectedModel.price + selectedKit.price + extrasTotal;
  }, [selectedModel, selectedKit, extraQtys]);

  const monthlyFee = useMemo(() => {
    return currentTotal * FINANCING_COEFFICIENTS[financingMonths];
  }, [currentTotal, financingMonths]);

  const handleQty = (id: string, delta: number) => {
    setExtraQtys(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-brand-500 selection:text-white overflow-x-hidden">
      <nav className="flex items-center justify-between px-10 py-8 sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-50">
        <div className="text-2xl font-black italic tracking-tighter uppercase">{tenant.name}</div>
        <div className="flex items-center gap-10">
          <a href="#catalog" className="text-[10px] font-black uppercase text-gray-400 hover:text-gray-900 tracking-widest transition-colors">Catálogo</a>
          <LanguageSwitcher />
          <a href="#contact" className="px-10 py-3 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Contacto</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10">
        <section className="py-40 text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-500/5 blur-[120px] rounded-full -z-10"></div>
          <h1 className="text-[7rem] md:text-[9rem] font-black tracking-tighter leading-[0.8] mb-12 uppercase italic">{tenant.name}</h1>
          <p className="text-2xl text-gray-400 max-w-3xl mx-auto italic font-medium leading-relaxed">Instalaciones de aire acondicionado con garantía oficial y financiación a medida.</p>
        </section>

        {/* Grid de Productos Agrupado: Gama Comfee */}
        <section id="catalog" className="py-20 scroll-mt-32">
          <div className="mb-20">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Catálogo Seleccionado</h2>
            <div className="w-20 h-1.5 bg-brand-500 rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 gap-12">
            <div className="bg-gray-50 rounded-[4rem] p-16 border border-gray-100 flex flex-col md:flex-row gap-16 items-center hover:bg-white hover:shadow-2xl transition-all group">
              <div className="flex-1 space-y-8 text-left">
                <div className="flex items-center gap-4">
                  <span className="px-4 py-1.5 bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full">Gama Premium</span>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Marca: COMFEE</div>
                </div>
                <h3 className="text-6xl font-black tracking-tighter leading-none italic uppercase">Serie Comfee Split</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PRODUCT_SPECS.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm text-gray-500 font-bold italic">
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full"></span> {s}
                    </div>
                  ))}
                </div>
                <div className="pt-8 border-t border-gray-200/50">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Desde</span>
                  <div className="text-6xl font-black text-gray-900 tracking-tighter">{formatCurrency(Math.min(...PDF_PRODUCTS.map(p => p.price)), language)}</div>
                </div>
              </div>
              <div className="w-full md:w-80 space-y-4">
                <button 
                  onClick={() => { setIsModalOpen(true); setModalStep('config'); }}
                  className="w-full py-8 px-10 bg-gray-900 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-brand-600 transition-all flex justify-between items-center group/btn active:scale-95"
                >
                  <span>Configurar Presupuesto</span>
                  <span className="text-lg group-hover/btn:translate-x-1 transition-transform">→</span>
                </button>
                <p className="text-[9px] text-gray-400 font-bold uppercase text-center tracking-widest italic">Calcula tu cuota mensual al instante</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modal Configurador 2 Pasos */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row border border-white/20">
            
            {/* Cuerpo (Izquierda) */}
            <div className="flex-1 overflow-y-auto p-12 lg:p-20 bg-white scrollbar-hide">
              {modalStep === 'config' ? (
                <div className="space-y-16">
                  <header>
                    <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <span className="w-8 h-0.5 bg-brand-500"></span> PASO 1: CONFIGURACIÓN
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter italic uppercase leading-none">Tu equipo a medida</h2>
                  </header>

                  <section>
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-6 block tracking-widest italic">1. Elige el modelo exacto</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PDF_PRODUCTS.map(m => (
                        <button key={m.id} onClick={() => setSelectedModel(m)} className={`p-8 rounded-[2rem] border-2 text-left transition-all ${selectedModel.id === m.id ? 'border-brand-500 bg-brand-50/50 shadow-xl shadow-brand-500/10' : 'border-gray-50 hover:border-gray-200'}`}>
                          <div className="text-xs font-black uppercase tracking-tighter">{m.name}</div>
                          <div className="text-2xl font-black text-brand-600 mt-1">{formatCurrency(m.price, language)}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-6 block tracking-widest italic">2. Kit de Instalación</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PDF_KITS.map(k => (
                        <button key={k.id} onClick={() => setSelectedKit(k)} className={`p-8 rounded-[2rem] border-2 text-left transition-all ${selectedKit.id === k.id ? 'border-brand-500 bg-brand-50/50 shadow-xl shadow-brand-500/10' : 'border-gray-50 hover:border-gray-200'}`}>
                          <div className="text-[11px] font-black uppercase tracking-tighter">{k.name}</div>
                          <div className="text-lg font-bold text-gray-400 mt-1">+{formatCurrency(k.price, language)}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-6 block tracking-widest italic">3. Extras (Unidades)</label>
                    <div className="space-y-3 max-h-[400px] overflow-auto pr-4 scrollbar-hide">
                      {PDF_EXTRAS.map(e => (
                        <div key={e.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-gray-200 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-bold text-gray-800 italic">{e.name}</span>
                            <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">{formatCurrency(e.price, language)} / ud</span>
                          </div>
                          <div className="flex items-center gap-6 bg-white rounded-2xl p-2 shadow-sm">
                            <button onClick={() => handleQty(e.id, -1)} className="w-10 h-10 flex items-center justify-center font-black text-gray-300 hover:text-brand-600 transition-colors text-xl">－</button>
                            <span className="w-6 text-center text-sm font-black text-gray-900">{extraQtys[e.id] || 0}</span>
                            <button onClick={() => handleQty(e.id, 1)} className="w-10 h-10 flex items-center justify-center font-black text-gray-300 hover:text-brand-600 transition-colors text-xl">＋</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="space-y-16">
                  <header>
                    <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <span className="w-8 h-0.5 bg-brand-500"></span> PASO 2: TUS DATOS
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter italic uppercase leading-none">¿A quién enviamos el presupuesto?</h2>
                  </header>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Nombre Completo</label>
                      <input className="w-full px-6 py-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} placeholder="Ej: Juan Pérez" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Email</label>
                      <input className="w-full px-6 py-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all" type="email" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} placeholder="juan@ejemplo.com" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Teléfono</label>
                      <input className="w-full px-6 py-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} placeholder="600 000 000" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Dirección de Instalación</label>
                      <input className="w-full px-6 py-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none transition-all" value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} placeholder="Calle Falsa 123, 2ºA" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Calculadora (Derecha) */}
            <div className="w-full lg:w-[450px] bg-slate-900 text-white p-12 lg:p-16 flex flex-col justify-between border-l border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 blur-[100px] rounded-full"></div>
              
              <div className="z-10">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-400 mb-16">Tu Presupuesto</h4>
                
                <div className="space-y-8 mb-16">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Modelo</span>
                      <span className="font-bold text-sm text-slate-200">{selectedModel.name}</span>
                    </div>
                    <span className="font-black text-sm text-brand-400">{formatCurrency(selectedModel.price, language)}</span>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Instalación</span>
                      <span className="font-bold text-sm text-slate-200">{selectedKit.name}</span>
                    </div>
                    <span className="font-black text-sm text-brand-400">{formatCurrency(selectedKit.price, language)}</span>
                  </div>
                  
                  <div className="pt-10 border-t border-white/10 space-y-10">
                    <label className="text-[10px] font-black uppercase text-brand-400 tracking-widest block italic">Opciones de Financiación</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[12, 24, 36, 48, 60].map(m => (
                        <button key={m} onClick={() => setFinancingMonths(m)} className={`py-4 rounded-2xl text-[10px] font-black border transition-all ${financingMonths === m ? 'bg-brand-500 border-brand-500 text-white shadow-xl shadow-brand-500/30' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                          {m}m
                        </button>
                      ))}
                    </div>
                    <div className="bg-white/5 p-10 rounded-[2.5rem] text-center border border-white/5 relative group">
                      <div className="absolute inset-0 bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block mb-3 tracking-[0.2em]">CUOTA MENSUAL</span>
                      <span className="text-5xl font-black text-brand-500 tracking-tighter italic">{formatCurrency(monthlyFee, language)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-white/20 z-10">
                <div className="flex justify-between items-center mb-10">
                  <span className="text-xl font-black italic tracking-tighter text-slate-400 uppercase">TOTAL</span>
                  <span className="text-5xl font-black text-white tracking-tighter">{formatCurrency(currentTotal, language)}</span>
                </div>
                
                {modalStep === 'config' ? (
                  <button onClick={() => setModalStep('customer')} className="w-full py-8 bg-brand-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 hover:bg-brand-500 transition-all">Siguiente Paso →</button>
                ) : (
                  <div className="flex gap-4">
                    <button onClick={() => setModalStep('config')} className="flex-1 py-8 bg-white/5 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/10 transition-all">Atrás</button>
                    <button onClick={() => { alert("¡Propuesta generada con éxito!"); setIsModalOpen(false); }} className="flex-[2] py-8 bg-brand-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all">Crear Presupuesto</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- App Principal y Router ---
const Landing = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
    <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-500/5 blur-[150px] rounded-full"></div>
    <h1 className="text-[10rem] font-black italic tracking-tighter uppercase mb-8 leading-none">ACME SAAS</h1>
    <div className="flex gap-8 items-center">
      <Link to="/login" className="px-16 py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-105 transition-all">Entrar al Sistema</Link>
      <LanguageSwitcher />
    </div>
  </div>
);

// Dummies para rutas admin
const Dashboard = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Resumen</div>;
const Customers = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Clientes</div>;
const Quotes = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Presupuestos</div>;
const QuoteEditor = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Editor</div>;
const TenantSettings = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Ajustes</div>;
const Login = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Login</div>;
const Signup = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Registro</div>;
const Onboarding = () => <div className="p-16 font-black text-5xl italic uppercase tracking-tighter">Onboarding</div>;
const AdminLayout = () => <div className="p-16 bg-slate-900 text-white min-h-screen font-black italic uppercase"><Outlet /></div>;
const AdminDashboard = () => <div>Consola Central</div>;
const AdminCMS = () => <div>Contenidos</div>;
const AdminTenants = () => <div>Empresas</div>;

const TenantLayout = () => (
  <div className="flex min-h-screen bg-gray-50">
    <aside className="w-80 bg-white border-r p-12 space-y-8 flex flex-col justify-between">
      <div className="space-y-6">
        <div className="text-2xl font-black italic uppercase tracking-tighter text-brand-600 mb-12">ACME SYSTEM</div>
        <Link to="dashboard" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-brand-600 transition-colors">Dashboard</Link>
        <Link to="customers" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-brand-600 transition-colors">Clientes</Link>
        <Link to="quotes" className="block text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-brand-600 transition-colors">Presupuestos</Link>
      </div>
      <button className="text-[10px] font-black uppercase tracking-widest text-red-400 text-left">Cerrar Sesión</button>
    </aside>
    <main className="flex-1 bg-white overflow-auto"><Outlet /></main>
  </div>
);

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'es');

  const setLanguage = (lang: Language) => { setLanguageState(lang); localStorage.setItem('app_lang', lang); }
  const t_func = (key: keyof typeof translations['es']) => (translations[language] as any)[key] || key;

  useEffect(() => {
    if (!isConfigured) { setDbHealthy(false); return; }
    // Salud de DB robusta: select de id con head true
    supabase.from('profiles').select('id', { count: 'exact', head: true }).then(({ error }) => setDbHealthy(!error));
    
    // Auth logic compatible v2
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };
    fetchSession();
  }, [dbHealthy]);

  if (loading) return <LoadingSpinner />;

  return (
    <AppContext.Provider value={{ session, profile, memberships, loading, dbHealthy, language, setLanguage, t: t_func, signOut: async () => {} }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/c/:slug" element={<PublicTenantWebsite />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteEditor />} />
            <Route path="settings" element={<TenantSettings />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="cms" element={<AdminCMS />} />
            <Route path="tenants" element={<AdminTenants />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}
