
import React, { useState, useEffect } from 'react';
// Correct splitting of imports: use react-router-dom for all web hooks
import { Link, useNavigate, useParams, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SuperAdminFloatingBar } from '../../components/layout/CommonLayoutComponents';

export const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile, session, dbHealthy, refreshProfile } = useApp();
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
        // 1. Intentar obtener el tenant por su slug
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

        // 2. Si es Superadmin y NO tiene membresía, crearla automáticamente para habilitar RLS
        if (profile?.is_superadmin && !currentMembership) {
          console.log(`Superadmin detectado sin membresía en ${slug}. Creando acceso de base de datos...`);
          
          const { error: mError } = await supabase
            .from('memberships')
            .insert([{ 
              user_id: session.user.id, 
              tenant_id: tenantData.id, 
              role: 'admin' 
            }]);

          if (!mError || mError.message.includes('unique_user_tenant')) {
            // Refrescamos el perfil global para que memberships contenga el nuevo vínculo
            await refreshProfile();
          } else {
            console.error("Error al auto-vincular superadmin:", mError.message);
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

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#fcfcfc] font-sans">
      <aside className="w-full lg:w-80 bg-white border-b lg:border-r border-gray-100 flex flex-col shrink-0 z-30">
        <div className="p-6 md:p-8 h-20 md:h-24 flex items-center justify-between font-black text-xl text-brand-600 uppercase italic truncate">{currentTenant.name}</div>
        <nav className="p-4 md:p-6 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📊 Panel</Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('customers') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>👥 {t('customers')}</Link>
          <Link to={`/t/${slug}/products`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('products') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📦 Inventario</Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('quotes') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📄 {t('quotes')}</Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-3 px-5 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 ${isActive('settings') ? 'bg-brand-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>⚙️ {t('settings')}</Link>
        </nav>
        <div className="hidden lg:block p-8 border-t border-gray-50 mt-auto"><button onClick={signOut} className="w-full flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-2xl transition-all">🚪 {t('logout')}</button></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 md:h-24 bg-white border-b border-gray-100 flex items-center justify-between px-6 md:px-12 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight leading-none uppercase italic">{currentTenant.name}</h2>
            {profile?.is_superadmin && !currentMembership && (
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1 animate-pulse">⚠️ Acceso via Superadmin</span>
            )}
          </div>
          <div className="flex gap-2 md:gap-4">
            <a href={`#/c/${slug}`} target="_blank" rel="noreferrer" className="hidden sm:flex px-4 py-2 bg-gray-50 text-gray-400 text-[9px] font-black uppercase rounded-full border border-gray-100 hover:text-gray-900 transition-all">Web ↗</a>
            {profile?.is_superadmin && <Link to="/admin/dashboard" className="px-3 md:px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-full shadow-lg">ADMIN</Link>}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-12"><Outlet context={{ tenant: currentTenant }} /></div>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};
