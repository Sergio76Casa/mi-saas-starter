
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
// Added useOutletContext to the imports
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { supabase, isConfigured } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, Language } from './types';
import { translations, formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';

// --- Catálogo Global (Sincronizado entre Admin y Web Pública) ---
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

// --- Componentes UI ---
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
  const { t } = useApp();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-black uppercase italic mb-8 text-center">{t('login_title')}</h2>
        {error && <p className="text-red-500 text-xs mb-4 text-center font-bold">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input label={t('email')} type="email" value={email} onChange={(e:any) => setEmail(e.target.value)} required />
          <Input label={t('password')} type="password" value={password} onChange={(e:any) => setPassword(e.target.value)} required />
          <button className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-brand-500 transition-all shadow-lg">
            {t('login_btn')}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-gray-400 font-bold">
          {t('no_account')} <Link to="/signup" className="text-brand-600 uppercase underline ml-1">{t('signup_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { t } = useApp();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) navigate('/onboarding');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-black uppercase italic mb-8 text-center">{t('signup_title')}</h2>
        <form onSubmit={handleSignup} className="space-y-4">
          <Input label={t('email')} type="email" value={email} onChange={(e:any) => setEmail(e.target.value)} required />
          <Input label={t('password')} type="password" value={password} onChange={(e:any) => setPassword(e.target.value)} required />
          <button className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-brand-500 transition-all shadow-lg">
            {t('signup_btn')}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-gray-400 font-bold">
          {t('have_account')} <Link to="/login" className="text-brand-600 uppercase underline ml-1">{t('login_btn')}</Link>
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
    const { data: tenant } = await supabase.from('tenants').insert({ name, slug: slug.toLowerCase() }).select().single();
    if (tenant) {
      await supabase.from('memberships').insert({ user_id: session.user.id, tenant_id: tenant.id, role: 'owner' });
      await refreshProfile();
      navigate(`/t/${tenant.slug}/dashboard`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-xl text-center">
        <h2 className="text-4xl font-black uppercase italic mb-4">{t('onboarding_title')}</h2>
        <p className="text-gray-400 font-bold text-sm mb-10">{t('onboarding_subtitle')}</p>
        <form onSubmit={handleCreate} className="space-y-6 text-left">
          <Input label={t('company_name')} value={name} onChange={(e:any) => { setName(e.target.value); setSlug(e.target.value.replace(/\s+/g, '-').toLowerCase()); }} required />
          <Input label={t('company_slug')} value={slug} onChange={(e:any) => setSlug(e.target.value)} required />
          <button className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-600 transition-all">
            {t('create_company_btn')}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- WEB PÚBLICA (CONFIGURADOR) ---
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
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '', population: '' });

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

  const monthlyFee = total * (PRODUCT_CATALOG.financing.coefficients as any)[config.months];

  if (loading) return <LoadingSpinner />;
  if (!tenant) return <div className="p-20 text-center font-bold">Empresa no encontrada</div>;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-brand-500 selection:text-white">
      <nav className="flex justify-between items-center px-10 py-8 border-b border-gray-50">
        <div className="text-xl font-black uppercase tracking-tighter italic">{tenant.name}</div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <a href="#catalog">Catálogo</a>
          <a href="#contact">Contacto</a>
        </div>
      </nav>

      <header className="py-32 px-10 text-center max-w-5xl mx-auto">
        <div className="inline-block px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-6">Partner Oficial {PRODUCT_CATALOG.brand}</div>
        <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase italic leading-[0.85] mb-8">{tenant.name}</h1>
        <p className="text-xl text-gray-400 font-medium italic">Climatización de alta eficiencia.</p>
      </header>

      <section className="max-w-7xl mx-auto px-10 py-24 border-t border-gray-50 text-center">
        <div className="bg-gray-50 rounded-[3rem] p-12 border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="text-left space-y-4">
            <h3 className="text-5xl font-black italic uppercase tracking-tighter">{PRODUCT_CATALOG.series}</h3>
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Desde {formatCurrency(Math.min(...PRODUCT_CATALOG.models.map(m=>m.price)), language)}</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="px-12 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-600 transition-all shadow-xl">
            Configurar e Instalar
          </button>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-2xl">
            <div className="flex-1 overflow-y-auto p-10 md:p-16 space-y-12">
              {modalStep === 'config' ? (
                <>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Configura tu equipo</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PRODUCT_CATALOG.models.map(m => (
                      <button key={m.id} onClick={() => setConfig({...config, model: m})} className={`p-6 rounded-2xl border-2 text-left ${config.model.id === m.id ? 'border-brand-500 bg-brand-50/50' : 'border-gray-50'}`}>
                        <div className="text-[12px] font-black uppercase">{m.name}</div>
                        <div className="text-xl font-black text-brand-600 mt-1">{formatCurrency(m.price, language)}</div>
                      </button>
                    ))}
                  </div>
                  <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Kit de instalación</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PRODUCT_CATALOG.kits.map(k => (
                      <button key={k.id} onClick={() => setConfig({...config, kit: k})} className={`p-6 rounded-2xl border-2 text-left ${config.kit.id === k.id ? 'border-brand-500 bg-brand-50/50' : 'border-gray-50'}`}>
                        <div className="text-[10px] font-bold uppercase">{k.name}</div>
                        <div className="text-sm font-bold text-gray-400">+{formatCurrency(k.price, language)}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-8">
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Tus Datos</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2"><Input label="Nombre completo" value={customer.name} onChange={(e:any) => setCustomer({...customer, name: e.target.value})} /></div>
                    <Input label="Email" type="email" value={customer.email} onChange={(e:any) => setCustomer({...customer, email: e.target.value})} />
                    <Input label="Teléfono" type="tel" value={customer.phone} onChange={(e:any) => setCustomer({...customer, phone: e.target.value})} />
                  </div>
                </div>
              )}
            </div>
            <div className="w-full md:w-[400px] bg-gray-900 text-white p-10 flex flex-col justify-between">
              <div className="space-y-8">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-500">Resumen</h4>
                <div className="text-sm opacity-80">{config.model.name} + {config.kit.name}</div>
                <div className="pt-8 border-t border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] font-black uppercase">Financiación</span>
                    <span className="text-brand-500 font-black">{config.months}m</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {PRODUCT_CATALOG.financing.options.map(m => (
                      <button key={m} onClick={() => setConfig({...config, months: m})} className={`py-2 rounded text-[8px] font-black ${config.months === m ? 'bg-brand-500' : 'bg-white/5'}`}>{m}m</button>
                    ))}
                  </div>
                  <div className="mt-6 bg-white/5 p-6 rounded-2xl text-center">
                    <span className="text-2xl font-black italic">{formatCurrency(monthlyFee, language)}/mes</span>
                  </div>
                </div>
              </div>
              <div className="mt-10">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-bold uppercase opacity-50">Total</span>
                  <span className="text-4xl font-black italic">{formatCurrency(total, language)}</span>
                </div>
                {modalStep === 'config' ? (
                  <button onClick={() => setModalStep('customer')} className="w-full py-6 bg-brand-600 text-white rounded-2xl font-black uppercase text-[10px]">Siguiente</button>
                ) : (
                  <button onClick={() => { alert("Presupuesto enviado"); setIsModalOpen(false); }} className="w-full py-6 bg-brand-600 text-white rounded-2xl font-black uppercase text-[10px]">Solicitar Presupuesto</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- PANEL DE ADMINISTRACIÓN (TENANT) ---
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
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-8 h-20 flex items-center font-black text-brand-600 uppercase italic border-b border-gray-50">{tenant.name}</div>
        <nav className="flex-1 p-6 space-y-2">
          <Link to={`/t/${slug}/dashboard`} className="flex items-center px-4 py-3 font-bold text-[10px] uppercase text-gray-400 hover:text-brand-600 transition-colors">Dashboard</Link>
          <Link to={`/t/${slug}/customers`} className="flex items-center px-4 py-3 font-bold text-[10px] uppercase text-gray-400 hover:text-brand-600 transition-colors">Clientes</Link>
          <Link to={`/t/${slug}/quotes`} className="flex items-center px-4 py-3 font-bold text-[10px] uppercase text-gray-400 hover:text-brand-600 transition-colors">Presupuestos</Link>
          <div className="pt-10">
            <Link to={`/c/${slug}`} target="_blank" className="flex items-center px-4 py-3 font-bold text-[10px] uppercase text-brand-600 bg-brand-50 rounded-xl">Ver Web Pública ↗</Link>
          </div>
        </nav>
        <div className="p-8 border-t border-gray-50">
          <button onClick={signOut} className="w-full text-left px-4 text-[10px] font-black uppercase text-red-500">Cerrar Sesión</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-12">
        <Outlet context={{ tenant }} />
      </main>
    </div>
  );
};

// --- VISTAS DEL ADMIN ---
const Dashboard = () => {
  // Fixed missing useOutletContext import
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-4xl font-black uppercase italic tracking-tighter">Resumen: {tenant.name}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Ventas del mes', val: '€12,450', color: 'bg-white' },
          { label: 'Presupuestos enviados', val: '24', color: 'bg-white' },
          { label: 'Nuevos clientes', val: '8', color: 'bg-white' },
        ].map(card => (
          <div key={card.label} className={`${card.color} p-10 rounded-[2.5rem] border border-gray-100 shadow-sm`}>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{card.label}</span>
            <div className="text-4xl font-black italic mt-4">{card.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Customers = () => {
  // Fixed missing useOutletContext import
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { language } = useApp();

  useEffect(() => {
    supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
      .then(({ data }) => setCustomers(data || []));
  }, [tenant]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black uppercase italic tracking-tighter">Clientes</h2>
      </div>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Contacto</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-6 font-bold text-sm uppercase">{c.name}</td>
                <td className="px-8 py-6 text-xs text-gray-500">{c.email}<br/>{c.phone}</td>
                <td className="px-8 py-6 text-[10px] font-bold text-gray-400">{formatDate(c.created_at, language)}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={3} className="p-20 text-center font-bold text-gray-300 uppercase text-[10px]">Sin clientes registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Quotes = () => {
  // Fixed missing useOutletContext import
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const { language } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('quotes').select('*, customer:customers(*)').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
      .then(({ data }) => setQuotes(data || []));
  }, [tenant]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black uppercase italic tracking-tighter">Presupuestos</h2>
        <button onClick={() => navigate(`/t/${tenant.slug}/quotes/new`)} className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-600 transition-all shadow-xl">Nuevo Presupuesto</button>
      </div>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Nº / Cliente</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Total</th>
              <th className="px-8 py-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quotes.map(q => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-6">
                  <div className="font-bold text-sm uppercase">{q.quote_no}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase italic">{q.client_name || q.customer?.name}</div>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${q.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-right font-black italic">{formatCurrency(q.total_amount, language)}</td>
                <td className="px-8 py-6 text-right">
                  <Link to={`/t/${tenant.slug}/quotes/${q.id}`} className="text-brand-600 font-black uppercase text-[9px] underline">Editar</Link>
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
  // Fixed missing useOutletContext import
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { id } = useParams();
  const navigate = useNavigate();
  const { language, session } = useApp();
  const [loading, setLoading] = useState(id !== 'new');
  
  const [quote, setQuote] = useState({
    client_name: '', client_email: '', client_phone: '', client_address: '', client_population: '',
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
    const quoteData = { ...quote, tenant_id: tenant.id, created_by: session.user.id, total_amount: quote.items.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0) };
    const { items, ...mainData } = quoteData;
    
    let quoteId = id;
    if (id === 'new') {
      const { data } = await supabase.from('quotes').insert({ ...mainData, quote_no: `Q-${Date.now().toString().slice(-6)}` }).select().single();
      if (data) quoteId = data.id;
    } else {
      await supabase.from('quotes').update(mainData).eq('id', id);
    }
    
    if (quoteId) {
      await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      await supabase.from('quote_items').insert(quote.items.map(i => ({ ...i, quote_id: quoteId, total: i.unit_price * i.quantity })));
      navigate(`/t/${tenant.slug}/quotes`);
    }
  };

  const addFromCatalog = (p: any) => {
    setQuote(prev => ({ ...prev, items: [...prev.items, { description: p.name, quantity: 1, unit_price: p.price }] }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black uppercase italic tracking-tighter">{id === 'new' ? 'Nuevo Presupuesto' : 'Editar Presupuesto'}</h2>
        <button onClick={saveQuote} className="px-12 py-5 bg-brand-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-500 shadow-xl transition-all">Guardar</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6">Datos del Cliente</h3>
          <Input label="Nombre Cliente" value={quote.client_name} onChange={(e:any) => setQuote({...quote, client_name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" value={quote.client_email} onChange={(e:any) => setQuote({...quote, client_email: e.target.value})} />
            <Input label="Teléfono" value={quote.client_phone} onChange={(e:any) => setQuote({...quote, client_phone: e.target.value})} />
          </div>
          <Input label="Dirección" value={quote.client_address} onChange={(e:any) => setQuote({...quote, client_address: e.target.value})} />
        </div>

        <div className="bg-gray-50 p-12 rounded-[2.5rem] border border-gray-100 space-y-8">
          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Catálogo Rápido {PRODUCT_CATALOG.brand}</h3>
          <div className="space-y-4">
            <div className="text-[9px] font-bold uppercase text-gray-400">Modelos Serie CF</div>
            <div className="grid grid-cols-1 gap-2">
              {PRODUCT_CATALOG.models.map(m => (
                <button key={m.id} onClick={() => addFromCatalog(m)} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 hover:border-brand-500 transition-all text-left">
                  <span className="text-[10px] font-black uppercase italic">{m.name}</span>
                  <span className="text-[10px] font-black text-brand-600">{formatCurrency(m.price, language)}</span>
                </button>
              ))}
            </div>
            <div className="text-[9px] font-bold uppercase text-gray-400 mt-6">Kits e Instalación</div>
            <div className="grid grid-cols-1 gap-2">
              {PRODUCT_CATALOG.kits.map(k => (
                <button key={k.id} onClick={() => addFromCatalog(k)} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 hover:border-brand-500 transition-all text-left">
                  <span className="text-[10px] font-black uppercase italic">{k.name}</span>
                  <span className="text-[10px] font-black text-brand-600">{formatCurrency(k.price, language)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Concepto</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Cant</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Precio Unit.</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Subtotal</th>
              <th className="px-8 py-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quote.items.map((item, idx) => (
              <tr key={idx}>
                <td className="px-8 py-6"><input className="w-full bg-transparent font-bold uppercase text-xs outline-none" value={item.description} onChange={(e) => { const it = [...quote.items]; it[idx].description = e.target.value; setQuote({...quote, items: it}); }} /></td>
                <td className="px-8 py-6 text-center"><input type="number" className="w-12 bg-gray-50 rounded-lg p-2 text-center text-xs font-black" value={item.quantity} onChange={(e) => { const it = [...quote.items]; it[idx].quantity = Number(e.target.value); setQuote({...quote, items: it}); }} /></td>
                <td className="px-8 py-6 text-right"><input type="number" className="w-24 bg-gray-50 rounded-lg p-2 text-right text-xs font-black" value={item.unit_price} onChange={(e) => { const it = [...quote.items]; it[idx].unit_price = Number(e.target.value); setQuote({...quote, items: it}); }} /></td>
                <td className="px-8 py-6 text-right font-black italic">{formatCurrency(item.quantity * item.unit_price, language)}</td>
                <td className="px-8 py-6 text-center"><button onClick={() => setQuote({...quote, items: quote.items.filter((_, i) => i !== idx)})} className="text-red-400 font-bold">×</button></td>
              </tr>
            ))}
            {quote.items.length === 0 && (
              <tr><td colSpan={5} className="p-16 text-center text-[10px] font-bold text-gray-300 uppercase">Añade conceptos desde el catálogo o manualmente</td></tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 font-black italic text-xl">
            <tr>
              <td colSpan={3} className="px-8 py-8 text-right uppercase text-[10px] tracking-widest text-gray-400">Total Presupuesto</td>
              <td className="px-8 py-8 text-right text-brand-600">{formatCurrency(quote.items.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0), language)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// --- ROUTER & APP ---
const Landing = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center space-y-12 bg-white">
    <div className="space-y-4">
      <div className="inline-block px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-[9px] font-black uppercase tracking-widest">SaaS multi-tenant</div>
      <h1 className="text-8xl md:text-9xl font-black italic tracking-tighter uppercase leading-[0.8] mix-blend-multiply">Climatización<br/><span className="text-brand-500">Premium</span></h1>
    </div>
    <div className="flex gap-6">
      <Link to="/login" className="px-12 py-6 bg-gray-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-105 transition-all">Panel Instalador</Link>
      <Link to="/signup" className="px-12 py-6 bg-white text-gray-900 border border-gray-100 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg hover:bg-gray-50 transition-all">Crear Cuenta</Link>
    </div>
  </div>
);

// Fixed children type by making it optional to satisfy strict TS checks when used in JSX
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { session, loading, memberships } = useApp();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" />;
  if (memberships.length === 0) return <Navigate to="/onboarding" />;
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
          
          {/* Rutas de Redirección Inteligente */}
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
