
import React, { useState, useEffect } from 'react';
// Import routing components and hooks from react-router to avoid export issues in react-router-dom
import { Link, useNavigate, useParams, useLocation, Outlet } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SuperAdminFloatingBar } from '../../components/layout/CommonLayoutComponents';

export const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile, session, dbHealthy, refreshProfile, language, setLanguage } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [impersonatedTenant, setImpersonatedTenant] = useState<Tenant | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const currentMembership = memberships.find(m => m.tenant?.slug === slug);
  const currentTenant = currentMembership?.tenant || impersonatedTenant;

  useEffect(() => {
    const ensureAccess = async () => {
      if (loading || !dbHealthy || !session || !slug) return;
      
      setCheckingAccess(true);
      
      try {
        const { data: tenantData, error: tError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .single();

        if (tError || !tenantData) {
          console.error("Tenant no encontrado");
          setCheckingAccess(false);
          return;
        }

        setImpersonatedTenant(tenantData);

        if (profile?.is_superadmin && !currentMembership) {
          const { error: mError } = await supabase
            .from('memberships')
            .insert([{ 
              user_id: session.user.id, 
              tenant_id: tenantData.id, 
              role: 'admin' 
            }]);

          if (!mError || mError.message.includes('unique_user_tenant')) {
            await refreshProfile();
          }
        }
      } catch (err) {
        console.error("Error en validación de acceso:", err);
      } finally {
        setCheckingAccess(false);
      }
    };

    ensureAccess();
  }, [slug, profile, loading, dbHealthy, session]);

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
    }
  }, [loading, session, navigate, location.pathname]);

  if (loading || checkingAccess) return <LoadingSpinner />;
  
  if (session && !currentTenant && !profile?.is_superadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="max-w-md bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] shadow-xl border border-gray-100">
           <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-4 tracking-tighter uppercase italic leading-none">Acceso Denegado</h2>
           <p className="text-gray-400 font-medium italic mb-10">No tienes permisos para esta empresa.</p>
           <div className="flex flex-col gap-4">
              <Link to="/" className="px-8 py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Inicio</Link>
              <button onClick={signOut} className="text-[10px] font-black uppercase tracking-widest text-red-500">Cerrar Sesión</button>
           </div>
        </div>
      </div>
    );
  }

  if (!currentTenant) return <LoadingSpinner />;

  const isActive = (path: string) => location.pathname.includes(path);

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'ca' : 'es');
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#fcfcfc] font-sans">
      <aside className="w-full lg:w-80 bg-white border-b lg:border-r border-gray-100 flex flex-col shrink-0 z-30">
        <div className="p-6 md:p-8 h-20 md:h-24 flex items-center justify-between font-black text-xl text-brand-600 uppercase italic truncate">{currentTenant.name}</div>
        <nav className="p-4 md:p-6 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📊 {t('dashboard')}</Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('customers') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>👥 {t('customers')}</Link>
          <Link to={`/t/${slug}/products`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('products') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📦 Inventario</Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('quotes') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📄 {t('quotes')}</Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('settings') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>⚙️ {t('settings')}</Link>
        </nav>
        <div className="hidden lg:block p-8 border-t border-gray-50 mt-auto"><button onClick={signOut} className="w-full flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-2xl transition-all">🚪 {t('logout')}</button></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 md:h-24 bg-white border-b border-gray-100 flex items-center justify-between px-6 md:px-12 shrink-0">
          <div className="flex flex-col overflow-hidden mr-4">
            <h2 className="text-base md:text-2xl font-black text-gray-900 tracking-tight leading-none uppercase italic truncate">{currentTenant.name}</h2>
            {profile?.is_superadmin && !currentMembership && (
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 animate-pulse">⚠️ Acceso via Superadmin</span>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Idioma Switcher Compacto */}
            <button 
              onClick={toggleLanguage}
              className="flex items-center justify-center w-10 h-10 md:w-auto md:px-4 md:py-2 bg-gray-50 text-gray-500 text-[9px] font-black uppercase rounded-xl border border-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-all group"
              title={language === 'es' ? 'Cambiar a Catalán' : 'Canviar a Espanyol'}
            >
              <svg className="w-4 h-4 md:mr-2 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
              <span className="hidden md:inline">{language.toUpperCase()}</span>
            </button>

            {/* Ver Web */}
            <a 
              href={`#/c/${slug}`} 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center justify-center w-10 h-10 md:w-auto md:px-4 md:py-2 bg-gray-50 text-gray-500 text-[9px] font-black uppercase rounded-xl border border-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-all group"
              title="Ver Web Pública"
            >
              <svg className="w-4 h-4 md:mr-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              <span className="hidden md:inline">Web ↗</span>
            </a>

            {/* Logout Mobile Only (Visible en barra superior) */}
            <button 
              onClick={signOut}
              className="lg:hidden flex items-center justify-center w-10 h-10 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-100 transition-all"
              title={t('logout')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </button>

            {profile?.is_superadmin && (
              <Link to="/admin/dashboard" className="flex items-center justify-center w-10 h-10 md:w-auto md:px-4 md:py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-xl shadow-lg hover:bg-black transition-all">
                <svg className="w-4 h-4 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className="hidden md:inline">ADMIN</span>
              </Link>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-12"><Outlet context={{ tenant: currentTenant }} /></div>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};
