import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { supabase, isConfigured, SUPABASE_URL } from './supabaseClient';
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

const AlertConfigMissing = () => (
  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
    <span className="text-xl text-amber-500">⚠️</span>
    <div className="text-xs text-amber-800 leading-relaxed">
      <p className="font-bold mb-1">Configuración pendiente</p>
      <p>Has añadido las variables en Vercel, pero debes hacer un <strong>Redeploy</strong> desde el panel para que el código las reconozca.</p>
    </div>
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
      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm" 
      {...props} 
    />
  </div>
);

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg text-[10px] font-black">
      <button 
        onClick={() => setLanguage('es')} 
        className={`px-3 py-1.5 rounded-md transition-all ${language === 'es' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
      >
        ES
      </button>
      <button 
        onClick={() => setLanguage('ca')} 
        className={`px-3 py-1.5 rounded-md transition-all ${language === 'ca' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
      >
        CA
      </button>
    </div>
  );
};

// --- Pages: Platform Public ---

const Landing = () => {
  const { t, language, session, memberships } = useApp();
  const [content, setContent] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isConfigured) return;
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

  const dashboardLink = memberships.length > 0 
    ? `/t/${memberships[0].tenant?.slug}/dashboard` 
    : '/onboarding';

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-8 py-5 border-b sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="text-2xl font-black text-brand-600 tracking-tighter">ACME<span className="text-gray-900">SAAS</span></div>
        <div className="flex items-center space-x-6">
          <LanguageSwitcher />
          {session ? (
              <Link to={dashboardLink} className="text-sm font-bold text-brand-600 hover:underline">{t('dashboard')}</Link>
          ) : (
              <>
                  <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-brand-600 transition-colors">{t('login_nav')}</Link>
                  <Link to="/signup" className="px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-full hover:bg-brand-700 shadow-md hover:shadow-lg transition-all">{t('start_cta')}</Link>
              </>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-32 text-center">
        {!isConfigured && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-xs font-bold rounded-full mb-10 border border-amber-100 shadow-sm animate-pulse">
            <span>⚠️</span> {t('demo_mode')} disponible (Variables no detectadas)
          </div>
        )}
        <h1 className="text-6xl font-black text-gray-900 mb-8 tracking-tight leading-tight">{heroTitle}</h1>
        <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
          {heroSubtitle}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to={session ? dashboardLink : "/signup"} className="w-full sm:w-auto px-8 py-4 bg-brand-600 text-white rounded-full hover:bg-brand-700 text-lg font-bold shadow-xl transition-all transform hover:-translate-y-1">
              {session ? t('dashboard') : t('start_cta')}
          </Link>
          <Link to="/pricing" className="w-full sm:w-auto px-8 py-4 bg-white text-brand-600 border-2 border-brand-100 rounded-full hover:border-brand-500 text-lg font-bold transition-all">{t('pricing_nav')}</Link>
        </div>
      </main>
    </div>
  );
};

// --- Onboarding Component ---

const Onboarding = () => {
    const { t, session, refreshProfile, memberships } = useApp();
    const navigate = useNavigate();
    const [companyName, setCompanyName] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (memberships.length > 0) {
            navigate(`/t/${memberships[0].tenant?.slug}/dashboard`);
        }
    }, [memberships, navigate]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !companyName || !slug) return;
        setLoading(true);

        try {
            const finalSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
            
            const { data: tenant, error: tError } = await supabase
                .from('tenants')
                .insert([{ name: companyName, slug: finalSlug }])
                .select()
                .single();

            if (tError) throw tError;

            const { error: mError } = await supabase
                .from('memberships')
                .insert([{ 
                    user_id: session.user.id, 
                    tenant_id: tenant.id, 
                    role: 'owner' 
                }]);

            if (mError) throw mError;

            await refreshProfile();
            navigate(`/t/${finalSlug}/dashboard`);
        } catch (error: any) {
            alert(error.message || "Error al crear la empresa. ¿Quizás el slug ya existe?");
        } finally {
            setLoading(false);
        }
    };

    const handleNameChange = (val: string) => {
        setCompanyName(val);
        setSlug(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
                <h2 className="text-3xl font-black mb-2 text-center text-gray-900 tracking-tight">{t('onboarding_title')}</h2>
                <p className="text-gray-500 text-center mb-8 text-sm font-medium leading-relaxed">{t('onboarding_subtitle')}</p>
                
                <form onSubmit={handleCreate} className="space-y-6">
                    <Input 
                        label={t('company_name')} 
                        value={companyName} 
                        onChange={(e: any) => handleNameChange(e.target.value)} 
                        placeholder="Ej: Mi Empresa S.L." 
                        required 
                    />
                    <div>
                        <Input 
                            label={t('company_slug')} 
                            value={slug} 
                            onChange={(e: any) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
                            placeholder="mi-empresa" 
                            required 
                        />
                        <p className="mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                            {t('slug_hint')}<span className="text-brand-600 underline font-black">{slug || '...'}</span>
                        </p>
                    </div>
                    
                    <Button type="submit" className="w-full py-4 text-lg shadow-lg shadow-brand-100" disabled={loading}>
                        {loading ? t('loading') : t('create_company_btn')}
                    </Button>
                </form>
            </div>
        </div>
    );
};

// --- Tenant Admin Layout ---

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile, session, isDemoMode } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const currentMembership = memberships.find(m => m.tenant?.slug === slug);
  const currentTenant = currentMembership?.tenant;

  useEffect(() => {
    if (!loading) {
        if (!session) navigate('/login');
        else if (memberships.length === 0 && location.pathname !== '/onboarding') navigate('/onboarding');
        else if (!currentMembership && memberships.length > 0) navigate(`/t/${memberships[0].tenant?.slug}/dashboard`);
    }
  }, [loading, session, memberships, currentMembership, navigate, location]);

  if (loading) return <LoadingSpinner />;
  if (!currentTenant) return null;

  const isActive = (path: string) => location.pathname.includes(path);

  // Inicial dinámica: Prioridad Nombre -> Email -> "U"
  const userInitial = (profile?.full_name?.[0] || session?.user?.email?.[0] || 'U').toUpperCase();
  const userName = profile?.full_name || session?.user?.email?.split('@')[0] || 'Usuario';

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden">
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shrink-0 z-30 shadow-sm">
        <div className="p-6 border-b h-20 flex items-center justify-between">
          <div className="font-black text-xl truncate text-brand-600 tracking-tighter uppercase">{currentTenant.name}</div>
        </div>
        
        <div className="p-4 bg-brand-50 mx-4 mt-6 rounded-2xl">
           <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{t('switch_team')}</label>
           <select 
             className="mt-1 w-full text-sm bg-transparent border-none font-bold text-gray-800 focus:ring-0 p-0 cursor-pointer"
             value={slug}
             onChange={(e) => navigate(`/t/${e.target.value}/dashboard`)}
           >
             {memberships.map(m => (
               <option key={m.tenant_id} value={m.tenant?.slug}>{m.tenant?.name}</option>
             ))}
           </select>
        </div>

        <nav className="flex-1 p-6 space-y-2 mt-4 overflow-y-auto">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span className="text-lg">📊</span> {t('dashboard')}
          </Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('customers') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span className="text-lg">👥</span> {t('customers')}
          </Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('quotes') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span className="text-lg">📄</span> {t('quotes')}
          </Link>
          <Link to={`/t/${slug}/website`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('website') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span className="text-lg">🌐</span> {t('website')}
          </Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive('settings') ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-600'}`}>
            <span className="text-lg">⚙️</span> {t('settings')}
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
                 <div className="bg-gray-100 p-1 rounded-full flex items-center shadow-inner">
                    <button className="px-5 py-2 bg-white text-brand-600 rounded-full shadow-sm text-[10px] font-black uppercase tracking-wider">
                        {t('view_admin')}
                    </button>
                    <Link 
                        to={`/c/${currentTenant.slug}`} 
                        target="_blank"
                        className="px-5 py-2 text-gray-400 hover:text-brand-600 text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                        {t('view_public')} ↗
                    </Link>
                 </div>

                 <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100 relative group">
                    <div className="h-10 w-10 bg-brand-600 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-brand-100 uppercase relative">
                        {userInitial}
                        <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isDemoMode ? 'bg-amber-500' : 'bg-green-500'} shadow-sm`}></div>
                    </div>
                    <div className="hidden md:block">
                        <div className="flex items-center gap-2">
                           <div className="text-sm font-black text-gray-900 leading-none truncate max-w-[120px]">{userName}</div>
                           <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border ${isDemoMode ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                               {isDemoMode ? 'DEMO' : 'LIVE'}
                           </span>
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{currentMembership?.role || 'User'}</div>
                    </div>
                 </div>
             </div>
        </header>

        <div className="flex-1 overflow-auto p-10 bg-gray-50/50">
           <Outlet context={{ tenant: currentTenant, membership: currentMembership }} />
        </div>
      </main>
    </div>
  );
};

// --- Auth Components ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshProfile, enterDemoMode, t } = useApp();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
        alert("Configuración no detectada en el código. Si acabas de añadir las variables en Vercel, haz un 'Redeploy' del proyecto.");
        return;
    }
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
            <Link to="/" className="font-black text-brand-600 tracking-tighter">← ACME</Link>
            <LanguageSwitcher />
        </div>
        <h2 className="text-3xl font-black mb-8 text-center text-gray-900 tracking-tight">{t('login_title')}</h2>
        
        {!isConfigured && <AlertConfigMissing />}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input label={t('email')} type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required placeholder="ejemplo@correo.com" />
          <Input label={t('password')} type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full py-3 text-lg" disabled={loading || !isConfigured}>{loading ? t('loading') : t('login_btn')}</Button>
        </form>
        
        <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="px-3 bg-white text-gray-400">O pruébalo gratis</span></div>
        </div>
        <Button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} variant="secondary" className="w-full py-3 font-bold border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-600 transition-all">
            🚀 {t('demo_mode')}
        </Button>
        
        <p className="mt-8 text-center text-sm text-gray-500 font-medium">
          {t('no_account')} <Link to="/signup" className="text-brand-600 font-bold hover:underline">{t('signup_btn')}</Link>
        </p>
      </div>
    </div>
  );
};

// ... Resto del componente App igual ...

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
    </div>
  );
};

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
      return (translations[language] as any)[key] || key;
  }

  const fetchProfileData = async (userId: string) => {
    if (!isConfigured || userId === 'demo') return;
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
    if (!isConfigured) {
        setLoading(false);
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) {
            fetchProfileData(session.user.id).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }).catch(err => {
        setLoading(false);
    });

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
    if (session && session.user.id !== 'demo') await fetchProfileData(session.user.id);
  };

  const signOut = async () => {
    if (isConfigured) await supabase.auth.signOut();
    setIsDemoMode(false);
    setSession(null);
    setProfile(null);
    setMemberships([]);
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setSession({ user: { id: 'demo', email: 'demo@demo.com' } } as any);
    setProfile({ id: 'demo', email: 'demo@demo.com', is_superadmin: false, full_name: 'Usuario Demo' });
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
          <Route path="/signup" element={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Link to="/login" className="text-brand-600 font-bold">Volver al Login</Link></div>} />
          <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="*" element={<div className="bg-white p-20 rounded-3xl border text-center text-gray-300 font-bold">Próximamente</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}