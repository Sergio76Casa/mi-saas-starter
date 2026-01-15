
import React, { useEffect } from 'react';
// Import routing components and hooks from react-router to avoid export issues in react-router-dom
import { Link, useNavigate, useLocation, Outlet } from 'react-router';
import { useApp } from '../../AppProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminLayout = () => {
  const { profile, signOut, t, loading } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && (!profile || !profile.is_superadmin)) navigate('/');
  }, [profile, loading, navigate]);

  if (loading || !profile?.is_superadmin) return <LoadingSpinner />;
  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#050505] text-slate-100 font-sans">
      <aside className="w-full lg:w-72 bg-slate-900/40 backdrop-blur-xl border-b lg:border-r border-white/5 flex flex-col shrink-0">
        <div className="p-6 md:p-8 h-20 md:h-24 flex items-center justify-between lg:justify-start">
          <div className="font-black text-xl md:text-2xl tracking-tighter text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-xs">S</div>SYSTEM<span className="text-brand-500">ADMIN</span>
          </div>
        </div>
        <nav className="p-4 md:p-6 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
          <Link to="/admin/dashboard" className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-2xl' : 'text-slate-400 hover:bg-white/5'}`}>📊 Dashboard</Link>
          <Link to="/admin/cms" className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('cms') ? 'bg-brand-600 text-white shadow-2xl' : 'text-slate-400 hover:bg-white/5'}`}>📝 CMS</Link>
          <Link to="/admin/tenants" className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('tenants') ? 'bg-brand-600 text-white shadow-2xl' : 'text-slate-400 hover:bg-white/5'}`}>🏢 Tenants</Link>
        </nav>
        <div className="hidden lg:block p-6 border-t border-white/5 mt-auto">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-400/10 rounded-2xl transition-all">🚪 {t('logout')}</button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 md:h-24 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0">
          <div className="flex flex-col"><h2 className="text-lg md:text-xl font-black text-white tracking-tight">Consola</h2></div>
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/" className="text-[10px] font-black text-slate-400 hover:text-brand-500 uppercase tracking-widest transition-colors hidden sm:block">Web Pública ↗</Link>
            <div className="h-10 w-10 md:h-12 md:w-12 bg-gradient-to-tr from-brand-600 to-brand-400 text-white rounded-xl md:rounded-2xl flex items-center justify-center font-black shadow-xl text-xs md:sm">SA</div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-12 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.05),_transparent)]"><Outlet /></div>
      </main>
    </div>
  );
};
