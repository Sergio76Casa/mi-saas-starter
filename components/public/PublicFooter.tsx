
import React, { useState } from 'react';
import { Tenant, Branch, Language } from '../../types';

interface PublicFooterProps {
  tenant: Tenant | null;
  branches: Branch[];
  language: Language;
  translations: any;
}

const FOOTER_MODAL_CONTENT: Record<string, any> = {
  instalacion: {
    title: { es: 'Instalación', ca: 'Instal·lació' },
    img: 'https://images.unsplash.com/photo-1621905252507-b35220adcfba?q=80&w=2070&auto=format&fit=crop',
    desc: {
      es: 'Instalación profesional, limpia y certificada. Te asesoramos y dejamos el equipo listo para funcionar con máxima eficiencia.',
      ca: 'Instal·lació professional, neta i certificada. T’assessorem i deixem l’equip a punt per funcionar amb la màxima eficiència.'
    }
  },
  mantenimiento: {
    title: { es: 'Mantenimiento', ca: 'Manteniment' },
    img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2069&auto=format&fit=crop',
    desc: {
      es: 'Revisiones periódicas para alargar la vida útil del equipo, mejorar el rendimiento y reducir el consumo.',
      ca: 'Revisions periòdiques per allargar la vida útil de l’equip, millorar el rendiment i reduir el consum.'
    }
  },
  reparacion: {
    title: { es: 'Reparación', ca: 'Reparació' },
    img: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=2070&auto=format&fit=crop',
    desc: {
      es: 'Diagnóstico rápido y reparación con repuestos de calidad. Solucionamos averías para que recuperes el confort cuanto antes.',
      ca: 'Diagnosi ràpida i reparació amb recanvis de qualitat. Resolem avaries perquè recuperis el confort com més aviat millor.'
    }
  },
  garantias: {
    title: { es: 'Garantías', ca: 'Garanties' },
    img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=2070&auto=format&fit=crop',
    desc: {
      es: 'Cobertura y tranquilidad. Gestionamos garantías y te acompañamos ante cualquier incidencia del equipo o la instalación.',
      ca: 'Cobertura i tranquil·litat. Gestionem garanties i t’acompanyem davant qualsevol incidència de l’equip o la instal·lació.'
    }
  },
  privacidad: {
    title: { es: 'Privacidad', ca: 'Privacitat' },
    img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=2070&auto=format&fit=crop',
    desc: {
      es: 'Tratamos tus datos con responsabilidad y solo para ofrecerte el servicio. Puedes solicitar acceso, rectificación o eliminación cuando lo necesites.',
      ca: 'Tractem les teves dades amb responsabilitat i només per oferir-te el servei. Pots sol·licitar accés, rectificació o eliminació quan ho necessitis.'
    }
  },
  cookies: {
    title: { es: 'Cookies', ca: 'Cookies' },
    img: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop',
    desc: {
      es: 'Utilizamos cookies para mejorar tu experiencia y analizar el uso del sitio. Puedes aceptar, rebutjar o configurar tus preferencias.',
      ca: 'Utilitzem cookies per millorar la teva experiència i analitzar l’ús del lloc. Pots acceptar, rebutjar o configurar les teves preferències.'
    }
  },
  aviso_legal: {
    title: { es: 'Aviso Legal', ca: 'Avís Legal' },
    img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=2070&auto=format&fit=crop',
    desc: {
      es: 'Aquí encontrarás la información legal del sitio, condiciones de uso y responsabilidades. Si tienes dudas, contáctanos.',
      ca: 'Aquí trobaràs la informació legal del lloc, condicions d’ús i responsabilitats. Si tens dubtes, contacta amb nosaltres.'
    }
  }
};

export const PublicFooter: React.FC<PublicFooterProps> = ({ tenant, branches, language, translations }) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const tt = (key: string) => {
    if (!translations) return key;
    const langSet = translations[language] || translations['es'] || {};
    return langSet[key] || translations['es']?.[key] || key;
  };
  
  const modalContent = activeModal ? FOOTER_MODAL_CONTENT[activeModal] : null;

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Footer Modal with safety checks */}
      {activeModal && modalContent && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
          <div className="relative bg-white w-full max-w-xl overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in-95">
            <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/40 z-10 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div className="h-48 relative overflow-hidden bg-slate-100">
              {modalContent.img && <img src={modalContent.img} className="w-full h-full object-cover" alt="" />}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent text-white"></div>
            </div>
            <div className="p-10 md:p-12 text-center">
              <h3 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 mb-6">
                {modalContent.title?.[language] || modalContent.title?.['es'] || 'Información'}
              </h3>
              <p className="text-slate-500 font-medium leading-relaxed italic text-lg">
                {modalContent.desc?.[language] || modalContent.desc?.['es'] || ''}
              </p>
              <button onClick={() => setActiveModal(null)} className="mt-10 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-black transition-all active:scale-95">{tt('modal_close')}</button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-950 text-white pt-24 pb-12 relative overflow-hidden text-left">
        <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
            {/* Columna 1: Branding */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                {tenant?.use_logo_on_web && tenant?.logo_url ? (
                  <img src={tenant.logo_url} className="h-10 w-auto object-contain brightness-0 invert" alt={tenant?.name} />
                ) : (
                  <span className="text-2xl font-black italic tracking-tighter uppercase text-white">{tenant?.name || 'EMPRESA'}</span>
                )}
              </div>
              <p className="text-slate-400 text-[14px] font-medium leading-relaxed max-w-xs italic">
                {language === 'ca' 
                  ? (tenant?.footer_description_ca || tenant?.footer_description_es || "Som experts en solucions de climatització eficient.")
                  : (tenant?.footer_description_es || tenant?.footer_description_ca || "Somo Expertos en soluciones de climatización eficiente. Presupuestos transparentes, instalación profesional y las mejores marcas del mercado.")
                }
              </p>
              
              <div className="flex flex-wrap gap-4">
                {tenant?.social_facebook && (
                  <a href={tenant.social_facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
                  </a>
                )}
                {tenant?.social_instagram && (
                  <a href={tenant.social_instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM16.5 5c-.44 0-.8.36-.8.8s.36.8.8.8.8-.36.8-.8-.36-.8-.8-.8zm1.5 2.5v9c0 2.48-2.02 4.5-4.5 4.5h-3C8.02 21 6 18.98 6 16.5v-9C6 5.02 8.02 3 10.5 3h3c2.48 0 4.5 2.02 4.5 4.5z"/></svg>
                  </a>
                )}
                {tenant?.social_tiktok && (
                  <a href={tenant.social_tiktok} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.28-2.26.74-4.63 2.58-5.91 1.08-.78 2.36-1.21 3.71-1.28.1-.01.2-.01.3-.01.01 1.34 0 2.68 0 4.02-.63.02-1.26.22-1.78.58-.85.55-1.37 1.51-1.38 2.53-.02 1.4.92 2.72 2.26 3.1 1.15.36 2.49.12 3.42-.65.65-.54 1.05-1.34 1.06-2.2 0-3.33 0-6.66.01-9.99z"/></svg>
                  </a>
                )}
                {tenant?.social_youtube && (
                  <a href={tenant.social_youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                  </a>
                )}
                {tenant?.social_x && (
                  <a href={tenant.social_x} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                )}
                {tenant?.social_linkedin && (
                  <a href={tenant.social_linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                  </a>
                )}
                {tenant?.social_whatsapp && (
                  <a href={tenant.social_whatsapp} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412s-1.239 6.167-3.488 8.413c-2.248 2.244-5.231 3.484-8.411 3.484h-.001c-2.008 0-3.975-.521-5.714-1.506l-6.276 1.649zm6.151-3.692l.332.197c1.472.873 3.136 1.335 4.845 1.335h.001c5.446 0 9.876-4.43 9.878-9.876.001-2.64-1.029-5.12-2.899-6.992s-4.353-2.901-6.993-2.902c-5.448 0-9.879 4.432-9.881 9.879 0 1.83.509 3.618 1.474 5.176l.216.35-.97 3.541 3.633-.953z"/></svg>
                  </a>
                )}
                {tenant?.social_telegram && (
                  <a href={tenant.social_telegram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.891 8.146l-1.92 9.043c-.145.641-.523.797-1.061.498l-2.92-2.152-1.408 1.355c-.155.155-.285.285-.585.285l.209-2.964 5.394-4.873c.234-.209-.051-.325-.363-.117l-6.666 4.197-2.872-.899c-.624-.195-.636-.624.13-.923l11.222-4.326c.519-.195.973.117.84 1.012z"/></svg>
                  </a>
                )}
              </div>
            </div>
            
            {/* Columna 2: Servicios */}
            <div className="space-y-8">
              <h4 className="text-xl font-bold text-white tracking-tight">Servicios</h4>
              <ul className="space-y-5">
                <li>
                  <button onClick={() => setActiveModal('instalacion')} className="flex items-center gap-3 text-slate-400 hover:text-white group transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/></svg>
                    <span className="text-[14px] font-bold italic tracking-wide">{tt('link_install')}</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveModal('mantenimiento')} className="flex items-center gap-3 text-slate-400 hover:text-white group transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4"/></svg>
                    <span className="text-[14px] font-bold italic tracking-wide">{tt('link_maint')}</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveModal('reparacion')} className="flex items-center gap-3 text-slate-400 hover:text-white group transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/></svg>
                    <span className="text-[14px] font-bold italic tracking-wide">{tt('link_repair')}</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveModal('garantias')} className="flex items-center gap-3 text-slate-400 hover:text-white group transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    <span className="text-[14px] font-bold italic tracking-wide">{tt('link_warranty')}</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Columna 3: Legal */}
            <div className="space-y-8">
              <h4 className="text-xl font-bold text-white tracking-tight">Legal</h4>
              <ul className="space-y-5">
                <li>
                  <button onClick={() => setActiveModal('privacidad')} className="flex items-center gap-3 text-slate-400 hover:text-white group transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <span className="text-[14px] font-bold italic tracking-wide">{tt('link_privacy')}</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveModal('cookies')} className="flex items-center gap-3 text-slate-400 hover:text-white group transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 8a3.97 3.97 0 0 0 3-1.35 3.97 3.97 0 0 0 1.35 3 3.97 3.97 0 0 0-1.35 3 3.97 3.97 0 0 0-3 1.35 3.97 3.97 0 0 0-3-1.35 3.97 3.97 0 0 0-1.35-3 3.97 3.97 0 0 0 1.35-3A3.97 3.97 0 0 0 12 8zM12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2z"/></svg>
                    <span className="text-[14px] font-bold italic tracking-wide">{tt('link_cookies')}</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveModal('aviso_legal')} className="flex items-center gap-3 text-slate-400 hover:text-white group transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>
                    <span className="text-[14px] font-bold italic tracking-wide">{tt('link_legal')}</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Columna 4: Contacto */}
            <div className="space-y-8">
              <h4 className="text-xl font-bold text-white tracking-tight">Contacto</h4>
              
              <div className="space-y-8">
                {branches.length > 0 ? branches.map((branch) => (
                  <div key={branch.id} className="flex gap-3 items-start">
                    <svg className="w-5 h-5 text-blue-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-black uppercase text-white mb-1 tracking-wider">{branch.name}</span>
                      <p className="text-slate-400 text-[13px] font-medium leading-relaxed whitespace-pre-line">
                        {branch.address}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-[12px] font-medium text-slate-500 italic">No hay sucursales configuradas.</p>
                )}

                {(tenant?.phone || tenant?.email) && (
                  <div className="pt-4 space-y-4">
                    {tenant?.phone && (
                      <div className="flex gap-3 items-center text-slate-400">
                        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        <span className="text-[15px] font-bold">{tenant.phone}</span>
                      </div>
                    )}
                    {tenant?.email && (
                      <div className="flex gap-3 items-center text-slate-400">
                        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        <span className="text-[15px] font-bold">{tenant.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-white/10 flex justify-center">
            <div className="text-[11px] font-medium text-slate-500 italic">
              © {currentYear} {tenant?.name || 'ecoefficient'} Todos los derechos reservados.
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
