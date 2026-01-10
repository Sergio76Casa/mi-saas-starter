
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

  // Resolución robusta de descripción del footer: prioridad DB
  const footerDescription = (() => {
    const descEs = (tenant?.footer_description_es || '').trim();
    const descCa = (tenant?.footer_description_ca || '').trim();
    if (language === 'ca') return descCa || descEs || "Som experts en climatització eficient.";
    return descEs || descCa || "Expertos en climatización eficiente.";
  })();

  return (
    <>
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

      <footer className="bg-slate-950 text-white pt-24 pb-12 relative overflow-hidden text-left border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
            {/* Branding */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                {tenant?.use_logo_on_web && tenant?.logo_url ? (
                  <img src={tenant.logo_url} className="h-10 w-auto object-contain brightness-0 invert" alt={tenant?.name} />
                ) : (
                  <span className="text-2xl font-black italic tracking-tighter uppercase text-white">{tenant?.name}</span>
                )}
              </div>
              <p className="text-slate-400 text-[14px] font-medium leading-relaxed max-w-xs italic whitespace-pre-line">
                {footerDescription}
              </p>
              
              <div className="flex flex-wrap gap-4">
                {tenant?.social_instagram && (
                  <a href={tenant.social_instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="Instagram">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM16.5 5c-.44 0-.8.36-.8.8s.36.8.8.8.8-.36.8-.8-.36-.8-.8-.8zm1.5 2.5v9c0 2.48-2.02 4.5-4.5 4.5h-3C8.02 21 6 18.98 6 16.5v-9C6 5.02 8.02 3 10.5 3h3c2.48 0 4.5 2.02 4.5 4.5z"/></svg>
                  </a>
                )}
                {tenant?.social_tiktok && (
                  <a href={tenant.social_tiktok} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="TikTok">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1 .05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>
                  </a>
                )}
                {tenant?.social_youtube && (
                  <a href={tenant.social_youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="YouTube">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.5 6.2c-.28-1.04-1.1-1.85-2.13-2.12C19.49 3.5 12 3.5 12 3.5s-7.49 0-9.37.58c-1.03.27-1.85 1.08-2.13 2.12C0 8.08 0 12 0 12s0 3.92.5 5.8c.28 1.04 1.1 1.85 2.13 2.12 1.88.58 9.37.58 9.37.58s7.49 0 9.37-.58c1.03-.27 1.85-1.08 2.13-2.12.5-1.88.5-5.8.5-5.8s0-3.92-.5-5.8zm-13.5 9V9l6 3-6 3z"/></svg>
                  </a>
                )}
                {tenant?.social_whatsapp && (
                  <a href={tenant.social_whatsapp} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="WhatsApp">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412s-1.239 6.167-3.488 8.413c-2.248 2.244-5.231 3.484-8.411 3.484h-.001c-2.008 0-3.975-.521-5.714-1.506l-6.276 1.649zm6.151-3.692l.332.197c1.472.873 3.136 1.335 4.845 1.335h.001c5.446 0 9.876-4.43 9.878-9.876.001-2.64-1.029-5.12-2.899-6.992s-4.353-2.901-6.993-2.902c-5.448 0-9.879 4.432-9.881 9.879 0 1.83.509 3.618 1.474 5.176l.216.35-.97 3.541 3.633-.953z"/></svg>
                  </a>
                )}
                {tenant?.social_telegram && (
                  <a href={tenant.social_telegram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="Telegram">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.26.26-.53.26l.213-3.05 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                  </a>
                )}
                {tenant?.social_facebook && (
                  <a href={tenant.social_facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="Facebook">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
                  </a>
                )}
                {tenant?.social_x && (
                  <a href={tenant.social_x} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="X (Twitter)">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.497h2.039L6.482 2.395h-2.19L17.607 20.65z"/></svg>
                  </a>
                )}
                {tenant?.social_linkedin && (
                  <a href={tenant.social_linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all" title="LinkedIn">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                  </a>
                )}
              </div>
            </div>
            
            {/* Servicios */}
            <div className="space-y-8">
              <h4 className="text-xl font-bold text-white tracking-tight">Servicios</h4>
              <ul className="space-y-4">
                <li><button onClick={()=>setActiveModal('instalacion')} className="text-slate-400 hover:text-white font-bold italic text-sm">{tt('link_install')}</button></li>
                <li><button onClick={()=>setActiveModal('mantenimiento')} className="text-slate-400 hover:text-white font-bold italic text-sm">{tt('link_maint')}</button></li>
                <li><button onClick={()=>setActiveModal('reparacion')} className="text-slate-400 hover:text-white font-bold italic text-sm">{tt('link_repair')}</button></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-8">
              <h4 className="text-xl font-bold text-white tracking-tight">Información</h4>
              <ul className="space-y-4">
                <li><button onClick={()=>setActiveModal('privacidad')} className="text-slate-400 hover:text-white font-bold italic text-sm">{tt('link_privacy')}</button></li>
                <li><button onClick={()=>setActiveModal('aviso_legal')} className="text-slate-400 hover:text-white font-bold italic text-sm">{tt('link_legal')}</button></li>
              </ul>
            </div>

            {/* Contacto */}
            <div className="space-y-8">
              <h4 className="text-xl font-bold text-white tracking-tight">Contacto</h4>
              <div className="space-y-6">
                {branches.length > 0 ? branches.map((b, i) => (
                  <div key={i} className="flex flex-col gap-1 border-l-2 border-blue-500 pl-4">
                    <span className="text-xs font-black uppercase text-white">{b.name}</span>
                    <span className="text-xs text-slate-400 leading-tight">{b.address}</span>
                    {b.phone && <span className="text-[10px] font-bold text-blue-400">{b.phone}</span>}
                  </div>
                )) : (
                  <p className="text-xs text-slate-500 italic">Consulte disponibilidad.</p>
                )}
                
                {(tenant?.phone || tenant?.email) && (
                  <div className="pt-4 border-t border-white/5">
                    {tenant?.phone && <div className="text-sm font-black text-white">{tenant.phone}</div>}
                    {tenant?.email && <div className="text-sm font-bold text-slate-400">{tenant.email}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex justify-center">
            <div className="text-[11px] font-medium text-slate-600 italic">
              © {currentYear} {tenant?.name || 'ecoefficient'} Todos los derechos reservados.
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
