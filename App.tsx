
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { supabase, isConfigured } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, Language } from './types';
import { translations, formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';

// --- Catálogo Global (Sincronizado) ---
const PRODUCT_CATALOG = {
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

// --- Contexto ---
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

// --- UI Components ---
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

// --- VISTAS DE AUTENTICACIÓN ---
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { t, session } = useApp();
  const navigate = useNavigate();

  if (session) return <Navigate to="/dashboard" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-md border border-gray-100">
        <h2 className="text-3xl font-black uppercase italic mb-8 text-center">{t('login_title')}</h2>
        {error && <p className="text-red-500 text-[10px] mb-4 text-center font-bold uppercase">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input label={t('email')} type="email" value={email} onChange={(e:any) => setEmail(e.target.value)} required />
          <Input label={t('password')} type="password" value={password} onChange={(e:any) => setPassword(e.target.value)} required />
          <button className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-600 transition-all shadow-lg">
            {t('login_btn')}
          </button>
        </form>
        <p className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase">
          {t('no_account')} <Link to="/signup" className="text-brand-600 underline ml-1">{t('signup_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { t, session } = useApp();
  const navigate = useNavigate();

  if (session) return <Navigate to="/dashboard" />;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) navigate('/onboarding');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-md border border-gray-100">
        <h2 className="text-3xl font-black uppercase italic mb-8 text-center">{t('signup_title')}</h2>
        <form onSubmit={handleSignup} className="space-y-4">
          <Input label={t('email')} type="email" value={email} onChange={(e:any) => setEmail(e.target.value)} required />
          <Input label={t('password')} type="password" value={password} onChange={(e:any) => setPassword(e.target.value)} required />
          <button className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-500 transition-all shadow-lg">
            {t('signup_btn')}
          </button>
        </form>
        <p className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase">
          {t('have_account')} <Link to="/login" className="text-brand-600 underline ml-1">{t('login_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

const Onboarding = () => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const { session, refreshProfile, t } = useApp();
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const { data: tenant, error } = await supabase.from('tenants').insert({ name, slug: slug.toLowerCase() }).select().single();
    if (tenant) {
      await supabase.from('memberships').insert({ user_id: session.user.id, tenant_id: tenant.id, role: 'owner' });
      await refreshProfile();
      navigate(`/t/${tenant.slug}/dashboard`);
    } else {
      alert(error?.message || "Error al crear la empresa");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 md:p-20 rounded-[4rem] shadow-2xl w-full max-w-2xl text-center border border-gray-100">
        <h2 className="text-5xl font-black uppercase italic mb-4 leading-none tracking-tighter">{t('onboarding_title')}</h2>
        <p className="text-gray-400 font-bold text-sm mb-12 uppercase tracking-widest">{t('onboarding_subtitle')}</p>
        <form onSubmit={handleCreate} className="space-y-8 text-left">
          <Input label={t('company_name')} value={name} onChange={(e:any) => { setName(e.target.value); setSlug(e.target.value.replace(/\s+/g, '-').toLowerCase()); }} required />
          <Input label={t('company_slug')} value={slug} onChange={(e:any) => setSlug(e.target.value)} required />
          <button className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-brand-600 transition-all shadow-2xl">
            {t('create_company_btn')}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- WEB PÚBLICA (COFFEE CONFIGURATOR) ---
const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { dbHealthy, language } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'config' | 'customer'>('config');
  const [config, setConfig] = useState({
    model: PRODUCT_CATALOG.models[0],
    kit: PRODUCT_CATALOG.kits[0],
    extras: {} as Record<string, number>,
    months: 12
  });
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' });

  useEffect(() => {
    if (dbHealthy && slug) {
      supabase.from('tenants').select('*').eq('slug', slug).single().then(({ data }) => {
        if (data) setTenant(data);
        setLoading(false);
      });
    }
  }, [slug, dbHealthy]);

  const total = useMemo(() => {
    const extrasTotal = PRODUCT_CATALOG.extras.reduce((acc, e) => acc + (e.price * (config.extras[e.id] || 0)), 0);
    return config.model.price + config.kit.price + extrasTotal;
  }, [config]);

  const monthlyFee = total * Number((PRODUCT_CATALOG.financing.coefficients as any)[config.months] || 0);

  if (loading) return <LoadingSpinner />;
  if (!tenant) return <div className="p-20 text-center font-black uppercase italic tracking-widest">Empresa no encontrada</div>;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-brand-500 selection:text-white">
      <nav className="flex justify-between items-center px-10 py-10 border-b border-gray-50">
        <div className="text-2xl font-black uppercase tracking-tighter italic">{tenant.name}</div>
        <div className="flex gap-12 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <a href="#catalog">Catálogo</a>
          <a href="#contact">Contacto</a>
        </div>
      </nav>

      <header className="py-40 px-10 text-center max-w-6xl mx-auto">
        <div className="inline-block px-5 py-2 bg-brand-50 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-10 border border-brand-100">Partner Oficial {PRODUCT_CATALOG.brand}</div>
        <h1 className="text-8xl md:text-[10rem] font-black tracking-tighter uppercase italic leading-[0.75] mb-12">{tenant.name}</h1>
        <p className="text-2xl text-gray-400 font-medium italic tracking-tight">Sistemas de climatización de vanguardia.</p>
      </header>

      <section className="max-w-7xl mx-auto px-10 py-24 border-t border-gray-50">
        <div className="bg-gray-50 rounded-[4rem] p-16 flex flex-col md:flex-row justify-between items-center gap-16 border border-gray-100 shadow-sm">
          <div className="space-y-6 flex-1">
             <h3 className="text-6xl font-black italic uppercase tracking-tighter leading-none">{PRODUCT_CATALOG.series}</h3>
             <div className="flex flex-wrap gap-3">
               {PRODUCT_CATALOG.specs.map(s => <span key={s} className="bg-white px-5 py-2 rounded-xl text-[9px] font-bold text-gray-400 uppercase border border-gray-100">{s}</span>)}
             </div>
          </div>
          <div className="text-center md:text-right">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Instalación desde</p>
            <p className="text-8xl font-black italic text-gray-900 mb-8">{formatCurrency(Math.min(...PRODUCT_CATALOG.models.map(m=>m.price)), language)}</p>
            <button onClick={() => setIsModalOpen(true)} className="px-16 py-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-brand-600 transition-all shadow-2xl">
              Configurar Instalación
            </button>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-7xl max-h-[90vh] rounded-[4rem] overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="flex-1 overflow-y-auto p-12 md:p-20 space-y-16">
              {modalStep === 'config' ? (
                <>
                  <h2 className="text-5xl font-black uppercase italic tracking-tighter">Personaliza tu equipo</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {PRODUCT_CATALOG.models.map(m => (
                      <button key={m.id} onClick={() => setConfig({...config, model: m})} className={`p-8 rounded-[2rem] border-2 text-left transition-all ${config.model.id === m.id ? 'border-brand-500 bg-brand-50/50' : 'border-gray-50 hover:bg-gray-50'}`}>
                        <div className="text-[14px] font-black uppercase italic">{m.name}</div>
                        <div className="text-2xl font-black text-brand-600 mt-2">{formatCurrency(m.price, language)}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-12 animate-in slide-in-from-right duration-500">
                  <h2 className="text-5xl font-black uppercase italic tracking-tighter">Tus Datos</h2>
                  <div className="grid grid-cols-1 gap-6">
                    <Input label="Nombre completo" value={customer.name} onChange={(e:any) => setCustomer({...customer, name: e.target.value})} />
                    <Input label="Email de contacto" type="email" value={customer.email} onChange={(e:any) => setCustomer({...customer, email: e.target.value})} />
                    <Input label="Teléfono" type="tel" value={customer.phone} onChange={(e:any) => setCustomer({...customer, phone: e.target.value})} />
                    <Input label="Dirección" value={customer.address} onChange={(e:any) => setCustomer({...customer, address: e.target.value})} />
                  </div>
                </div>
              )}
            </div>
            <div className="w-full md:w-[450px] bg-gray-900 text-white p-12 flex flex-col justify-between">
              <div className="space-y-12">
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-brand-500">Tu Presupuesto</h4>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-40">
                    <span>Modelo</span>
                    <span>{config.model.name}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-40">
                    <span>Instalación</span>
                    <span>{config.kit.name}</span>
                  </div>
                </div>
                <div className="pt-10 border-t border-white/10">
                  <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest block mb-4">Financiación</span>
                  <div className="grid grid-cols-5 gap-2 mb-8">
                    {PRODUCT_CATALOG.financing.options.map(m => (
                      <button key={m} onClick={() => setConfig({...config, months: m})} className={`py-4 rounded-xl text-[10px] font-black transition-all ${config.months === m ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}>{m}m</button>
                    ))}
                  </div>
                  <div className="bg-white/5 p-8 rounded-[2.5rem] text-center">
                    <span className="text-5xl font-black italic tracking-tighter text-brand-500">{formatCurrency(monthlyFee, language)}<span className="text-lg">/mes</span></span>
                  </div>
                </div>
              </div>
              <div className="mt-12">
                <div className="flex justify-between items-center mb-10">
                  <span className="text-[11px] font-black uppercase tracking-widest opacity-40">Total</span>
                  <span className="text-5xl font-black italic tracking-tighter">{formatCurrency(total, language)}</span>
                </div>
                {modalStep === 'config' ? (
                  <button onClick={() => setModalStep('customer')} className="w-full py-7 bg-brand-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest hover:bg-brand-500 transition-all shadow-2xl">Continuar</button>
                ) : (
                  <button onClick={() => { alert("Solicitud enviada"); setIsModalOpen(false); }} className="w-full py-7 bg-brand-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl">Finalizar Solicitud</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- PANEL DE ADMINISTRACIÓN ---
const TenantLayout = () => {
  const { slug } = useParams();
  const { signOut, loading, dbHealthy } = useApp();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (dbHealthy && slug) {
      supabase.from('tenants').select('*').eq('slug', slug).single().then(({ data }) => {
        if (data) setTenant(data);
        else navigate('/dashboard');
      });
    }
  }, [slug, dbHealthy]);

  if (loading || !tenant) return <LoadingSpinner />;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-80 bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen">
        <div className="p-10 h-24 flex items-center font-black text-brand-600 uppercase italic border-b border-gray-50 tracking-tighter text-xl">{tenant.name}</div>
        <nav className="flex-1 p-8 space-y-3">
          <Link to={`/t/${slug}/dashboard`} className="flex items-center px-6 py-4 font-black text-[11px] uppercase tracking-widest text-gray-400 hover:text-brand-600 transition-all rounded-2xl hover:bg-gray-50">Dashboard</Link>
          <Link to={`/t/${slug}/customers`} className="flex items-center px-6 py-4 font-black text-[11px] uppercase tracking-widest text-gray-400 hover:text-brand-600 transition-all rounded-2xl hover:bg-gray-50">Clientes</Link>
          <Link to={`/t/${slug}/quotes`} className="flex items-center px-6 py-4 font-black text-[11px] uppercase tracking-widest text-gray-400 hover:text-brand-600 transition-all rounded-2xl hover:bg-gray-50">Presupuestos</Link>
          <div className="pt-12">
            <Link to={`/c/${slug}`} target="_blank" className="flex items-center px-6 py-4 font-black text-[10px] uppercase text-brand-600 bg-brand-50 rounded-2xl border border-brand-100">Ver Web Pública ↗</Link>
          </div>
        </nav>
        <div className="p-10 border-t border-gray-50">
          <button onClick={signOut} className="w-full text-left px-6 text-[11px] font-black uppercase text-red-500 tracking-widest">Cerrar Sesión</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-16">
        <Outlet context={{ tenant }} />
      </main>
    </div>
  );
};

const Dashboard = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  return (
    <div className="space-y-12">
      <h2 className="text-5xl font-black uppercase italic tracking-tighter">Panel de {tenant.name}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm">
          <span className="text-[11px] font-black uppercase text-gray-300 tracking-[0.3em]">Ventas del mes</span>
          <div className="text-5xl font-black italic mt-6 tracking-tighter leading-none">€18,920</div>
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm">
          <span className="text-[11px] font-black uppercase text-gray-300 tracking-[0.3em]">Presupuestos</span>
          <div className="text-5xl font-black italic mt-6 tracking-tighter leading-none">31</div>
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm">
          <span className="text-[11px] font-black uppercase text-gray-300 tracking-[0.3em]">Nuevos Clientes</span>
          <div className="text-5xl font-black italic mt-6 tracking-tighter leading-none">14</div>
        </div>
      </div>
    </div>
  );
};

const Customers = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { language } = useApp();

  useEffect(() => {
    supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
      .then(({ data }) => setCustomers(data || []));
  }, [tenant]);

  return (
    <div className="space-y-10">
      <h2 className="text-5xl font-black uppercase italic tracking-tighter">Base de Clientes</h2>
      <div className="bg-white rounded-[3.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 border-b border-gray-50">
            <tr>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-300">Nombre</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-300">Contacto</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-300">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-10 py-8 font-black text-sm uppercase italic">{c.name}</td>
                <td className="px-10 py-8 text-xs text-gray-400 font-bold">{c.email}<br/>{c.phone}</td>
                <td className="px-10 py-8 text-[11px] font-black text-gray-300 italic">{formatDate(c.created_at, language)}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={3} className="p-32 text-center font-black text-gray-200 uppercase text-[12px] italic">Sin clientes registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Quotes = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const { language } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('quotes').select('*, customer:customers(*)').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
      .then(({ data }) => setQuotes(data || []));
  }, [tenant]);

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <h2 className="text-5xl font-black uppercase italic tracking-tighter">Presupuestos</h2>
        <button onClick={() => navigate(`/t/${tenant.slug}/quotes/new`)} className="px-12 py-5 bg-gray-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest hover:bg-brand-600 transition-all shadow-2xl">Nuevo Presupuesto</button>
      </div>
      <div className="bg-white rounded-[3.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 border-b border-gray-50">
            <tr>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-300">Referencia</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-300">Estado</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-widest text-gray-300 text-right">Total</th>
              <th className="px-10 py-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quotes.map(q => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-10 py-8">
                  <div className="font-black text-sm uppercase italic">{q.quote_no}</div>
                  <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">{q.client_name || q.customer?.name}</div>
                </td>
                <td className="px-10 py-8">
                  <span className="px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-500">{q.status}</span>
                </td>
                <td className="px-10 py-8 text-right font-black italic text-brand-600 text-lg">{formatCurrency(q.total_amount, language)}</td>
                <td className="px-10 py-8 text-right">
                  <Link to={`/t/${tenant.slug}/quotes/${q.id}`} className="text-gray-400 font-black uppercase text-[10px] tracking-widest underline hover:text-brand-600">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const QuoteEditor = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { id } = useParams();
  const navigate = useNavigate();
  const { language, session } = useApp();
  const [loading, setLoading] = useState(id !== 'new');
  const [quote, setQuote] = useState({
    client_name: '', client_email: '', client_phone: '', client_address: '',
    status: 'draft', total_amount: 0, items: [] as any[]
  });

  useEffect(() => {
    if (id !== 'new') {
      supabase.from('quotes').select('*, items:quote_items(*)').eq('id', id).single().then(({ data }) => {
        if (data) setQuote(data);
        setLoading(false);
      });
    }
  }, [id]);

  const saveQuote = async () => {
    if (!session) return;
    const { items, ...mainData } = quote;
    const total_amount = quote.items.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    
    let quoteId = id;
    if (id === 'new') {
      const { data } = await supabase.from('quotes').insert({ ...mainData, total_amount, tenant_id: tenant.id, created_by: session.user.id, quote_no: `Q-${Date.now().toString().slice(-6)}` }).select().single();
      if (data) quoteId = data.id;
    } else {
      await supabase.from('quotes').update({ ...mainData, total_amount }).eq('id', id);
    }
    
    if (quoteId) {
      await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      await supabase.from('quote_items').insert(quote.items.map(i => ({ ...i, quote_id: quoteId, total: i.unit_price * i.quantity })));
      navigate(`/t/${tenant.slug}/quotes`);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto space-y-16 pb-32">
       <div className="flex justify-between items-center">
        <h2 className="text-5xl font-black uppercase italic tracking-tighter">{id === 'new' ? 'Nuevo Presupuesto' : 'Editar Presupuesto'}</h2>
        <button onClick={saveQuote} className="px-16 py-6 bg-brand-600 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-widest hover:bg-brand-500 shadow-2xl transition-all">Guardar Cambios</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="bg-white p-16 rounded-[4rem] border border-gray-100 shadow-sm space-y-8">
           <Input label="Nombre Cliente" value={quote.client_name} onChange={(e:any) => setQuote({...quote, client_name: e.target.value})} />
           <Input label="Email" value={quote.client_email} onChange={(e:any) => setQuote({...quote, client_email: e.target.value})} />
           <Input label="Dirección" value={quote.client_address} onChange={(e:any) => setQuote({...quote, client_address: e.target.value})} />
        </div>
        <div className="bg-gray-50 p-16 rounded-[4rem] border border-gray-100 space-y-8">
           <h4 className="text-[11px] font-black uppercase text-gray-300 tracking-[0.4em]">Añadir del Catálogo Comfee</h4>
           <div className="grid grid-cols-1 gap-2">
             {PRODUCT_CATALOG.models.map(m => (
               <button key={m.id} onClick={() => setQuote({...quote, items: [...quote.items, { description: m.name, quantity: 1, unit_price: m.price }]})} className="flex justify-between items-center p-6 bg-white rounded-2xl border border-gray-50 hover:border-brand-500 transition-all text-left">
                  <span className="text-[12px] font-black uppercase italic">{m.name}</span>
                  <span className="text-[12px] font-black text-brand-600">{formatCurrency(m.price, language)}</span>
               </button>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- ROUTER & APP ---
const Landing = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center space-y-16 bg-white">
    <div className="relative space-y-6">
      <div className="inline-block px-6 py-2.5 bg-brand-50 text-brand-600 rounded-full text-[11px] font-black uppercase tracking-[0.3em] border border-brand-100">SaaS Multi-tenant Premium</div>
      <h1 className="text-8xl md:text-[12rem] font-black italic tracking-tighter uppercase leading-[0.75] mix-blend-multiply">Confort<br/><span className="text-brand-500">Inteligente</span></h1>
    </div>
    <div className="flex flex-col md:flex-row gap-8">
      <Link to="/login" className="px-16 py-7 bg-gray-900 text-white rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.2em] shadow-2xl hover:scale-110 transition-all">Panel Instalador</Link>
      <Link to="/signup" className="px-16 py-7 bg-white text-gray-900 border border-gray-100 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.2em] shadow-xl hover:bg-gray-50 transition-all">Crear Cuenta Gratis</Link>
    </div>
  </div>
);

// Componente de Ruta Protegida Corregido para no bloquear Onboarding
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, memberships } = useApp();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace />;

  // Si no tiene empresa y no está en onboarding, forzar ir a onboarding
  if (memberships.length === 0 && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Si tiene empresa y está intentando ir a onboarding, mandarlo al dashboard
  if (memberships.length > 0 && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfileData(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfileData(session.user.id);
      else { setProfile(null); setMemberships([]); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [dbHealthy]);

  const fetchProfileData = async (userId: string) => {
    setLoading(true);
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileData) setProfile(profileData);
    const { data: mData } = await supabase.from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId);
    if (mData) setMemberships(mData as any);
    setLoading(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/'; };

  if (loading) return <LoadingSpinner />;

  return (
    <AppContext.Provider value={{ session, profile, memberships, loading, dbHealthy, language, setLanguage, t: t_func, refreshProfile: () => fetchProfileData(session?.user.id || ''), signOut }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/c/:slug" element={<PublicTenantWebsite />} />
          
          <Route path="/dashboard" element={<ProtectedRoute>
            {memberships.length > 0 ? <Navigate to={`/t/${memberships[0].tenant?.slug}/dashboard`} /> : <Navigate to="/onboarding" />}
          </ProtectedRoute>} />

          <Route path="/t/:slug" element={<ProtectedRoute><TenantLayout /></ProtectedRoute>}>
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
