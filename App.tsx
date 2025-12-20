
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase, isConfigured } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, Language } from './types';
import { translations, formatCurrency } from './i18n';
import { Session } from '@supabase/supabase-js';

// --- Datos de Producto para la Web Pública ---
const PUBLIC_CATALOG = {
  brand: "COMFEE",
  series: "Serie Split CF",
  specs: ["Eficiencia A++", "Tecnología Inverter", "Gas R32", "Smart WiFi"],
  models: [
    { id: 'cf09', name: 'COMFEE CF 09', price: 829.00 },
    { id: 'cf12', name: 'COMFEE CF 12', price: 889.00 },
    { id: 'cf18', name: 'COMFEE CF 18', price: 1139.00 },
    { id: 'cf2x1', name: 'COMFEE CF 2X1', price: 1489.00 },
  ],
  kits: [
    { id: 'k1', name: 'KIT BÁSICO ITE-3', price: 149.00 },
    { id: 'k2', name: 'KIT PREMIUM ITE-3 2X1', price: 249.00 },
  ],
  extras: [
    { id: 'e1', name: 'Metro Lineal (3/8)', price: 90.00 },
    { id: 'e2', name: 'Metro Lineal (1/2)', price: 100.00 },
    { id: 'e13', name: 'Bomba de Condensados', price: 180.00 },
  ],
  financing: {
    options: [12, 24, 36, 48, 60],
    coefficients: { 12: 0.087, 24: 0.045, 36: 0.032, 48: 0.025, 60: 0.021 }
  }
};

// --- Contexto Global ---
interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  dbHealthy: boolean | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  t: (key: keyof typeof translations['es']) => string;
}

const AppContext = createContext<AppContextType | null>(null);
const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

// --- Componentes Comunes ---
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
  </div>
);

const Input = ({ label, ...props }: any) => (
  <div className="mb-4">
    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">{label}</label>
    <input className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 focus:ring-2 focus:ring-brand-500 outline-none transition-all" {...props} />
  </div>
);

// --- WEB PÚBLICA DEL CLIENTE ---
const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { dbHealthy, t, language } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados del Modal y Configuración
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'config' | 'customer'>('config');
  const [config, setConfig] = useState({
    model: PUBLIC_CATALOG.models[0],
    kit: PUBLIC_CATALOG.kits[0],
    extras: {} as Record<string, number>,
    months: 12
  });
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '', population: '' });

  useEffect(() => {
    const fetchTenant = async () => {
      if (!dbHealthy) return;
      const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (data) setTenant(data);
      setLoading(false);
    };
    fetchTenant();
  }, [slug, dbHealthy]);

  const total = useMemo(() => {
    const extrasTotal = PUBLIC_CATALOG.extras.reduce((acc, e) => acc + (e.price * (config.extras[e.id] || 0)), 0);
    return config.model.price + config.kit.price + extrasTotal;
  }, [config]);

  const monthlyFee = total * (PUBLIC_CATALOG.financing.coefficients as any)[config.months];

  const handleExtraQty = (id: string, delta: number) => {
    setConfig(prev => ({
      ...prev,
      extras: { ...prev.extras, [id]: Math.max(0, (prev.extras[id] || 0) + delta) }
    }));
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return <div className="p-20 text-center font-bold">Empresa no encontrada</div>;

  const lowestPrice = Math.min(...PUBLIC_CATALOG.models.map(m => m.price));

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-brand-500 selection:text-white">
      {/* Navegación Simple */}
      <nav className="flex justify-between items-center px-10 py-8 border-b border-gray-50">
        <div className="text-xl font-black uppercase tracking-tighter italic">{tenant.name}</div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <a href="#catalog" className="hover:text-brand-600 transition-colors">Catálogo</a>
          <a href="#contact" className="hover:text-brand-600 transition-colors">Contacto</a>
        </div>
      </nav>

      {/* Hero */}
      <header className="py-32 px-10 text-center max-w-5xl mx-auto">
        <div className="inline-block px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-6">Partner Oficial {PUBLIC_CATALOG.brand}</div>
        <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase italic leading-[0.85] mb-8">{tenant.name}</h1>
        <p className="text-xl text-gray-400 font-medium italic">Climatización de alta eficiencia para tu hogar y oficina.</p>
      </header>

      {/* Grid de Productos */}
      <section id="catalog" className="max-w-7xl mx-auto px-10 py-24 border-t border-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-1 gap-12">
          <div className="bg-gray-50 rounded-[3rem] p-12 md:p-16 flex flex-col md:flex-row justify-between items-center gap-12 group hover:shadow-2xl transition-all border border-gray-100">
            <div className="space-y-6 flex-1">
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Marca: {PUBLIC_CATALOG.brand}</span>
              <h3 className="text-5xl font-black italic uppercase tracking-tighter">{PUBLIC_CATALOG.series}</h3>
              <ul className="flex flex-wrap gap-4">
                {PUBLIC_CATALOG.specs.map(s => (
                  <li key={s} className="bg-white px-4 py-2 rounded-xl text-[10px] font-bold text-gray-400 uppercase shadow-sm">{s}</li>
                ))}
              </ul>
            </div>
            <div className="text-center md:text-right md:border-l md:border-gray-200 md:pl-16 space-y-6">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Desde</span>
                <span className="text-6xl font-black italic tracking-tighter">{formatCurrency(lowestPrice, language)}</span>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto px-12 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-600 transition-all shadow-xl">Configurar</button>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL DE CONFIGURACIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-2xl border border-white/20">
            
            {/* Cuerpo del Modal (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-10 md:p-16 space-y-12">
              {modalStep === 'config' ? (
                <>
                  <header>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Configura tu equipo</h2>
                    <p className="text-sm text-gray-400 font-bold">Personaliza tu instalación en pocos clics.</p>
                  </header>

                  <section className="space-y-6">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">1. Selecciona el modelo</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PUBLIC_CATALOG.models.map(m => (
                        <button key={m.id} onClick={() => setConfig({...config, model: m})} className={`p-6 rounded-2xl border-2 text-left transition-all ${config.model.id === m.id ? 'border-brand-500 bg-brand-50/50' : 'border-gray-50 hover:border-gray-100'}`}>
                          <div className="text-[12px] font-black uppercase">{m.name}</div>
                          <div className="text-xl font-black text-brand-600 mt-1">{formatCurrency(m.price, language)}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">2. Kit de instalación</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PUBLIC_CATALOG.kits.map(k => (
                        <button key={k.id} onClick={() => setConfig({...config, kit: k})} className={`p-6 rounded-2xl border-2 text-left transition-all ${config.kit.id === k.id ? 'border-brand-500 bg-brand-50/50' : 'border-gray-50 hover:border-gray-100'}`}>
                          <div className="text-[10px] font-bold uppercase">{k.name}</div>
                          <div className="text-sm font-bold text-gray-400 mt-1">+{formatCurrency(k.price, language)}</div>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">3. Extras (Cantidades)</label>
                    <div className="space-y-3">
                      {PUBLIC_CATALOG.extras.map(e => (
                        <div key={e.id} className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl">
                          <div>
                            <div className="text-[11px] font-bold uppercase">{e.name}</div>
                            <div className="text-[10px] text-brand-600 font-black">{formatCurrency(e.price, language)}/ud</div>
                          </div>
                          <div className="flex items-center gap-4 bg-white rounded-xl p-1.5 shadow-sm">
                            <button onClick={() => handleExtraQty(e.id, -1)} className="w-8 h-8 font-black text-gray-300 hover:text-brand-600">-</button>
                            <span className="w-4 text-center text-xs font-black">{config.extras[e.id] || 0}</span>
                            <button onClick={() => handleExtraQty(e.id, 1)} className="w-8 h-8 font-black text-gray-300 hover:text-brand-600">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <div className="animate-in slide-in-from-right duration-300 space-y-8">
                  <header>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Tus Datos</h2>
                    <p className="text-sm text-gray-400 font-bold">Completa el formulario para recibir tu presupuesto formal.</p>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2"><Input label="Nombre completo" value={customer.name} onChange={(e:any) => setCustomer({...customer, name: e.target.value})} /></div>
                    <Input label="Email" type="email" value={customer.email} onChange={(e:any) => setCustomer({...customer, email: e.target.value})} />
                    <Input label="Teléfono" type="tel" value={customer.phone} onChange={(e:any) => setCustomer({...customer, phone: e.target.value})} />
                    <div className="md:col-span-2"><Input label="Dirección de instalación" value={customer.address} onChange={(e:any) => setCustomer({...customer, address: e.target.value})} /></div>
                    <Input label="Población" value={customer.population} onChange={(e:any) => setCustomer({...customer, population: e.target.value})} />
                  </div>
                </div>
              )}
            </div>

            {/* Calculadora Lateral */}
            <div className="w-full md:w-[400px] bg-gray-900 text-white p-10 md:p-14 flex flex-col justify-between border-l border-white/5">
              <div className="space-y-10">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">Resumen</h4>
                <div className="space-y-4 text-sm font-medium">
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="opacity-50">Modelo</span>
                    <span className="text-right">{config.model.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="opacity-50">Instalación</span>
                    <span className="text-right">{config.kit.name}</span>
                  </div>
                  {PUBLIC_CATALOG.extras.filter(e => config.extras[e.id] > 0).map(e => (
                    <div key={e.id} className="flex justify-between text-[11px] opacity-40">
                      <span>{e.name} (x{config.extras[e.id]})</span>
                      <span>{formatCurrency(e.price * config.extras[e.id], language)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-white/10">
                  <label className="text-[9px] font-black uppercase text-brand-500 tracking-widest mb-4 block">Financiación</label>
                  <div className="grid grid-cols-5 gap-1.5 mb-6">
                    {PUBLIC_CATALOG.financing.options.map(m => (
                      <button key={m} onClick={() => setConfig({...config, months: m})} className={`py-3 rounded-lg text-[9px] font-black transition-all ${config.months === m ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}>{m}m</button>
                    ))}
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl text-center border border-white/5">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Cuota mensual est.</span>
                    <span className="text-3xl font-black italic tracking-tighter text-brand-500">{formatCurrency(monthlyFee, language)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-10 border-t border-white/10">
                <div className="flex justify-between items-center mb-8">
                  <span className="text-xs font-bold uppercase opacity-50">Total</span>
                  <span className="text-4xl font-black italic tracking-tighter">{formatCurrency(total, language)}</span>
                </div>
                {modalStep === 'config' ? (
                  <button onClick={() => setModalStep('customer')} className="w-full py-6 bg-brand-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-500 transition-all shadow-2xl">Siguiente Paso</button>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setModalStep('config')} className="flex-1 py-6 bg-white/5 text-white rounded-2xl font-black uppercase text-[9px] border border-white/10">Atrás</button>
                    <button onClick={() => { alert("Presupuesto solicitado"); setIsModalOpen(false); }} className="flex-[2] py-6 bg-brand-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Finalizar</button>
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

// --- RESTO DE LA APLICACIÓN (Neutralizado) ---
const TenantLayout = () => {
  const { slug } = useParams();
  const { signOut, loading, dbHealthy } = useApp();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (data) setTenant(data);
    };
    if (dbHealthy && slug) fetch();
  }, [slug, dbHealthy]);

  if (loading || !tenant) return <LoadingSpinner />;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-8 h-20 flex items-center font-black text-brand-600 uppercase italic border-b border-gray-50">{tenant.name}</div>
        <nav className="flex-1 p-6 space-y-1">
          <Link to={`/t/${slug}/dashboard`} className="block px-4 py-3 font-bold text-[10px] uppercase text-gray-400 hover:text-brand-600">Dashboard</Link>
          <Link to={`/t/${slug}/customers`} className="block px-4 py-3 font-bold text-[10px] uppercase text-gray-400 hover:text-brand-600">Clientes</Link>
          <Link to={`/t/${slug}/quotes`} className="block px-4 py-3 font-bold text-[10px] uppercase text-gray-400 hover:text-brand-600">Presupuestos</Link>
        </nav>
        <div className="p-8 border-t border-gray-50"><button onClick={signOut} className="w-full text-[10px] font-black uppercase text-red-500">Salir</button></div>
      </aside>
      <main className="flex-1 overflow-auto p-12"><Outlet context={{ tenant }} /></main>
    </div>
  );
};

// Componentes Placeholder para completar el Router
const Dashboard = () => <div className="bg-white p-12 rounded-[2rem] border border-gray-100 text-gray-300 font-black uppercase text-[10px]">Vista General</div>;
const Customers = () => <div className="bg-white p-12 rounded-[2rem] border border-gray-100 text-gray-300 font-black uppercase text-[10px]">Gestión de Clientes</div>;
const Quotes = () => <div className="bg-white p-12 rounded-[2rem] border border-gray-100 text-gray-300 font-black uppercase text-[10px]">Listado de Presupuestos</div>;
const QuoteEditor = () => <div className="bg-white p-12 rounded-[2rem] border border-gray-100 text-gray-300 font-black uppercase text-[10px]">Editor de Presupuesto</div>;

const Landing = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center space-y-8">
    <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-[0.85]">Gestión de Climatización<br/><span className="text-brand-500">Inteligente</span></h1>
    <Link to="/login" className="px-10 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-105 transition-all">Empezar Ahora</Link>
  </div>
);

const Login = () => <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-md text-center"><h2 className="text-3xl font-black uppercase italic mb-8">Acceso</h2><button onClick={() => window.location.href='/#/t/demo/dashboard'} className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest">Entrar como Demo</button></div></div>;

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfileData(session.user.id);
      setLoading(false);
    });
  }, [dbHealthy]);

  const fetchProfileData = async (userId: string) => {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileData) setProfile(profileData);
    const { data: mData } = await supabase.from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId);
    if (mData) setMemberships(mData as any);
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  if (loading) return <LoadingSpinner />;

  return (
    <AppContext.Provider value={{ session, profile, memberships, loading, dbHealthy, language, setLanguage, t: t_func, refreshProfile: async () => {}, signOut }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/c/:slug" element={<PublicTenantWebsite />} />
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteEditor />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}
