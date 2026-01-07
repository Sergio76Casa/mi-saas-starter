
import React, { useState } from 'react';
import { Tenant, Language } from '../../types';

interface PublicFooterProps {
  tenant: Tenant | null;
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

export const PublicFooter: React.FC<PublicFooterProps> = ({ tenant, language, translations }) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const tt = (key: string) => {
    if (!translations) return key;
    const langSet = translations[language] || translations['es'] || {};
    return langSet[key] || translations['es']?.[key] || key;
  };
  
  const modalContent = activeModal ? FOOTER_MODAL_CONTENT[activeModal] : null;

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

      <footer className="bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white pt-24 pb-12 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20 text-left">
            <div className="space-y-8 text-left">
              <div className="flex items-center gap-3">
                {tenant?.use_logo_on_web && tenant?.logo_url ? (
                  <img src={tenant.logo_url} className="h-10 w-auto object-contain brightness-0 invert" alt={tenant?.name} />
                ) : (
                  <span className="text-2xl font-black italic tracking-tighter uppercase text-white">{tenant?.name || 'EMPRESA'}</span>
                )}
              </div>
              <p className="text-slate-400 text-[13px] font-medium leading-relaxed max-w-xs italic">
                {language === 'ca' 
                  ? (tenant?.footer_description_ca || tenant?.footer_description_es || "Som experts en solucions de climatització.")
                  : (tenant?.footer_description_es || tenant?.footer_description_ca || "Expertos en climatización.")
                }
              </p>
            </div>
            
            <div className="space-y-8 text-left">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Servicios</h4>
              <ul className="space-y-4">
                <li><button onClick={() => setActiveModal('instalacion')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('link_install')}</button></li>
                <li><button onClick={() => setActiveModal('mantenimiento')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('link_maint')}</button></li>
                <li><button onClick={() => setActiveModal('reparacion')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('link_repair')}</button></li>
              </ul>
            </div>

            <div className="space-y-8 text-left">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Empresa</h4>
              <ul className="space-y-4">
                <li><button onClick={() => setActiveModal('garantias')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('link_warranty')}</button></li>
                <li><button onClick={() => {
                  const el = document.getElementById('catalog');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('nav_products')}</button></li>
              </ul>
            </div>

            <div className="space-y-8 text-left">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Legal</h4>
              <ul className="space-y-4">
                <li><button onClick={() => setActiveModal('privacidad')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('link_privacy')}</button></li>
                <li><button onClick={() => setActiveModal('cookies')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('link_cookies')}</button></li>
                <li><button onClick={() => setActiveModal('aviso_legal')} className="text-slate-400 hover:text-white text-[13px] font-bold uppercase tracking-widest italic transition-colors">{tt('link_legal')}</button></li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
              © 2025 · {tenant?.name || 'EcoQuote'} · {tt('footer_copy')}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
