import React, { useState, useEffect, createContext, useContext } from 'react';
// Added missing useOutletContext import from react-router-dom to fix errors on lines 106, 167, 208, and 691
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
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
    <p className="mt-6 text-gray-500 font-black uppercase tracking-widest text-[10px] animate-pulse italic">Conectando...</p>
  </div>
);

const ConnectionStatusBadge = () => {
  const { dbHealthy } = useApp();
  
  if (!isConfigured) return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-200">
      ⚠️ Error Config
    </div>
  );

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border shadow-sm ${dbHealthy ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
      <span className="relative flex h-2 w-2">
        {dbHealthy && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dbHealthy ? 'bg-green-500' : 'bg-amber-500'}`}></span>
      </span>
      {dbHealthy ? 'Online' : 'Reconectando'}
    </div>
  );
};

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
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

// --- Tenant Operations Components ---

const Customers = () => {
  // Fixed error: useOutletContext is now available via import
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '' });

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    if (data) setCustomers(data);
  };

  useEffect(() => { fetchCustomers(); }, [tenant.id]);

  const handleCreate = async () => {
    const { error } = await supabase.from('customers').insert([{ ...newCust, tenant_id: tenant.id }]);
    if (error) alert(error.message);
    else { setIsCreating(false); setNewCust({ name: '', email: '', phone: '' }); fetchCustomers(); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{t('customers')}</h3>
        <button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Nuevo Cliente</button>
      </div>

      {isCreating && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Input label="Nombre" value={newCust.name} onChange={(e:any) => setNewCust({...newCust, name: e.target.value})} />
             <Input label="Email" value={newCust.email} onChange={(e:any) => setNewCust({...newCust, email: e.target.value})} />
             <Input label="Teléfono" value={newCust.phone} onChange={(e:any) => setNewCust({...newCust, phone: e.target.value})} />
           </div>
           <div className="flex gap-4">
             <button onClick={handleCreate} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl">Guardar</button>
             <button onClick={() => setIsCreating(false)} className="px-8 py-3 text-gray-400 text-[10px] font-black uppercase">Cancelar</button>
           </div>
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
                <td className="px-10 py-6 font-black text-gray-900">{c.name}</td>
                <td className="px-10 py-6 text-sm text-gray-500">{c.email} <br/> <span className="text-[10px]">{c.phone}</span></td>
                <td className="px-10 py-6 text-right"><button className="text-brand-600 font-black text-[9px] uppercase">Ver Ficha</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Quotes = () => {
  // Fixed error: useOutletContext is now available via import
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, language } = useApp();
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
        <button className="px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Crear Presupuesto</button>
      </div>

      <div className="bg-white border border-gray-100 rounded-[2.8rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Ref/Fecha</th><th className="px-10 py-6">Cliente</th><th className="px-10 py-6">Importe</th><th className="px-10 py-6 text-right">Estado</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quotes.map(q => (
              <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-10 py-6"><div className="font-black text-gray-900">#Q-{q.id.slice(0,4)}</div><div className="text-[9px] text-gray-400 font-bold">{formatDate(q.created_at, language)}</div></td>
                <td className="px-10 py-6 font-bold text-gray-600">{q.customer?.name || 'Cliente Genérico'}</td>
                <td className="px-10 py-6 font-black text-brand-600">{formatCurrency(q.total_amount, language)}</td>
                <td className="px-10 py-6 text-right"><span className="px-3 py-1 bg-amber-50 text-amber-600 text-[9px] font-black uppercase rounded-full border border-amber-100">{q.status}</span></td>
              </tr>
            ))}
            {quotes.length === 0 && <tr><td colSpan={4} className="px-10 py-20 text-center text-gray-300 font-black uppercase text-xs italic">No hay presupuestos emitidos todavía.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TenantSettings = () => {
  // Fixed error: useOutletContext is now available via import
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
         <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Plan de Suscripción</label>
            <div className="flex justify-between items-center">
               <span className="font-black text-brand-600 uppercase italic">{tenant.plan}</span>
               <button className="text-[9px] font-black text-slate-400 uppercase underline">Cambiar Plan</button>
            </div>
         </div>
         <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl">
            {saving ? 'Guardando...' : 'Actualizar Perfil'}
         </button>
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
            <h2 className="text-xl font-black text-white tracking-tight">Consola de Control</h2>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Servidor Operativo</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-[10px] font-black text-slate-400 hover:text-brand-500 uppercase tracking-widest transition-colors">Web Pública ↗</Link>
            <div className="h-12 w-12 bg-gradient-to-tr from-brand-600 to-brand-400 text-white rounded-2xl flex items-center justify-center font-black shadow-xl text-sm">SA</div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-12 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.05),_transparent)]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const AdminDashboard = () => {
  const { session } = useApp();
  const [dbAdminStatus, setDbAdminStatus] = useState<'checking' | 'admin' | 'restricted'>('checking');

  useEffect(() => {
    const checkRealAdmin = async () => {
      if (!session) return;
      const { data } = await supabase.from('profiles').select('is_superadmin').eq('id', session.user.id).single();
      setDbAdminStatus(data?.is_superadmin ? 'admin' : 'restricted');
    };
    checkRealAdmin();
  }, [session]);

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

      <div className="bg-brand-900/10 border border-brand-500/30 rounded-[2.5rem] p-10 relative overflow-hidden">
         <div className="flex items-center justify-between mb-8">
           <h3 className="text-sm font-black text-brand-400 uppercase tracking-widest">Inspector de Privilegios</h3>
           <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${dbAdminStatus === 'admin' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
             {dbAdminStatus === 'checking' ? 'Verificando...' : dbAdminStatus === 'admin' ? '✓ SuperAdmin Reconocido' : '❌ Acceso Limitado en DB'}
           </div>
         </div>
         {dbAdminStatus === 'restricted' && (
           <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl mb-8">
             <p className="text-sm text-red-200 font-medium">
               ⚠️ La Base de Datos no te reconoce como SuperAdmin.
             </p>
           </div>
         )}
         <p className="text-xs text-slate-400 mb-6 italic text-center">Configuración de Seguridad RLS Correcta</p>
      </div>
    </div>
  );
};

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'free' });
  const { dbHealthy } = useApp();

  const fetchTenants = async () => {
    if (!dbHealthy) return;
    setIsLoading(true);
    setLastError(null);
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error("Error fetching:", error);
        setLastError(error.message);
    }
    if (data) setTenants(data as any);
    setIsLoading(false);
  };

  useEffect(() => { fetchTenants(); }, [dbHealthy]);

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug) return alert("Rellena nombre y slug");
    const { error } = await supabase.from('tenants').insert([newTenant]);
    if (error) {
      alert("⚠️ ERROR: " + error.message);
    } else {
      setIsCreating(false);
      setNewTenant({ name: '', slug: '', plan: 'free' });
      await fetchTenants(); 
      alert("¡Tenant creado con éxito!");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
            <h3 className="text-2xl font-black text-white tracking-tight">Directorio de Empresas</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Registros en la nube: {tenants.length}</p>
        </div>
        <div className="flex gap-4">
            <button onClick={fetchTenants} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10">🔄 Recargar</button>
            <button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg">+ Registrar Empresa</button>
        </div>
      </div>

      {lastError && (
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[1.5rem] flex items-center gap-4">
              <span className="text-2xl">🚨</span>
              <div>
                  <div className="text-red-400 font-black text-[10px] uppercase tracking-widest">Error de Base de Datos</div>
                  <div className="text-red-200 text-xs mt-1">{lastError}</div>
              </div>
          </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
              <h4 className="text-xl font-black text-white mb-6">Nuevo Registro</h4>
              <div className="space-y-4">
                 <input placeholder="Nombre de Empresa" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} />
                 <input placeholder="url-personalizada" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} />
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

      <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        {isLoading && (
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )}
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Empresa</th><th className="px-10 py-6">Licencia</th><th className="px-10 py-6 text-right">Acceso</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-10 py-6"><div className="font-black text-white">{t.name}</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">/{t.slug}</div></td>
                <td className="px-10 py-6"><span className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-full border ${t.plan === 'pro' ? 'bg-brand-500/10 text-brand-500 border-brand-500/20' : 'bg-slate-800 text-slate-400 border-white/5'}`}>{t.plan}</span></td>
                <td className="px-10 py-6 text-right"><Link to={`/t/${t.slug}/dashboard`} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5">Impersonar →</Link></td>
              </tr>
            ))}
            {tenants.length === 0 && !isLoading && (
              <tr><td colSpan={3} className="px-10 py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs italic">Lista vacía.</td></tr>
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

  const handleSave = async () => {
    if (!editing) return;
    setIsSaving(true);
    const { error } = await supabase.from('platform_content').upsert([editing]);
    if (!error) { await fetchCMS(); setEditing(null); }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-black text-white tracking-tight">Editor Global (CMS)</h3>
      {editing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-12 rounded-[3rem] w-full max-w-xl shadow-2xl">
              <h4 className="text-xl font-black text-white mb-8">Editar Nodo: <span className="text-brand-500 text-xs font-mono">{editing.key}</span></h4>
              <div className="space-y-6">
                 <textarea value={editing.es} onChange={e => setEditing({...editing, es: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none" placeholder="Español" />
                 <textarea value={editing.ca} onChange={e => setEditing({...editing, ca: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none" placeholder="Català" />
              </div>
              <div className="flex gap-4 mt-10">
                 <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">{isSaving ? 'Guardando...' : 'Publicar'}</button>
                 <button onClick={() => setEditing(null)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase">Cerrar</button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Clave</th><th className="px-10 py-6">Visualización ES</th><th className="px-10 py-6 text-right">Acción</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {content.map(item => (
              <tr key={item.key} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-10 py-6 font-mono text-[10px] text-brand-400 font-black tracking-widest">{item.key}</td>
                <td className="px-10 py-6 text-sm text-slate-300 truncate max-w-md">{item.es}</td>
                <td className="px-10 py-6 text-right"><button onClick={() => setEditing(item)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase">Editar</button></td>
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
  const { refreshProfile, enterDemoMode } = useApp();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { await refreshProfile(); navigate('/'); } 
    else { alert("Credenciales no válidas."); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
        <div className="mb-8 p-1.5 bg-slate-900 rounded-[2.5rem] shadow-2xl">
           <button onClick={() => { enterDemoMode(true); navigate('/admin/dashboard'); }} className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-400 text-white rounded-[2.2rem] font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl">
             ⚡ ENTRAR COMO SUPERADMIN (DEMO)
           </button>
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-500"></div>
          <Link to="/" className="font-black text-brand-600 tracking-tighter text-2xl block mb-10 italic underline decoration-brand-100 underline-offset-4">ACME</Link>
          <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none">Acceso</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
            <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl">
              {loading ? 'Validando...' : 'ENTRAR'}
            </button>
          </form>
          <button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} className="w-full py-4 mt-8 bg-white text-gray-700 border border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">
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
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (!error) navigate('/login'); else { alert(error.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100">
        <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter text-center">Crea tu cuenta</h2>
        <form onSubmit={handleSignup} className="space-y-6">
          <Input label="Nombre" type="text" value={fullName} onChange={(e: any) => setFullName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">
            REGISTRARME
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
      <header className="flex items-center justify-between px-10 py-6 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-6"><div className="text-2xl font-black text-brand-600 italic">ACME</div><ConnectionStatusBadge /></div>
        <div className="flex items-center gap-8">
          <LanguageSwitcher />
          {session ? (
            <Link to={dashboardLink} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full shadow-xl">Panel de Gestión</Link>
          ) : (
            <Link to="/login" className="px-8 py-3 bg-brand-600 text-white text-[10px] font-black uppercase rounded-full shadow-2xl">Empezar</Link>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-40 text-center">
        <h1 className="text-8xl font-black text-gray-900 mb-10 tracking-tighter leading-[0.9]">{content['home_hero_title'] || 'Controla tu negocio con precisión.'}</h1>
        <p className="text-xl text-gray-500 mb-16 max-w-2xl mx-auto font-medium">{content['home_hero_subtitle'] || 'La infraestructura SaaS definitiva para empresas bilingües.'}</p>
        <Link to={session ? dashboardLink : "/signup"} className="px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] text-sm font-black uppercase tracking-widest shadow-2xl">EMPEZAR GRATIS</Link>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile, session } = useApp();
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

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] font-sans">
      <aside className="w-80 bg-white border-r border-gray-100 flex flex-col shrink-0 z-30">
        <div className="p-8 h-24 flex items-center justify-between font-black text-xl text-brand-600 uppercase italic truncate">{currentTenant.name}</div>
        <nav className="flex-1 p-6 space-y-2 mt-2">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📊 {t('dashboard')}</Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('customers') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>👥 {t('customers')}</Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('quotes') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📄 {t('quotes')}</Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('settings') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>⚙️ {t('settings')}</Link>
        </nav>
        <div className="p-8 border-t border-gray-50">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-2xl transition-all">🚪 {t('logout')}</button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white border-b border-gray-100 flex items-center justify-between px-12 shrink-0">
             <h2 className="text-2xl font-black text-gray-900 tracking-tight">{currentTenant.name}</h2>
             {profile?.is_superadmin && <Link to="/admin/dashboard" className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-full shadow-lg">SYSTEM ADMIN</Link>}
        </header>
        <div className="flex-1 overflow-auto p-12"><Outlet context={{ tenant: currentTenant }} /></div>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};

const Dashboard = () => {
  // Fixed error: useOutletContext is now available via import
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { l: t('total_revenue'), v: '0.00 €', i: '💰' },
            { l: t('active_quotes'), v: '0', i: '⏳' },
            { l: t('total_customers'), v: '0', i: '👥' },
          ].map((s, i) => (
            <div key={i} className="bg-white p-10 rounded-[2.8rem] shadow-sm border border-gray-100 hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-gray-50 text-gray-900 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-brand-600 group-hover:text-white transition-all">{s.i}</div>
              <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{s.l}</h3>
              <p className="text-4xl font-black mt-2 text-gray-900 tracking-tighter">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-50 h-80 flex items-center justify-center text-gray-300 font-black uppercase tracking-widest text-xs italic">
           Bienvenido al Hub de {tenant.name}.
        </div>
    </div>
  );
};

const Onboarding = () => {
    const { session, refreshProfile } = useApp();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const finalSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        const { data: tenant, error } = await supabase.from('tenants').insert([{ name, slug: finalSlug }]).select().single();
        if (!error && tenant) {
            await supabase.from('memberships').insert([{ user_id: session?.user.id, tenant_id: tenant.id, role: 'owner' }]);
            await refreshProfile();
            navigate(`/t/${finalSlug}/dashboard`);
        } else { alert("Error: " + error?.message); }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 text-center font-sans">
            <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100">
                <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter">Tu Espacio</h2>
                <form onSubmit={handleCreate} className="space-y-6">
                    <Input label="Empresa" value={name} onChange={(e: any) => setName(e.target.value)} required />
                    <Input label="Slug / URL" value={slug} onChange={(e: any) => setSlug(e.target.value)} required />
                    <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">
                      {loading ? 'CREANDO...' : 'EMPEZAR'}
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
  const [language, setLanguageState] = useState<Language>('es');

  const setLanguage = (lang: Language) => { setLanguageState(lang); localStorage.setItem('app_lang', lang); }
  const t_func = (key: keyof typeof translations['es']) => (translations[language] as any)[key] || key;

  useEffect(() => {
    if (!isConfigured) { setDbHealthy(false); return; }
    supabase.from('profiles').select('count', { count: 'exact', head: true }).then(({ error }) => { setDbHealthy(!error); });
  }, []);

  const fetchProfileData = async (userId: string) => {
    if (!isConfigured) return;
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
  const signOut = async () => { if (isConfigured) await supabase.auth.signOut(); setSession(null); setProfile(null); setMemberships([]); };
  
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
    <AppContext.Provider value={{ 
        session, profile, memberships, loading, isDemoMode: !!(session?.user?.id === 'demo' || session?.user?.id === 'admin'), dbHealthy, language, setLanguage, 
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
            <Route path="customers" element={<Customers />} />
            <Route path="quotes" element={<Quotes />} />
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