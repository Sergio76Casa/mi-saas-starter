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

const AppContext = createContext<AppContextType | null>(null);

const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

// --- Components ---

const LoadingSpinner = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
    <p className="mt-4 text-gray-500 font-medium animate-pulse">Cargando plataforma...</p>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }: any) => {
  const base = "px-4 py-2 rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95";
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 shadow-sm",
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
      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all" 
      {...props} 
    />
  </div>
);

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg text-xs font-bold">
      <button 
        onClick={() => setLanguage('es')} 
        className={`px-3 py-1.5 rounded-md transition-all ${language === 'es' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
      >
        ES
      </button>
      <button 
        onClick={() => setLanguage('ca')} 
        className={`px-3 py-1.5 rounded-md transition-all ${language === 'ca' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
      >
        CA
      </button>
    </div>
  );
};

// --- Pages: Platform Public ---

const Landing = () => {
  const { t, language } = useApp();
  const [content, setContent] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data } = await supabase.from('platform_content').select('*');
        if (data) {
          const contentMap: Record<string, string> = {};
          data.forEach((item: PlatformContent) => {
             contentMap[item.key] = language === 'ca' ? item.ca : item.es;
          });
          setContent(contentMap);
        }
      } catch (e) {
        console.error("Error loading platform content", e);
      }
    };
    fetchContent();
  }, [language]);

  const heroTitle = content['home_hero_title'] || t('home_hero_title_default');
  const heroSubtitle = content['home_hero_subtitle'] || t('home_hero_subtitle_default');

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-8 py-5 border-b sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="text-2xl font-black text-brand-600 tracking-tighter">ACME<span className="text-gray-900">SAAS</span></div>
        <div className="flex items-center space-x-6">
          <LanguageSwitcher />
          <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-brand-600 transition-colors">{t('login_nav')}</Link>
          <Link to="/signup" className="px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-full hover:bg-brand-700 shadow-md hover:shadow-lg transition-all">{t('start_cta')}</Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-32 text-center">
        <h1 className="text-6xl font-black text-gray-900 mb-8 tracking-tight leading-tight">{heroTitle}</h1>
        <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
          {heroSubtitle}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-brand-600 text-white rounded-full hover:bg-brand-700 text-lg font-bold shadow-xl transition-all transform hover:-translate-y-1">{t('start_cta')}</Link>
          <Link to="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white text-brand-600 border-2 border-brand-100 rounded-full hover:border-brand-500 text-lg font-bold transition-all">{t('pricing_nav')}</Link>
        </div>
      </main>
    </div>
  );
};

// --- Tenant Public Site (Customer Web) ---

const TenantPublicSite = () => {
  const { slug } = useParams();
  const { language, t, memberships } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const isAdmin = memberships.some(m => m.tenant?.slug === slug && ['owner', 'admin'].includes(m.role));

  useEffect(() => {
    const fetchTenantData = async () => {
      setLoading(true);
      const { data: tenantData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (!tenantData) {
        setLoading(false); 
        return;
      }
      setTenant(tenantData);

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
  if (!tenant) return <div className="min-h-screen flex items-center justify-center">Empresa no encontrada</div>;

  return (
    <div className={`min-h-screen bg-white relative ${isAdmin ? 'pt-14' : ''}`}>
       {isAdmin && (
           <div className="fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white px-6 flex justify-between items-center z-[100] shadow-xl border-b border-gray-700">
               <div className="flex items-center gap-4">
                   <span className="bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border border-brand-500 animate-pulse">Admin</span>
                   <span className="text-sm font-medium text-gray-300">{t('view_mode')}: <span className="text-white font-bold">{t('view_public')}</span></span>
               </div>
               <Link to={`/t/${slug}/dashboard`} className="flex items-center gap-2 bg-white text-gray-900 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-100 transition-all shadow-sm">
                   <span>⚙️</span> {t('back_to_admin')}
               </Link>
           </div>
       )}

       <header className="bg-white border-b px-8 py-5 flex justify-between items-center sticky top-0 z-40">
          <div className="font-black text-2xl uppercase tracking-tighter text-gray-900">{tenant.name}</div>
          <div className="flex gap-6 items-center text-sm font-bold">
             <a href="#services" className="text-gray-500 hover:text-brand-600 transition-colors">Servicios</a>
             <a href="#contact" className="text-gray-500 hover:text-brand-600 transition-colors">Contacto</a>
             <LanguageSwitcher />
          </div>
       </header>

       <section className="bg-gradient-to-b from-brand-50 to-white py-32 px-8 text-center">
          <h1 className="text-5xl font-black mb-6 text-gray-900 tracking-tight">{content['hero_title'] || `Bienvenido a ${tenant.name}`}</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">{content['hero_desc'] || "Soluciones profesionales adaptadas a tus necesidades."}</p>
       </section>

       <section id="services" className="py-24 px-8 max-w-6xl mx-auto">
          <h2 className="text-3xl font-black mb-12 text-center text-gray-900">{content['services_title'] || "Nuestros Servicios"}</h2>
          <div className="grid md:grid-cols-3 gap-8">
             {[1, 2, 3].map(i => (
                <div key={i} className="p-8 border-2 border-gray-50 rounded-2xl hover:border-brand-200 hover:shadow-xl transition-all group">
                   <div className="w-12 h-12 bg-brand-100 rounded-xl mb-6 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">✨</div>
                   <h3 className="font-bold text-xl mb-3 text-gray-900">{content[`service_${i}_title`] || `Servicio Profesional ${i}`}</h3>
                   <p className="text-gray-600 text-sm leading-relaxed">{content[`service_${i}_desc`] || "Ofrecemos la mejor calidad en cada detalle de nuestro trabajo diario."}</p>
                </div>
             ))}
          </div>
       </section>

       <footer className="bg-gray-900 text-white py-12 px-8 text-center">
          <div className="font-black text-xl mb-4 uppercase">{tenant.name}</div>
          <p className="opacity-50 text-sm mb-8">© {new Date().getFullYear()} - Todos los derechos reservados.</p>
          <div className="flex justify-center gap-6">
             <a href="#" className="hover:text-brand-500 transition-colors text-sm font-bold">Aviso Legal</a>
             <a href="#" className="hover:text-brand-500 transition-colors text-sm font-bold">Privacidad</a>
          </div>
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
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        <div className="flex justify-between items-center mb-8">
            <Link to="/" className="font-black text-brand-600">← HOME</Link>
            <LanguageSwitcher />
        </div>
        <h2 className="text-3xl font-black mb-8 text-center text-gray-900 tracking-tight">{t('login_title')}</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input label={t('email')} type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required placeholder="ejemplo@correo.com" />
          <Input label={t('password')} type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full py-3 text-lg" disabled={loading}>{loading ? t('loading') : t('login_btn')}</Button>
        </form>
        
        <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest"><span className="px-3 bg-white text-gray-400">O pruébalo gratis</span></div>
        </div>
        <Button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} variant="secondary" className="w-full py-3">{t('demo_mode')}</Button>
        
        <p className="mt-8 text-center text-sm text-gray-500 font-medium">
          {t('no_account')} <Link to="/signup" className="text-brand-600 font-bold hover:underline">{t('signup_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useApp();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (!error) {
        alert("¡Cuenta creada! Revisa tu email para confirmar.");
        navigate('/login');
    } else {
        alert(error.message);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        <div className="flex justify-between items-center mb-8">
            <Link to="/" className="font-black text-brand-600">← HOME</Link>
            <LanguageSwitcher />
        </div>
        <h2 className="text-3xl font-black mb-8 text-center text-gray-900 tracking-tight">{t('signup_title')}</h2>
        <form onSubmit={handleSignup} className="space-y-4">
          <Input label={t('fullname')} value={fullName} onChange={(e: any) => setFullName(e.target.value)} required />
          <Input label={t('email')} type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label={t('password')} type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full py-3 text-lg" disabled={loading}>{loading ? t('loading') : t('signup_btn')}</Button>
        </form>
        <p className="mt-8 text-center text-sm text-gray-500 font-medium">
          {t('have_account')} <Link to="/login" className="text-brand-600 font-bold hover:underline">{t('login_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

// --- Tenant Admin Layout ---

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const currentMembership = memberships.find(m => m.tenant?.slug === slug);
  const currentTenant = currentMembership?.tenant;

  useEffect(() => {
    if (!loading && !currentMembership) {
      navigate('/');
    }
  }, [loading, currentMembership, navigate]);

  if (loading) return <LoadingSpinner />;
  if (!currentTenant) return null;

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden">
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shrink-0 z-30 shadow-sm">
        <div className="p-6 border-b h-20 flex items-center justify-between">
          <div className="font-black text-xl truncate text-brand-600">{currentTenant.name}</div>
        </div>
        
        <div className="p-4 bg-brand-50 mx-4 mt-6 rounded-2xl">
           <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{t('switch_team')}</label>
           <select 
             className="mt-1 w-full text-sm bg-transparent border-none font-bold text-gray-800 focus:ring-0 p-0"
             value={slug}
             onChange={(e) => navigate(`/t/${e.target.value}/dashboard`)}
           >
             {memberships.map(m => (
               <option key={m.tenant_id} value={m.tenant?.slug}>{m.tenant?.name}</option>
             ))}
           </select>
        </div>

        <nav className="flex-1 p-6 space-y-2 mt-4">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span>📊</span> {t('dashboard')}
          </Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('customers') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span>👥</span> {t('customers')}
          </Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('quotes') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span>📄</span> {t('quotes')}
          </Link>
          <Link to={`/t/${slug}/website`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('website') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span>🌐</span> {t('website')}
          </Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('settings') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span>⚙️</span> {t('settings')}
          </Link>
        </nav>

        <div className="p-6 border-t border-gray-50">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <span>🚪</span> {t('logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-10 shrink-0 z-20 shadow-sm">
             <h2 className="text-xl font-black text-gray-900 capitalize tracking-tight">
                {t(location.pathname.split('/').filter(Boolean).pop() as any) || t('dashboard')}
             </h2>
             <div className="flex items-center gap-6">
                 <div className="bg-gray-100 p-1.5 rounded-full flex items-center shadow-inner">
                    <button className="px-6 py-2 bg-white text-brand-600 rounded-full shadow-md text-xs font-black uppercase tracking-wider">
                        {t('view_admin')}
                    </button>
                    <Link 
                        to={`/c/${currentTenant.slug}`} 
                        target="_blank"
                        className="px-6 py-2 text-gray-400 hover:text-brand-600 text-xs font-black uppercase tracking-wider transition-all"
                    >
                        {t('view_public')} ↗
                    </Link>
                 </div>

                 <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                    <div className="h-10 w-10 bg-brand-600 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-brand-100">
                        {profile?.full_name?.[0] || 'U'}
                    </div>
                    <div className="hidden md:block">
                        <div className="text-sm font-black text-gray-900 leading-none">{profile?.full_name || 'Usuario'}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{currentMembership?.role}</div>
                    </div>
                 </div>
             </div>
        </header>

        <div className="flex-1 overflow-auto p-10">
           <Outlet context={{ tenant: currentTenant, membership: currentMembership }} />
        </div>
      </main>
    </div>
  );
};

const Dashboard = () => {
    const { t } = useApp();
  return (
    <div className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-50 hover:shadow-xl transition-all group">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">💰</div>
            <h3 className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('total_revenue')}</h3>
            <p className="text-4xl font-black mt-2 text-gray-900 tracking-tighter">12.450 €</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-50 hover:shadow-xl transition-all group">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">⏳</div>
            <h3 className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('active_quotes')}</h3>
            <p className="text-4xl font-black mt-2 text-gray-900 tracking-tighter">8</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-50 hover:shadow-xl transition-all group">
            <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">👥</div>
            <h3 className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('total_customers')}</h3>
            <p className="text-4xl font-black mt-2 text-gray-900 tracking-tighter">24</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black mb-6 tracking-tight">Actividad Reciente</h3>
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-gray-100 rounded-full"></div>
                            <div>
                                <div className="font-bold text-gray-900">Presupuesto #PR-2024-00{i}</div>
                                <div className="text-xs text-gray-500">Cliente Ejemplo S.A.</div>
                            </div>
                        </div>
                        <div className="text-sm font-bold text-brand-600">+450,00 €</div>
                    </div>
                ))}
            </div>
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
        ];
        
        const { error } = await supabase.from('tenant_content').upsert(updates, { onConflict: 'tenant_id, key' });
        
        setLoading(false);
        if(error) alert('Error: ' + error.message);
        else alert(t('saved'));
    }

    return (
        <div className="max-w-4xl">
            <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black tracking-tight text-gray-900">{t('manage_website')}</h2>
                <a href={`#/c/${tenant.slug}`} target="_blank" rel="noreferrer" className="px-6 py-2 bg-brand-50 text-brand-600 rounded-full font-bold hover:bg-brand-100 transition-all">
                    {t('public_link')} ↗
                </a>
            </div>

            <form onSubmit={handleSave} className="space-y-10 bg-white p-10 rounded-3xl border border-gray-100 shadow-xl">
                <div>
                    <h3 className="font-black text-xl mb-6 text-gray-900 border-b pb-4 border-gray-50 tracking-tight">{t('hero_section')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">ES {t('title')}</label>
                            <input className="w-full border-2 border-gray-50 bg-gray-50 p-3 rounded-xl font-bold focus:bg-white focus:border-brand-500 transition-all outline-none" value={fields.hero_title_es || ''} onChange={e => setFields({...fields, hero_title_es: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">CA {t('title')}</label>
                            <input className="w-full border-2 border-gray-50 bg-gray-50 p-3 rounded-xl font-bold focus:bg-white focus:border-brand-500 transition-all outline-none" value={fields.hero_title_ca || ''} onChange={e => setFields({...fields, hero_title_ca: e.target.value})} />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">ES {t('description')}</label>
                            <textarea rows={4} className="w-full border-2 border-gray-50 bg-gray-50 p-3 rounded-xl font-bold focus:bg-white focus:border-brand-500 transition-all outline-none" value={fields.hero_desc_es || ''} onChange={e => setFields({...fields, hero_desc_es: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">CA {t('description')}</label>
                            <textarea rows={4} className="w-full border-2 border-gray-50 bg-gray-50 p-3 rounded-xl font-bold focus:bg-white focus:border-brand-500 transition-all outline-none" value={fields.hero_desc_ca || ''} onChange={e => setFields({...fields, hero_desc_ca: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6">
                    <Button type="submit" className="px-10 py-4 text-lg shadow-xl shadow-brand-100" disabled={loading}>{loading ? t('loading') : t('save')}</Button>
                </div>
            </form>
        </div>
    )
}

// --- App Root Provider ---

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [language, setLanguageState] = useState<Language>('es');

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

  const fetchProfileData = async (userId: string) => {
    try {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (profileData) setProfile(profileData);

        const { data: membershipData } = await supabase.from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId);
        if (membershipData) setMemberships(membershipData as any);
    } catch (e) {
        console.error("Error fetching user data", e);
    }
  };

  useEffect(() => {
    // 1. Check Initial Session
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) {
            fetchProfileData(session.user.id).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }).catch(err => {
        console.error("Auth error", err);
        setLoading(false);
    });

    // 2. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) {
            fetchProfileData(session.user.id);
        } else {
            setProfile(null);
            setMemberships([]);
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (session) await fetchProfileData(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsDemoMode(false);
    setSession(null);
    setProfile(null);
    setMemberships([]);
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setSession({ user: { id: 'demo' } } as any);
    setProfile({ id: 'demo', email: 'demo@demo.com', is_superadmin: false, full_name: 'Demo User' });
    setMemberships([{ 
        id: 'm1', user_id: 'demo', tenant_id: 't1', role: 'owner', 
        tenant: { id: 't1', name: 'Demo Corp', slug: 'demo', plan: 'pro', created_at: '' } 
    }]);
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AppContext.Provider value={{ 
        session, profile, memberships, loading, isDemoMode, language, setLanguage, 
        t: t_func,
        refreshProfile, signOut, enterDemoMode 
    }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route path="/c/:slug" element={<TenantPublicSite />} />
          
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="website" element={<TenantWebsiteEditor />} />
            <Route path="customers" element={<div className="bg-white p-10 rounded-3xl border text-center text-gray-400 font-bold">Módulo de Clientes Próximamente</div>} />
            <Route path="quotes" element={<div className="bg-white p-10 rounded-3xl border text-center text-gray-400 font-bold">Módulo de Presupuestos Próximamente</div>} />
            <Route path="settings" element={<div className="bg-white p-10 rounded-3xl border text-center text-gray-400 font-bold">Configuración del Perfil</div>} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}