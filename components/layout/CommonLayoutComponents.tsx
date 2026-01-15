
import React from 'react';
// Import Link from react-router to avoid export issues in react-router-dom
import { Link } from 'react-router';
import { useApp } from '../../AppProvider';
import { isConfigured } from '../../supabaseClient';

export const ConnectionStatusBadge = () => {
  const { dbHealthy } = useApp();
  if (!isConfigured) return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-200">
      ⚠️ Sin Configuración
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

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200/50">
      <button onClick={() => setLanguage('es')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'es' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>ES</button>
      <button onClick={() => setLanguage('ca')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'ca' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>CA</button>
    </div>
  );
};

export const SuperAdminFloatingBar = () => {
  const { profile } = useApp();
  if (!profile?.is_superadmin) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-500 w-[90%] md:w-auto">
      <Link to="/admin/dashboard" className="flex items-center justify-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-full shadow-2xl border border-white/10 hover:scale-105 transition-all group">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center">Panel del Sistema Central</span>
        <span className="group-hover:translate-x-1 transition-transform hidden md:inline">→</span>
      </Link>
    </div>
  );
};
