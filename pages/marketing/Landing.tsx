
import React from 'react';
// Import Link from react-router to avoid export issues in react-router-dom
import { Link } from 'react-router';
import { useApp } from '../../AppProvider';
import { LanguageSwitcher, SuperAdminFloatingBar } from '../../components/layout/CommonLayoutComponents';

export const Landing = () => {
  const { session, memberships } = useApp();
  const dashboardLink = memberships.length > 0 ? `/t/${memberships[0].tenant?.slug}/dashboard` : '/onboarding';
  return (
    <div className="min-h-screen bg-white font-sans text-center overflow-x-hidden">
      <header className="flex items-center justify-between px-6 md:px-10 py-6 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="text-2xl font-black text-brand-600 italic">ACME</div>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          {session ? <Link to={dashboardLink} className="px-6 md:px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full">Panel</Link> : <Link to="/login" className="px-6 md:px-8 py-3 bg-brand-600 text-white text-[10px] font-black uppercase rounded-full">Empezar</Link>}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-20 md:py-40">
        <h1 className="text-5xl md:text-8xl font-black text-gray-900 mb-10 tracking-tighter leading-[1] md:leading-[0.9] uppercase italic">Controla tu negocio con precisión.</h1>
        <p className="text-lg md:text-xl text-gray-500 mb-16 max-w-2xl mx-auto font-medium italic">La plataforma definitiva para instaladores bilingües.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to={session ? dashboardLink : "/signup"} className="w-full sm:w-auto px-12 py-6 bg-slate-900 text-white rounded-2xl md:rounded-[2.5rem] text-sm font-black uppercase tracking-widest shadow-2xl">EMPEZAR GRATIS</Link>
          {!session && <div className="sm:hidden"><LanguageSwitcher /></div>}
        </div>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};
