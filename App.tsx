import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase, isConfigured, SUPABASE_URL, saveManualConfig, clearManualConfig } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, QuoteItem, Language, PlatformContent } from './types';
import { translations, formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';

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
    <p className="mt-6 text-gray-500 font-black uppercase tracking-widest text-[10px] animate-pulse italic">Conectando con la infraestructura...</p>
  </div>
);

const ConnectionStatusBadge = () => {
  const { dbHealthy } = useApp();
  
  if (!isConfigured) return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-200">
      ⚠️ Error de Configuración
    </div>
  );

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border shadow-sm ${dbHealthy ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
      <span className="relative flex h-2 w-2">
        {dbHealthy && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dbHealthy ? 'bg-green-500' : 'bg-amber-500'}`}></span>
      </span>
      {dbHealthy ? 'Supabase Online' : 'Conectando...'}
    </div>
  );
};

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex bg-gray-100 p-1 rounded-xl">
      <button 
        onClick={() => setLanguage('es')} 
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'es' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
      >
        ES
      </button>
      <button 
        onClick={() => setLanguage('ca')} 
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'ca' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
      >
        CA
      </button>
    </div>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="mb-4 text-left">
    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">{label}</label>
    <input className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm bg-gray-50/50 placeholder:text-gray-300" {...props} />
  </div>
);

const SuperAdminFloatingBar = () => {
  const { profile } = useApp();
  if (!profile?.is_superadmin) return null;
  
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <Link to="/admin/dashboard" className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-full shadow-2xl border border-white/10 hover:scale-105 transition-all group">
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Acceder a Administración Central</span>
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </Link>
    </div>
  );
};

// --- SuperAdmin Components ---

const AdminLayout = () => {
  const { profile, signOut, t, loading } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && (!profile || !profile.is_superadmin)) {
      navigate('/');
    }
  }, [profile, loading, navigate]);

  if (loading || !profile?.is_superadmin) return <LoadingSpinner />;

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex min-h-screen bg-[#050505] text-slate-100 font-sans">
      <aside className="w-72 bg-slate-900/40 backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0">
        <div className="p-8 h-24 flex items-center">
          <div className="font-black text-2xl tracking-tighter text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg shadow-lg flex items-center justify-center text-xs">S</div>
            SYSTEM<span className="text-brand-500">ADMIN</span>
          </div>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          <Link to="/admin/dashboard" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-2xl shadow-brand-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            <span>📊</span> Dashboard
          </Link>
          <Link to="/admin/cms" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive('cms') ? 'bg-brand-600 text-white shadow-2xl shadow-brand-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            <span>📝</span> Platform CMS
          </Link>
          <Link to="/admin/tenants" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive('tenants') ? 'bg-brand-600 text-white shadow-2xl shadow-brand-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            <span>🏢</span> Tenants/Empresas
          </Link>
        </nav>
        <div className="p-6 border-t border-white/5">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-400/10 rounded-2xl transition-all">
            <span>🚪</span> {t('logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-10 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-white tracking-tight">SuperAdmin Panel</h2>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Servidor Online</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-[10px] font-black text-slate-400 hover:text-brand-500 uppercase tracking-widest transition-colors">Web Pública ↗</Link>
            <div className="h-12 w-12 bg-gradient-to-tr from-brand-600 to-brand-400 text-white rounded-2xl flex items-center justify-center font-black shadow-xl text-sm">SA</div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const AdminDashboard = () => {
  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[
          { label: 'Total Tenants', val: '24', icon: '🏢' },
          { label: 'Usuarios Activos', val: '1,2k', icon: '👥' },
          { label: 'Ingresos MRR', val: '8.450€', icon: '💰' },
          { label: 'Uptime', val: '99.9%', icon: '⚡' },
        ].map((s, i) => (
          <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-white/10 transition-all">
            <div className="absolute -right-6 -bottom-6 text-8xl opacity-5 group-hover:scale-110 transition-all">{s.icon}</div>
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">{s.label}</div>
            <div className="text-4xl font-black text-white tracking-tighter">{s.val}</div>
          </div>
        ))}
      </div>
      <div className="bg-brand-600/10 border border-brand-500/20 rounded-[2.5rem] p-10">
        <h3 className="text-xs font-black text-brand-500 uppercase tracking-widest mb-4">¡Bienvenido Jefe!</h3>
        <p className="text-sm text-slate-300 leading-relaxed font-medium">
          Desde aquí puedes controlar cada aspecto de la plataforma. Usa la sección **CMS** para cambiar los textos de la landing 
          o **Tenants** para crear y gestionar empresas individuales.
        </p>
      </div>
    </div>
  );
};

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'free' });
  const { dbHealthy } = useApp();

  const fetchTenants = async () => {
    if (!dbHealthy) return;
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) setTenants(data as any);
  };

  useEffect(() => { fetchTenants(); }, [dbHealthy]);

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug) return alert("Rellena nombre y slug");
    const { error } = await supabase.from('tenants').insert([newTenant]);
    if (error) alert("Error: " + error.message);
    else {
      setIsCreating(false);
      setNewTenant({ name: '', slug: '', plan: 'free' });
      fetchTenants();
      alert("¡Tenant creado con éxito!");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black text-white tracking-tight">Directorio de Empresas</h3>
        <button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg">+ Registrar Empresa</button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
              <h4 className="text-xl font-black text-white mb-6">Nuevo Registro</h4>
              <div className="space-y-4">
                 <input placeholder="Nombre de Empresa" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} />
                 <input placeholder="url-personalizada" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/ /g, '-')})} />
                 <select className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.plan} onChange={e => setNewTenant({...newTenant, plan: e.target.value as any})}>
                    <option value="free">Plan Free</option>
                    <option value="pro">Plan Pro</option>
                    <option value="enterprise">Enterprise</option>
                 </select>
              </div>
              <div className="flex gap-4 mt-10">
                 <button onClick={handleCreateTenant} className="flex-1 py-4 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase">Crear Empresa</button>
                 <button onClick={() => setIsCreating(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase">Cerrar</button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Empresa</th>
              <th className="px-10 py-6">Licencia</th>
              <th className="px-10 py-6 text-right">Acceso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-10 py-6">
                   <div className="font-black text-white">{t.name}</div>
                   <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">/{t.slug}</div>
                </td>
                <td className="px-10 py-6">
                   <span className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-full border ${t.plan === 'pro' ? 'bg-brand-500/10 text-brand-500 border-brand-500/20' : 'bg-slate-800 text-slate-400 border-white/5'}`}>{t.plan}</span>
                </td>
                <td className="px-10 py-6 text-right">
                   <Link to={`/t/${t.slug}/dashboard`} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5">Impersonar →</Link>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr><td colSpan={3} className="px-10 py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs italic">No hay empresas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminCMS = () => {
  const [content, setContent] = useState<PlatformContent[]>([]);
  const [editing, setEditing] = useState<PlatformContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { dbHealthy } = useApp();

  const fetchCMS = async () => {
    if (!dbHealthy) return;
    const { data } = await supabase.from('platform_content').select('*');
    if (data) setContent(data);
  };

  useEffect(() => { fetchCMS(); }, [dbHealthy]);

  const seedCMS = async () => {
    const defaults = [
      { key: 'home_hero_title', es: 'Gestiona tu negocio con precisión', ca: 'Gestiona el teu negoci amb precisió' },
      { key: 'home_hero_subtitle', es: 'La plataforma definitiva para escalar tu empresa hoy mismo.', ca: 'La plataforma definitiva per escalar la teva empresa avui mateix.' }
    ];
    const { error } = await supabase.from('platform_content').upsert(defaults);
    if (!error) { fetchCMS(); alert("CMS Inicializado correctamente."); }
  };

  const handleSave = async () => {
    if (!editing) return;
    setIsSaving(true);
    const { error } = await supabase.from('platform_content').upsert([editing]);
    if (error) alert("Error al guardar: " + error.message);
    else {
      await fetchCMS();
      setEditing(null);
      alert("¡Cambios publicados en la Landing Page!");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black text-white tracking-tight">Editor Global (CMS)</h3>
        {content.length === 0 && (
          <button onClick={seedCMS} className="px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase rounded-xl">Inicializar Datos por Defecto</button>
        )}
      </div>
      
      {editing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-12 rounded-[3rem] w-full max-w-xl shadow-2xl">
              <h4 className="text-xl font-black text-white mb-8">Editando: <span className="text-brand-500 uppercase text-xs font-mono">{editing.key}</span></h4>
              <div className="space-y-6">
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Español (ES)</label>
                    <textarea value={editing.es} onChange={e => setEditing({...editing, es: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none focus:ring-2 focus:ring-brand-500" />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Català (CA)</label>
                    <textarea value={editing.ca} onChange={e => setEditing({...editing, ca: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none focus:ring-2 focus:ring-brand-500" />
                 </div>
              </div>
              <div className="flex gap-4 mt-10">
                 <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">{isSaving ? 'Guardando...' : 'Publicar Ahora'}</button>
                 <button onClick={() => setEditing(null)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase">Cerrar</button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Clave</th>
              <th className="px-10 py-6">Valor Actual (ES)</th>
              <th className="px-10 py-6 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {content.map(item => (
              <tr key={item.key} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-10 py-6 font-mono text-[10px] text-brand-400 font-black uppercase tracking-widest">{item.key}</td>
                <td className="px-10 py-6 text-sm text-slate-300 truncate max-w-md">{item.es}</td>
                <td className="px-10 py-6 text-right">
                  <button onClick={() => setEditing(item)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Editar Nodo</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Authentication ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshProfile, enterDemoMode, dbHealthy } = useApp();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return alert("Supabase no configurado.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { await refreshProfile(); navigate('/'); } 
    else { alert("Credenciales no válidas."); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
        <div className="mb-8 p-1.5 bg-slate-900 rounded-[2.5rem] shadow-2xl">
           <button onClick={() => { enterDemoMode(true); navigate('/admin/dashboard'); }} className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-400 text-white rounded-[2.2rem] font-black uppercase tracking-[0.2em] text-[11px] transition-all hover:-translate-y-1 shadow-xl">
             ⚡ ENTRAR COMO SUPERADMIN (DEMO)
           </button>
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-500"></div>
          <div className="flex justify-between items-center mb-10">
              <Link to="/" className="font-black text-brand-600 tracking-tighter text-xl italic underline decoration-4 decoration-brand-100 underline-offset-4">ACME</Link>
              <ConnectionStatusBadge />
          </div>
          <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none">Acceso Global</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <Input label="Email de acceso" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required placeholder="ejemplo@correo.com" />
            <Input label="Tu contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50">
              {loading ? 'Validando...' : 'ENTRAR AL SISTEMA'}
            </button>
          </form>
          <div className="relative my-10">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest"><span className="px-4 bg-white text-slate-300">Otras opciones</span></div>
          </div>
          <button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} className="w-full py-4 bg-white text-gray-700 border border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">
               🚀 Workspace de Prueba (Tenant)
          </button>
        </div>
      </div>
    </div>
  );
};

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: { data: { full_name: fullName } }
    });
    if (!error) { alert("¡Usuario creado con éxito!"); navigate('/login'); } 
    else { alert(error.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-8 duration-500">
        <div className="flex justify-between items-center mb-10">
            <Link to="/" className="font-black text-brand-600 tracking-tighter text-xl">← ACME</Link>
            <LanguageSwitcher />
        </div>
        <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none">Únete a la Red</h2>
        <form onSubmit={handleSignup} className="space-y-6">
          <Input label="Nombre completo" type="text" value={fullName} onChange={(e: any) => setFullName(e.target.value)} required placeholder="Tu Nombre" />
          <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required placeholder="ejemplo@correo.com" />
          <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-700 transition-all shadow-xl">
            REGISTRARME AHORA
          </button>
        </form>
      </div>
    </div>
  );
};

const Landing = () => {
  const { t, language, session, memberships, dbHealthy, profile } = useApp();
  const [content, setContent] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isConfigured || dbHealthy === false) return;
    supabase.from('platform_content').select('*').then(({ data }) => {
      if (data) {
        const contentMap: Record<string, string> = {};
        data.forEach((item: any) => { contentMap[item.key] = language === 'ca' ? item.ca : item.es; });
        setContent(contentMap);
      }
    });
  }, [language, dbHealthy]);

  const dashboardLink = memberships.length > 0 ? `/t/${memberships[0].tenant?.slug}/dashboard` : '/onboarding';

  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="flex items-center justify-between px-10 py-6 border-b border-gray-50 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-6">
          <div className="text-2xl font-black text-brand-600 tracking-tighter italic">ACME<span className="text-gray-900">SAAS</span></div>
          <ConnectionStatusBadge />
        </div>
        <div className="flex items-center gap-8">
          <LanguageSwitcher />
          {session ? (
            <div className="flex items-center gap-6">
              {profile?.is_superadmin && <Link to="/admin/dashboard" className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all shadow-xl">Admin Panel</Link>}
              <Link to={dashboardLink} className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 hover:text-brand-700">{t('dashboard')}</Link>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <Link to="/login" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-brand-600 transition-colors">Entrar</Link>
              <Link to="/signup" className="px-8 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-brand-700 shadow-2xl transition-all">Empezar</Link>
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-40 text-center">
        <div className="inline-block px-4 py-1.5 bg-brand-50 text-brand-600 text-[10px] font-black uppercase tracking-widest rounded-full mb-8">Novedad: SaaS Multi-Tenant v1.5</div>
        <h1 className="text-8xl font-black text-gray-900 mb-10 tracking-tighter leading-[0.9] animate-in slide-in-from-bottom-12 duration-1000">
           {content['home_hero_title'] || 'Controla tu negocio con precisión.'}
        </h1>
        <p className="text-xl text-gray-500 mb-16 max-w-2xl mx-auto font-medium leading-relaxed animate-in slide-in-from-bottom-12 duration-1000 delay-100">
           {content['home_hero_subtitle'] || 'La infraestructura SaaS definitiva para empresas que buscan escala y bilingüismo nativo.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in slide-in-from-bottom-12 duration-1000 delay-200">
           <Link to={session ? dashboardLink : "/signup"} className="w-full sm:w-auto px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] text-sm font-black uppercase tracking-widest shadow-2xl hover:bg-black transition-all hover:-translate-y-1">{session ? 'IR AL PANEL' : 'EMPEZAR GRATIS'}</Link>
           <button className="w-full sm:w-auto px-12 py-6 bg-white text-slate-900 border-2 border-slate-100 rounded-[2.5rem] text-sm font-black uppercase tracking-widest hover:border-brand-500 transition-all">VER DEMOSTRACIÓN</button>
        </div>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};

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
  const userInitial = (profile?.full_name?.[0] || session?.user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] overflow-hidden font-sans">
      <aside className="w-80 bg-white border-r border-gray-100 flex flex-col shrink-0 z-30">
        <div className="p-8 border-b h-24 flex items-center justify-between">
          <div className="font-black text-xl truncate text-brand-600 tracking-tighter uppercase italic">{currentTenant.name}</div>
        </div>
        <div className="p-6">
           <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Workspace actual</label>
              <select className="w-full text-sm bg-transparent border-none font-black text-gray-800 focus:ring-0 p-0 cursor-pointer" value={slug} onChange={(e) => navigate(`/t/${e.target.value}/dashboard`)}>
                {memberships.map(m => <option key={m.tenant_id} value={m.tenant?.slug}>{m.tenant?.name}</option>)}
              </select>
           </div>
        </div>
        <nav className="flex-1 p-6 space-y-2 mt-2">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}><span>📊</span> {t('dashboard')}</Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('customers') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}><span>👥</span> {t('customers')}</Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('quotes') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}><span>📄</span> {t('quotes')}</Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('settings') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}><span>⚙️</span> {t('settings')}</Link>
        </nav>
        <div className="p-8 border-t border-gray-50">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-2xl transition-all"><span>🚪</span> {t('logout')}</button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white border-b border-gray-100 flex items-center justify-between px-12 shrink-0 z-20">
             <div className="flex items-center gap-4">
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">{currentTenant.name} Hub</h2>
               <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${isDemoMode ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{isDemoMode ? 'Modo Demo' : 'Live Cloud'}</span>
             </div>
             <div className="flex items-center gap-6">
                 {profile?.is_superadmin && <Link to="/admin/dashboard" className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">SYSTEM ADMIN</Link>}
                 <div className="h-12 w-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center font-black shadow-xl uppercase">{userInitial}</div>
             </div>
        </header>
        <div className="flex-1 overflow-auto p-12"><Outlet context={{ tenant: currentTenant }} /></div>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};

const Dashboard = () => {
  const { t } = useApp();
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { l: t('total_revenue'), v: '22.450 €', i: '💰' },
            { l: t('active_quotes'), v: '18', i: '⏳' },
            { l: t('total_customers'), v: '124', i: '👥' },
          ].map((s, i) => (
            <div key={i} className="bg-white p-10 rounded-[2.8rem] shadow-sm border border-gray-50 hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-gray-50 text-gray-900 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-brand-600 group-hover:text-white transition-all">{s.i}</div>
              <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{s.l}</h3>
              <p className="text-4xl font-black mt-2 text-gray-900 tracking-tighter">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-50 h-80 flex items-center justify-center text-gray-300 font-black uppercase tracking-widest text-xs italic">
           Gráficos de rendimiento en desarrollo.
        </div>
    </div>
  );
};

const Onboarding = () => {
    const { t, session, refreshProfile } = useApp();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const finalSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        const { data: tenant } = await supabase.from('tenants').insert([{ name, slug: finalSlug }]).select().single();
        if (tenant) {
            await supabase.from('memberships').insert([{ user_id: session?.user.id, tenant_id: tenant.id, role: 'owner' }]);
            await refreshProfile();
            navigate(`/t/${finalSlug}/dashboard`);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 text-center font-sans">
            <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100">
                <h2 className="text-4xl font-black mb-4 text-gray-900 tracking-tighter leading-none">Tu Nuevo Equipo</h2>
                <p className="mb-10 text-gray-400 text-sm font-medium">Configura tu espacio de trabajo bilingüe ahora.</p>
                <form onSubmit={handleCreate} className="space-y-6">
                    <Input label="Nombre de la empresa" value={name} onChange={(e: any) => setName(e.target.value)} required placeholder="Ej: Mi Empresa" />
                    <Input label="Slug / URL personalizada" value={slug} onChange={(e: any) => setSlug(e.target.value)} required placeholder="mi-empresa" />
                    <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl">
                      {loading ? 'CREANDO...' : 'CONFIRMAR Y EMPEZAR'}
                    </button>
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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [language, setLanguageState] = useState<Language>('es');

  const setLanguage = (lang: Language) => { setLanguageState(lang); localStorage.setItem('app_lang', lang); }
  const t_func = (key: keyof typeof translations['es']) => (translations[language] as any)[key] || key;

  useEffect(() => {
    if (!isConfigured) { setDbHealthy(false); return; }
    supabase.from('platform_content').select('count', { count: 'exact', head: true }).then(({ error }) => { setDbHealthy(!error); });
  }, []);

  const fetchProfileData = async (userId: string) => {
    if (!isConfigured || userId === 'demo' || userId === 'admin') return;
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileData) setProfile(profileData);
    const { data: membershipData } = await supabase.from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId);
    if (membershipData) setMemberships(membershipData as any);
  };

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
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
  const signOut = async () => { if (isConfigured) await supabase.auth.signOut(); setIsDemoMode(false); setSession(null); setProfile(null); setMemberships([]); };
  
  const enterDemoMode = (asAdmin = false) => { 
    setIsDemoMode(true); 
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
    <AppContext.Provider value={{ 
        session, profile, memberships, loading, isDemoMode, dbHealthy, language, setLanguage, 
        t: t_func, refreshProfile, signOut, enterDemoMode 
    }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="*" element={<div className="bg-white p-20 rounded-3xl border text-center text-gray-300 font-bold uppercase tracking-widest text-xs italic">Módulo de Gestión en Desarrollo</div>} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="cms" element={<AdminCMS />} />
            <Route path="tenants" element={<AdminTenants />} />
            <Route index element={<Navigate to="/admin/dashboard" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}