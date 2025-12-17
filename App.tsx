import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, QuoteItem, Language, PlatformContent, TenantContent } from './types';
import { translations, formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';

// --- Context & Hooks ---

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  isDemoMode: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  t: (key: keyof typeof translations['es']) => string;
}

const AppContext = createContext<AppContextType>({
  session: null,
  profile: null,
  memberships: [],
  loading: true,
  isDemoMode: false,
  language: 'es',
  setLanguage: () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
  enterDemoMode: () => {},
  t: (key) => key,
});

const useApp = () => useContext(AppContext);

// --- Components ---

const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }: any) => {
  const base = "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-brand-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
  };
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled}
      className={`${base} ${variants[variant as keyof typeof variants]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input 
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-500 focus:border-brand-500" 
      {...props} 
    />
  </div>
);

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex items-center space-x-2 text-sm">
      <button 
        onClick={() => setLanguage('es')} 
        className={`px-2 py-1 rounded ${language === 'es' ? 'bg-brand-100 text-brand-800 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        ES
      </button>
      <span className="text-gray-300">|</span>
      <button 
        onClick={() => setLanguage('ca')} 
        className={`px-2 py-1 rounded ${language === 'ca' ? 'bg-brand-100 text-brand-800 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        CA
      </button>
    </div>
  );
};

// --- Pages: Platform Public (Web Principal) ---

const Landing = () => {
  const { t, language } = useApp();
  const [content, setContent] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchContent = async () => {
      const { data } = await supabase.from('platform_content').select('*');
      if (data) {
        const contentMap: Record<string, string> = {};
        data.forEach((item: PlatformContent) => {
           contentMap[item.key] = language === 'ca' ? item.ca : item.es;
        });
        setContent(contentMap);
      }
    };
    fetchContent();
  }, [language]);

  const heroTitle = content['home_hero_title'] || t('home_hero_title_default');
  const heroSubtitle = content['home_hero_subtitle'] || t('home_hero_subtitle_default');

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-50">
        <div className="text-2xl font-bold text-brand-600">Acme SaaS</div>
        <div className="flex items-center space-x-4">
          <LanguageSwitcher />
          <Link to="/login" className="text-gray-600 hover:text-gray-900">{t('login_nav')}</Link>
          <Link to="/signup" className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700">{t('start_cta')}</Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-6">{heroTitle}</h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          {heroSubtitle}
        </p>
        <div className="space-x-4">
          <Link to="/pricing" className="px-6 py-3 bg-white text-brand-600 border border-brand-200 rounded-md hover:bg-gray-50 text-lg">{t('pricing_nav')}</Link>
          <Link to="/signup" className="px-6 py-3 bg-brand-600 text-white rounded-md hover:bg-brand-700 text-lg">{t('start_cta')}</Link>
        </div>
      </main>
    </div>
  );
};

// --- Pages: Tenant Public Site (Web Cliente) ---

const TenantPublicSite = () => {
  const { slug } = useParams();
  const { language, t, memberships } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Check if current user is admin of this tenant
  const isAdmin = memberships.some(m => m.tenant?.slug === slug && ['owner', 'admin'].includes(m.role));

  useEffect(() => {
    const fetchTenantData = async () => {
      // 1. Get Tenant ID
      const { data: tenantData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (!tenantData) {
        setLoading(false); 
        return;
      }
      setTenant(tenantData);

      // 2. Get CMS Content
      const { data: cmsData } = await supabase.from('tenant_content').select('*').eq('tenant_id', tenantData.id);
      
      const contentMap: Record<string, string> = {};
      if (cmsData) {
        cmsData.forEach((item: TenantContent) => {
            contentMap[item.key] = language === 'ca' ? item.ca : item.es;
        });
      }
      setContent(contentMap);
      setLoading(false);
    };

    fetchTenantData();
  }, [slug, language]);

  if (loading) return <LoadingSpinner />;
  if (!tenant) return <div className="text-center py-20">Empresa no encontrada</div>;

  return (
    <div className={`min-h-screen bg-white relative ${isAdmin ? 'pt-14' : ''}`}>
       {/* Admin Overlay Bar (Fixed) */}
       {isAdmin && (
           <div className="fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white px-6 flex justify-between items-center z-[100] shadow-xl border-b border-gray-700">
               <div className="flex items-center gap-4">
                   <span className="bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border border-brand-500">Admin</span>
                   <span className="text-sm font-medium text-gray-300">{t('view_mode')}: <span className="text-white font-bold">{t('view_public')}</span></span>
               </div>
               <Link to={`/t/${slug}/dashboard`} className="flex items-center gap-2 bg-white text-gray-900 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-100 transition-transform transform hover:scale-105 shadow-sm">
                   <span>⚙️</span> {t('back_to_admin')}
               </Link>
           </div>
       )}

       <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
          <div className="font-bold text-xl uppercase tracking-wider">{tenant.name}</div>
          <div className="flex gap-4 items-center">
             <a href="#services" className="text-gray-600 hover:text-black">Servicios</a>
             <a href="#contact" className="text-gray-600 hover:text-black">Contacto</a>
             <LanguageSwitcher />
          </div>
       </header>

       <section className="bg-gray-50 py-24 px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{content['hero_title'] || `Bienvenido a ${tenant.name}`}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">{content['hero_desc'] || "Estamos aquí para servirte."}</p>
       </section>

       <section id="services" className="py-20 px-8 max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">{content['services_title'] || "Nuestros Servicios"}</h2>
          <div className="grid md:grid-cols-3 gap-8">
             <div className="p-6 border rounded-lg hover:shadow-lg transition">
                <h3 className="font-bold text-xl mb-2">{content['service_1_title'] || "Servicio 1"}</h3>
                <p className="text-gray-600">{content['service_1_desc'] || "Descripción del servicio..."}</p>
             </div>
             {/* More placeholders */}
          </div>
       </section>

       <section id="contact" className="bg-gray-900 text-white py-20 px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{content['contact_title'] || "Contáctanos"}</h2>
          <p className="mb-8 opacity-80">{content['contact_email'] || "contacto@empresa.com"}</p>
          <button className="px-6 py-3 bg-white text-gray-900 font-bold rounded">Enviar Mensaje</button>
       </section>

       <footer className="py-8 text-center text-sm text-gray-500 border-t">
          &copy; {new Date().getFullYear()} {tenant.name}. Powered by Acme SaaS.
       </footer>
    </div>
  )
}

// --- Pages: Auth ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshProfile, enterDemoMode, t } = useApp();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await refreshProfile();
      navigate('/');
    } else {
        alert(error.message);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border">
        <div className="flex justify-end mb-4"><LanguageSwitcher /></div>
        <h2 className="text-2xl font-bold mb-6 text-center">{t('login_title')}</h2>
        <form onSubmit={handleLogin}>
          <Input label={t('email')} type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label={t('password')} type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>{loading ? t('loading') : t('login_btn')}</Button>
        </form>
        
        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Demo</span></div>
        </div>
        <Button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} variant="secondary" className="w-full">{t('demo_mode')}</Button>
        
        <p className="mt-4 text-center text-sm text-gray-600">
          {t('no_account')} <Link to="/signup" className="text-brand-600 hover:underline">{t('signup_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const { t } = useApp();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (!error) navigate('/onboarding');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border">
        <div className="flex justify-end mb-4"><LanguageSwitcher /></div>
        <h2 className="text-2xl font-bold mb-6 text-center">{t('signup_title')}</h2>
        <form onSubmit={handleSignup}>
          <Input label={t('fullname')} value={fullName} onChange={(e: any) => setFullName(e.target.value)} required />
          <Input label={t('email')} type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label={t('password')} type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full">{t('signup_btn')}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {t('have_account')} <Link to="/login" className="text-brand-600 hover:underline">{t('login_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

// --- Tenant Admin Pages ---

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const currentMembership = memberships.find(m => m.tenant?.slug === slug);
  const currentTenant = currentMembership?.tenant;

  useEffect(() => {
    if (!loading && !currentMembership) {
      navigate('/onboarding');
    }
  }, [loading, currentMembership, navigate]);

  if (!currentTenant) return <LoadingSpinner />;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b h-16 flex items-center justify-between">
          <div className="font-bold text-lg truncate w-32">{currentTenant.name}</div>
          <LanguageSwitcher />
        </div>
        
        <div className="p-4 border-b">
           <label className="text-xs font-semibold text-gray-500 uppercase">{t('switch_team')}</label>
           <select 
             className="mt-1 w-full text-sm border-gray-300 rounded-md"
             value={slug}
             onChange={(e) => navigate(`/t/${e.target.value}/dashboard`)}
           >
             {memberships.map(m => (
               <option key={m.tenant_id} value={m.tenant?.slug}>{m.tenant?.name}</option>
             ))}
           </select>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link to={`/t/${slug}/dashboard`} className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('dashboard')}</Link>
          <Link to={`/t/${slug}/customers`} className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('customers')}</Link>
          <Link to={`/t/${slug}/quotes`} className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('quotes')}</Link>
          <Link to={`/t/${slug}/website`} className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('website')}</Link>
          <Link to={`/t/${slug}/settings`} className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('settings')}</Link>
        </nav>

        <div className="p-4 border-t">
          <button onClick={signOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md">{t('logout')}</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Main Header with View Switcher */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0 z-20 shadow-sm relative">
             <h2 className="text-xl font-bold capitalize text-gray-800">
                {t(location.pathname.split('/').filter(Boolean).pop() as any) || t('dashboard')}
             </h2>
             <div className="flex items-center gap-4">
                 {/* The Big Selector */}
                 <div className="bg-gray-100 p-1 rounded-full border border-gray-200 flex items-center">
                    <button className="px-4 py-1.5 bg-white text-gray-900 rounded-full shadow-sm text-sm font-bold cursor-default">
                        {t('view_admin')}
                    </button>
                    <Link 
                        to={`/c/${currentTenant.slug}`} 
                        className="px-4 py-1.5 text-gray-500 hover:text-brand-600 text-sm font-medium transition-colors"
                    >
                        {t('view_public')} ↗
                    </Link>
                 </div>

                 <div className="w-px h-6 bg-gray-300 mx-2"></div>

                 <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 hidden md:block">{profile?.full_name || 'User'}</span>
                    <div className="h-9 w-9 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold shadow-sm">
                        {profile?.full_name?.[0] || 'U'}
                    </div>
                 </div>
             </div>
        </header>

        <div className="flex-1 overflow-auto bg-gray-50 p-8">
           <Outlet context={{ tenant: currentTenant, membership: currentMembership }} />
        </div>
      </main>
    </div>
  );
};

const Dashboard = () => {
    const { t } = useApp();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-gray-500 text-sm font-medium">{t('total_revenue')}</h3>
        <p className="text-3xl font-bold mt-2">12.450 €</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-gray-500 text-sm font-medium">{t('active_quotes')}</h3>
        <p className="text-3xl font-bold mt-2">8</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-gray-500 text-sm font-medium">{t('total_customers')}</h3>
        <p className="text-3xl font-bold mt-2">24</p>
      </div>
    </div>
  );
};

const TenantWebsiteEditor = () => {
    const { tenant } = useOutletContext<{ tenant: Tenant }>();
    const { t, isDemoMode } = useApp();
    const [fields, setFields] = useState<any>({});
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        const load = async () => {
             const { data } = await supabase.from('tenant_content').select('*').eq('tenant_id', tenant.id);
             const initFields: any = {};
             if(data) {
                 data.forEach((row: any) => {
                     initFields[`${row.key}_es`] = row.es;
                     initFields[`${row.key}_ca`] = row.ca;
                 });
             }
             // Set Defaults if empty
             if(!initFields.hero_title_es) initFields.hero_title_es = `Bienvenido a ${tenant.name}`;
             setFields(initFields);
        }
        load();
    }, [tenant]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(isDemoMode) { alert(t('saved')); return; }
        setLoading(true);

        const updates = [
            { tenant_id: tenant.id, key: 'hero_title', es: fields.hero_title_es, ca: fields.hero_title_ca },
            { tenant_id: tenant.id, key: 'hero_desc', es: fields.hero_desc_es, ca: fields.hero_desc_ca },
            // Add other mappings as needed
        ];
        
        const { error } = await supabase.from('tenant_content').upsert(updates, { onConflict: 'tenant_id, key' });
        
        setLoading(false);
        if(error) alert('Error: ' + error.message);
        else alert(t('saved'));
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('manage_website')}</h2>
                <a href={`#/c/${tenant.slug}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline flex items-center gap-1">
                    {t('public_link')} ↗
                </a>
            </div>

            <form onSubmit={handleSave} className="space-y-8 bg-white p-6 rounded-lg border">
                
                {/* Hero Section */}
                <div>
                    <h3 className="font-bold text-lg mb-4 border-b pb-2">{t('hero_section')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ES {t('title')}</label>
                            <input className="w-full border p-2 rounded" value={fields.hero_title_es || ''} onChange={e => setFields({...fields, hero_title_es: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">CA {t('title')}</label>
                            <input className="w-full border p-2 rounded" value={fields.hero_title_ca || ''} onChange={e => setFields({...fields, hero_title_ca: e.target.value})} />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ES {t('description')}</label>
                            <textarea className="w-full border p-2 rounded" value={fields.hero_desc_es || ''} onChange={e => setFields({...fields, hero_desc_es: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">CA {t('description')}</label>
                            <textarea className="w-full border p-2 rounded" value={fields.hero_desc_ca || ''} onChange={e => setFields({...fields, hero_desc_ca: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button type="submit" disabled={loading}>{loading ? t('loading') : t('save')}</Button>
                </div>
            </form>
        </div>
    )
}

const Quotes = () => {
    const { tenant } = useOutletContext<{ tenant: Tenant }>();
    const { t } = useApp();
    // Simplified list...
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('quotes')}</h2>
                <Button>{t('new_quote')}</Button>
            </div>
            <div className="bg-white p-8 text-center text-gray-500 border rounded">
                Listado de presupuestos...
            </div>
        </div>
    )
}

const QuoteDetail = () => {
  const { id } = useParams();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, language } = useApp();
  // Using simplified mock for display, in real app fetch like before
  const quote = { id: id || '123', total: 1500, date: new Date().toISOString() };
  
  const handlePrint = () => window.print();

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-[800px] shadow-lg border p-8 print:shadow-none print:border-none">
      <div className="flex justify-between items-start mb-8 print:hidden">
        <Link to={`/t/${tenant.slug}/quotes`} className="text-gray-500 hover:text-gray-900">← {t('back')}</Link>
        <div className="space-x-2">
            <Link to={`/p/${quote.id}`} target="_blank">
                <Button variant="secondary">🔗 {t('view_as_client')}</Button>
            </Link>
            <Button onClick={handlePrint}>{t('download_pdf')}</Button>
        </div>
      </div>

      {/* PDF Content - Language Sensitive */}
      <div className="flex justify-between items-end border-b pb-8 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 uppercase">{t('quote_details')}</h1>
          <p className="text-gray-500 mt-1">#{quote.id.slice(0, 8)}</p>
        </div>
        <div className="text-right">
          <div className="font-bold text-xl">{tenant.name}</div>
          <div className="text-gray-500">{t('date')}: {formatDate(quote.date, language)}</div>
        </div>
      </div>

      {/* ... Table Items ... */}
      <div className="flex justify-end">
        <div className="w-64 border-t-2 border-gray-900 py-2 flex justify-between font-bold text-xl">
             <span>{t('total')}</span>
             <span>{formatCurrency(quote.total, language)}</span>
        </div>
      </div>
    </div>
  );
};

// --- Superadmin ---

const AdminDashboard = () => {
    const { t } = useApp();
    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">{t('admin_panel')}</h1>
                <LanguageSwitcher />
            </header>
            
            <div className="grid grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded shadow">
                    <h2 className="font-bold mb-4">CMS: Web Principal</h2>
                    <p className="text-sm text-gray-500 mb-4">Edita los textos de la landing page.</p>
                    <div className="space-y-4">
                        <Input label="Hero Title (ES)" defaultValue="Gestiona tu negocio..." />
                        <Input label="Hero Title (CA)" defaultValue="Gestiona el teu negoci..." />
                        <Button>Guardar Cambios</Button>
                    </div>
                </div>
                <div className="bg-white p-6 rounded shadow">
                    <h2 className="font-bold mb-4">Estadísticas Globales</h2>
                    <div className="space-y-2">
                        <div className="flex justify-between"><span>Empresas activas:</span> <strong>12</strong></div>
                        <div className="flex justify-between"><span>Usuarios totales:</span> <strong>45</strong></div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- App Root ---

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [language, setLanguageState] = useState<Language>('es');

  // Load language preference
  useEffect(() => {
    const saved = localStorage.getItem('app_lang') as Language;
    if (saved) setLanguageState(saved);
  }, []);

  const setLanguage = (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem('app_lang', lang);
  }

  const t_func = (key: keyof typeof translations['es']) => {
      return translations[language][key] || key;
  }

  // ... (Auth Logic similar to previous version, omitted for brevity but assumed present) ...
  // Mocking auth load for brevity in this specific output block
  useEffect(() => {
     supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
     });
  }, []);

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setSession({ user: { id: 'demo' } } as any);
    setProfile({ id: 'demo', email: 'demo@demo.com', is_superadmin: false });
    setMemberships([{ 
        id: 'm1', user_id: 'demo', tenant_id: 't1', role: 'owner', 
        tenant: { id: 't1', name: 'Demo Corp', slug: 'demo', plan: 'pro', created_at: '' } 
    }]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AppContext.Provider value={{ 
        session, profile, memberships, loading, isDemoMode, language, setLanguage, 
        t: t_func,
        refreshProfile: async () => {}, signOut: async () => { setSession(null) }, enterDemoMode 
    }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Tenant Public Site */}
          <Route path="/c/:slug" element={<TenantPublicSite />} />
          
          {/* Public Quote */}
          <Route path="/p/:id" element={<QuoteDetail />} /> {/* Reusing component for simplicity, typically separate */}

          <Route path="/onboarding" element={<div>Onboarding...</div>} />

          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteDetail />} />
            <Route path="website" element={<TenantWebsiteEditor />} />
            {/* ... other routes ... */}
          </Route>

          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}