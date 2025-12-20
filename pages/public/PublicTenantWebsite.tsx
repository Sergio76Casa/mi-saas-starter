import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant } from '../../types';
import { formatCurrency } from '../../i18n';
import { useApp } from '../../AppProvider';
import { PDF_PRODUCTS, PDF_KITS, PDF_EXTRAS } from '../../data/pdfCatalog';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { dbHealthy, language, setLanguage } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // States for Wizard & UI
  const [view, setView] = useState<'landing' | 'wizard'>('landing');
  const [step, setStep] = useState(1);
  const [brandFilter, setBrandFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [maxPrice, setMaxPrice] = useState(2100);

  // States for Contact Modal
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '', cp: '', wo: ''
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [isSigned, setIsSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!isConfigured || !dbHealthy) { setLoading(false); return; }
      const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (data) setTenant(data);
      setLoading(false);
    };
    fetchTenant();
  }, [slug, dbHealthy]);

  // Force scroll to top when view or step changes
  useEffect(() => {
    if (view === 'wizard') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [view, step]);

  // Group products by Brand for the catalog grid as requested
  const brandGroups = useMemo(() => {
    const groups: Record<string, { 
      brand: string, 
      minPrice: number, 
      products: any[], 
      features: string[] 
    }> = {};

    PDF_PRODUCTS.forEach(p => {
      const brand = p.name.split(' ')[0]; // Extract brand (first token)
      if (!groups[brand]) {
        groups[brand] = { 
          brand, 
          minPrice: p.price, 
          products: [], 
          features: ['Garantía Oficial', 'Bajo Consumo'] 
        };
      }
      groups[brand].products.push(p);
      if (p.price < groups[brand].minPrice) groups[brand].minPrice = p.price;
      
      // Infer features from descriptions and names
      if (p.desc.toLowerCase().includes('a++') && !groups[brand].features.includes('Eficiencia A++')) groups[brand].features.push('Eficiencia A++');
      if (p.desc.toLowerCase().includes('a+++') && !groups[brand].features.includes('Eficiencia A+++')) groups[brand].features.push('Eficiencia A+++');
      if (p.desc.toLowerCase().includes('multi-split') && !groups[brand].features.includes('Multi-split')) groups[brand].features.push('Multi-split');
      if (p.desc.toLowerCase().includes('inverter') && !groups[brand].features.includes('Tecnología Inverter')) groups[brand].features.push('Inverter');
      if (p.desc.toLowerCase().includes('pequeñas') || p.desc.toLowerCase().includes('grandes')) {
        if (!groups[brand].features.includes('Adaptable')) groups[brand].features.push('Adaptable');
      }
    });

    return Object.values(groups).filter(g => {
      const matchesBrandFilter = !brandFilter || g.brand.includes(brandFilter);
      const matchesPriceFilter = g.minPrice <= maxPrice;
      return matchesBrandFilter && matchesPriceFilter;
    });
  }, [brandFilter, maxPrice]);

  // Navigation Logic
  const navigateToHome = () => {
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToCatalog = () => {
    const scrollToCatalog = () => {
      const el = document.getElementById('catalog');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };
    if (view !== 'landing') {
      setView('landing');
      setTimeout(scrollToCatalog, 100);
    } else {
      scrollToCatalog();
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      alert("Por favor, rellene los campos obligatorios.");
      return;
    }
    setContactStatus('sending');
    setTimeout(() => {
      setContactStatus('success');
      setTimeout(() => {
        setIsContactModalOpen(false);
        setContactStatus('idle');
        setContactForm({ name: '', email: '', phone: '', message: '' });
      }, 2000);
    }, 1000);
  };

  // Canvas Logic for Signature
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setIsSigned(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsSigned(false);
    }
  };

  const validateStep4 = () => {
    const errors: any = {};
    const emailRegex = /\S+@\S+\.\S+/;
    if (!formData.name) errors.name = 'Nombre requerido';
    if (!emailRegex.test(formData.email)) errors.email = 'Email inválido';
    if (!/^\d{9,}$/.test(formData.phone)) errors.phone = 'Mínimo 9 dígitos';
    if (!formData.address) errors.address = 'Dirección requerida';
    if (!/^\d{5}$/.test(formData.cp)) errors.cp = 'CP: 5 dígitos';
    if (!/^\d{8}$/.test(formData.wo)) errors.wo = 'WO: 8 dígitos';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-12 text-center">
       <div className="animate-in fade-in zoom-in duration-500">
         <h1 className="text-9xl font-black text-slate-100 mb-4 tracking-tighter uppercase italic">404</h1>
         <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Error: Empresa no encontrada</p>
         <Link to="/" className="mt-10 inline-block px-8 py-3 bg-blue-600 text-white rounded-full font-black uppercase text-[10px]">Volver</Link>
       </div>
    </div>
  );

  const subtotal = (selectedProduct?.price || 0) + (selectedKit?.price || 0) + selectedExtras.reduce((acc, n) => acc + (PDF_EXTRAS.find(e => n === e.name)?.price || 0), 0);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-600/20">
      {/* Header Estilo Enterprise */}
      <nav className="flex items-center justify-between px-6 md:px-16 py-6 sticky top-0 bg-white/90 backdrop-blur-md z-[60] border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white shadow-sm rounded-lg flex items-center justify-center overflow-hidden border border-slate-50 relative">
             <div className="w-6 h-6 bg-blue-500 rounded-full blur-[2px] opacity-20 absolute"></div>
             <svg className="w-8 h-8 text-blue-600 relative" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
          </div>
          <div className="flex flex-col -gap-1">
             <span className="text-xl font-black italic tracking-tighter uppercase leading-none">eco-efficient</span>
             <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none ml-1">Instal·lacions Integrals</span>
          </div>
        </div>
        <div className="flex items-center gap-10">
          <div className="hidden lg:flex items-center gap-8">
            <button onClick={navigateToHome} className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${view === 'landing' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>Inicio</button>
            <button onClick={navigateToCatalog} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Productos</button>
            <button onClick={() => setIsContactModalOpen(true)} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">Contacto</button>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer border border-slate-100 rounded-lg px-2 py-1 bg-slate-50">
              <button onClick={() => setLanguage('es')} className={`px-1.5 rounded ${language === 'es' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>ES</button>
              <button onClick={() => setLanguage('ca')} className={`px-1.5 rounded ${language === 'ca' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>CA</button>
            </div>
            <button onClick={() => navigate(`/t/${slug}/dashboard`)} className="p-2 text-slate-400 hover:text-slate-900 transition-all bg-slate-50 rounded-lg hover:shadow-sm border border-slate-100 flex items-center gap-2 px-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span className="text-[10px] font-black uppercase tracking-widest">Admin</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Modal de Contacto */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-14 w-full max-w-xl shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setIsContactModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            
            {contactStatus === 'success' ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 className="text-3xl font-black italic uppercase italic">¡Enviado!</h3>
                <p className="text-slate-400 font-medium italic mt-2">Pronto nos pondremos en contacto contigo.</p>
              </div>
            ) : (
              <>
                <h3 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-4">Contacto</h3>
                <p className="text-slate-400 font-medium italic mb-10">Rellena el formulario para solicitar asistencia.</p>
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Nombre completo *" placeholder="Nombre" value={contactForm.name} onChange={(e:any) => setContactForm({...contactForm, name: e.target.value})} required />
                    <Input label="Email *" type="email" placeholder="Email" value={contactForm.email} onChange={(e:any) => setContactForm({...contactForm, email: e.target.value})} required />
                  </div>
                  <Input label="Teléfono" placeholder="Teléfono" value={contactForm.phone} onChange={(e:any) => setContactForm({...contactForm, phone: e.target.value})} />
                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Mensaje *</label>
                    <textarea 
                      className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-gray-50/50 h-32 resize-none" 
                      placeholder="Cuéntanos..." 
                      value={contactForm.message} 
                      onChange={(e) => setContactForm({...contactForm, message: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cancelar</button>
                    <button type="submit" disabled={contactStatus === 'sending'} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl shadow-blue-600/30 active:scale-95 transition-all">
                      {contactStatus === 'sending' ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'landing' ? (
        <main className="animate-in fade-in duration-1000 pb-40">
          {/* Hero Section */}
          <div className="px-6 md:px-12 pt-6">
            <section className="relative rounded-[2.5rem] h-[650px] overflow-hidden group shadow-2xl">
              <img src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Hero Background" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/30 to-transparent"></div>
              <div className="relative h-full flex flex-col justify-center items-start px-12 md:px-24 max-w-4xl text-left">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/90 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-white/20">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                  Tecnología Inverter 2024
                </div>
                <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.9] tracking-tighter mb-10 uppercase">
                  Clima perfecto, <br/>
                  <span className="text-blue-400 italic">Ahorro real.</span>
                </h1>
                <p className="text-lg md:text-xl text-white/80 max-w-xl font-medium leading-relaxed mb-12">
                  Transforma tu hogar con nuestras soluciones de climatización de alta eficiencia. Instalación profesional, financiación a medida y las mejores marcas del mercado.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button onClick={navigateToCatalog} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 flex items-center gap-3 active:scale-95">
                    Ver Catálogo
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                  </button>
                  <button onClick={() => { setView('wizard'); setStep(1); }} className="px-10 py-5 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest hover:bg-white/20 transition-all active:scale-95">
                    Pedir Presupuesto
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Cómo funciona */}
          <section className="py-32 bg-slate-50 px-10 border-y border-slate-100 mt-20">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-24">
                <h2 className="text-5xl font-black tracking-tight uppercase italic leading-none mb-4">¿Cómo funciona?</h2>
                <div className="w-24 h-2 bg-blue-600 mx-auto mt-6 rounded-full"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                 {[
                   { t: "1. Selecciona", d: "Elige la marca y el equipo que mejor se adapte a tu hogar.", i: "❄️" },
                   { t: "2. Configura", d: "Añade kits de instalación y materiales adicionales personalizados.", i: "⚙️" },
                   { t: "3. Firma", d: "Valida tu presupuesto con firma digital y descárgalo al instante.", i: "✍️" }
                 ].map((s, i) => (
                   <div key={i} className="bg-white p-14 rounded-[3.5rem] border border-slate-200/60 shadow-sm hover:shadow-2xl transition-all group text-left">
                      <div className="text-5xl mb-10 group-hover:scale-125 transition-transform inline-block">{s.i}</div>
                      <h3 className="text-2xl font-black mb-6 uppercase italic leading-none">{s.t}</h3>
                      <p className="text-slate-400 font-medium italic leading-relaxed text-sm">{s.d}</p>
                   </div>
                 ))}
              </div>
            </div>
          </section>

          {/* Grid de Catálogo por Marcas */}
          <section id="catalog" className="py-32 px-6 md:px-12 scroll-mt-24">
             <div className="max-w-7xl mx-auto">
               <div className="text-left mb-16">
                  <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">Catálogo Destacado</h2>
                  <p className="text-slate-400 font-bold text-sm italic">Soluciones integrales de climatización profesional.</p>
               </div>
               
               {/* Barra de Filtros */}
               <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 mb-20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
                 <div className="flex flex-col gap-4 w-full md:w-auto">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                     Búsqueda
                   </span>
                   <div className="flex flex-wrap gap-2">
                     {['Todos', 'Split', 'Conductos', 'Multi-split'].map(t => (
                       <button key={t} onClick={() => setTypeFilter(t)} className={`px-6 py-3 rounded-full text-[12px] font-bold transition-all ${typeFilter === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{t}</button>
                     ))}
                   </div>
                 </div>

                 <div className="h-10 w-px bg-slate-100 hidden md:block"></div>

                 <div className="flex flex-col gap-4 w-full md:w-auto">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar por Marca</span>
                   <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-600 outline-none w-full md:w-56 appearance-none cursor-pointer">
                     <option value="">Todas las marcas</option>
                     <option value="COMFEE">Comfee</option>
                     <option value="MIDEA">Midea</option>
                   </select>
                 </div>

                 <div className="h-10 w-px bg-slate-100 hidden md:block"></div>

                 <div className="flex flex-col gap-4 w-full md:w-auto flex-1 max-w-xs">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Precio Máximo</span>
                     <span className="text-[12px] font-black text-blue-600">{maxPrice} €</span>
                   </div>
                   <input type="range" min="0" max="3000" value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))} className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg" />
                 </div>
               </div>

               {/* Grid agrupado por Marca */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                  {brandGroups.map(group => (
                    <div key={group.brand} className="group bg-white rounded-[4rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all flex flex-col text-left relative overflow-hidden">
                       <div className="h-64 bg-slate-50 rounded-[3.5rem] mb-10 flex items-center justify-center relative shadow-inner overflow-hidden">
                          <div className="absolute top-6 left-6 w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center p-2 opacity-80">
                            <span className="text-[8px] font-black text-slate-400">BRAND</span>
                          </div>
                          <svg className="w-24 h-24 text-blue-100 group-hover:scale-110 transition-transform duration-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          <div className="absolute top-8 right-8 px-4 py-2 bg-white text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">Gama {group.brand}</div>
                       </div>
                       
                       <h3 className="text-4xl font-black mb-1 uppercase italic tracking-tighter">{group.brand}</h3>
                       <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-8 italic">Varios modelos disponibles en el asistente</p>
                       
                       {/* Feature Chips */}
                       <div className="flex flex-wrap gap-2 mb-12">
                          {group.features.slice(0, 5).map(feat => (
                            <span key={feat} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-black uppercase border border-slate-100 tracking-wider">
                              {feat}
                            </span>
                          ))}
                       </div>

                       <div className="flex items-center justify-between border-t border-slate-50 pt-10 mt-auto">
                          <div>
                             <p className="text-[40px] font-black text-slate-900 tracking-tighter leading-none">
                                <span className="text-lg text-slate-300 mr-2 uppercase italic font-bold">Desde</span>
                                {formatCurrency(group.minPrice, language)}
                             </p>
                          </div>
                          <button 
                            onClick={() => { 
                              setSelectedProduct(group.products[0]); 
                              setView('wizard'); 
                              setStep(1); 
                            }} 
                            className="w-16 h-16 bg-blue-600 text-white rounded-[1.8rem] flex items-center justify-center hover:bg-slate-900 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                          >
                             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
             </div>
          </section>
        </main>
      ) : (
        /* Wizard Section */
        <div className="max-w-5xl mx-auto py-24 px-8 animate-in slide-in-from-bottom-12 duration-700">
           {/* Stepper Wizard */}
           <div className="mb-20 flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-50"><div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,0.4)]" style={{ width: `${(step / 5) * 100}%` }}></div></div>
              {[1, 2, 3, 4, 5].map(num => (
                <div key={num} className="flex items-center gap-4 relative z-10">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all border-2 ${step === num ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-110' : step > num ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-white border-slate-100 text-slate-200'}`}>
                      {step > num ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg> : num}
                   </div>
                   <div className="hidden lg:block text-left leading-none">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${step >= num ? 'text-slate-900' : 'text-slate-400'}`}>
                        {num === 1 ? 'Producto' : num === 2 ? 'Instalación' : num === 3 ? 'Extras' : num === 4 ? 'Cliente' : 'Firma'}
                      </p>
                   </div>
                </div>
              ))}
           </div>

           <div className="bg-white p-12 md:p-20 rounded-[4.5rem] border border-slate-100 shadow-2xl relative text-left min-h-[500px] flex flex-col">
              {step === 1 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-4xl font-black tracking-tighter mb-10 italic leading-none uppercase">
                     Modelos {selectedProduct?.name.split(' ')[0]} disponibles
                   </h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {PDF_PRODUCTS.filter((p: any) => !selectedProduct || p.name.split(' ')[0] === selectedProduct.name.split(' ')[0]).map((p: any) => (
                        <button 
                          key={p.id} 
                          onClick={() => setSelectedProduct(p)}
                          className={`p-10 rounded-[3rem] border-2 text-left transition-all relative group flex flex-col h-full ${selectedProduct?.id === p.id ? 'border-blue-600 bg-blue-50 shadow-xl' : 'border-slate-100 hover:border-blue-200 bg-white'}`}
                        >
                           {selectedProduct?.id === p.id && (
                             <div className="absolute top-8 right-8 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                             </div>
                           )}
                           <div className="mb-4">
                              <span className="px-3 py-1 bg-white border border-blue-100 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                                Máxima Eficiencia
                              </span>
                           </div>
                           <h3 className="font-black text-2xl text-slate-900 uppercase italic mb-3 leading-none">{p.name}</h3>
                           <p className="text-slate-400 text-sm italic mb-8 line-clamp-2 flex-1">{p.desc}</p>
                           <div className="flex justify-between items-end border-t border-slate-100/50 pt-6 mt-4">
                              <div className="flex flex-col">
                                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Garantía</span>
                                 <span className="text-[11px] font-bold text-slate-600">Instalación Incluida</span>
                              </div>
                              <p className="text-3xl font-black text-blue-600 tracking-tighter">{formatCurrency(p.price, language)}</p>
                           </div>
                        </button>
                      ))}
                   </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-5xl font-black tracking-tighter mb-12 italic leading-none uppercase">Kit de Instalación</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {PDF_KITS.map(kit => (
                        <button key={kit.name} onClick={() => setSelectedKit(kit)} className={`p-10 rounded-[3rem] border-2 text-left transition-all relative group ${selectedKit?.name === kit.name ? 'border-blue-600 bg-blue-50/50 shadow-xl' : 'border-slate-100 hover:border-blue-200 bg-white'}`}>
                           {selectedKit?.name === kit.name && <div className="absolute top-8 right-8 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg></div>}
                           <h3 className="font-black text-2xl text-slate-900 uppercase italic mb-2 leading-none">{kit.name}</h3>
                           <p className="text-3xl font-black text-blue-600">{formatCurrency(kit.price, language)}</p>
                        </button>
                      ))}
                   </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-5xl font-black tracking-tighter mb-12 italic leading-none uppercase">Materiales Extras</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[400px] pr-2">
                      {PDF_EXTRAS.map(extra => {
                        const isSel = selectedExtras.includes(extra.name);
                        return (
                          <button key={extra.name} onClick={() => setSelectedExtras(prev => isSel ? prev.filter(i => i !== extra.name) : [...prev, extra.name])} className={`flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all ${isSel ? 'border-blue-600 bg-blue-50' : 'border-slate-50 bg-slate-50/50'}`}>
                             <div className="text-left"><p className="font-bold text-[11px] uppercase text-slate-900 leading-tight">{extra.name}</p><p className="text-xs font-black text-blue-600 mt-1">{formatCurrency(extra.price, language)}</p></div>
                             <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center ${isSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>{isSel && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}</div>
                          </button>
                        );
                      })}
                   </div>
                </div>
              )}

              {step === 4 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-5xl font-black tracking-tighter mb-12 italic leading-none uppercase">Datos de Facturación</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                      <div><Input label="Nombre Completo" value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />{formErrors.name && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.name}</p>}</div>
                      <div><Input label="Email" type="email" value={formData.email} onChange={(e:any) => setFormData({...formData, email: e.target.value})} />{formErrors.email && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.email}</p>}</div>
                      <div><Input label="Teléfono" value={formData.phone} onChange={(e:any) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} />{formErrors.phone && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.phone}</p>}</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Input label="CP" value={formData.cp} onChange={(e:any) => setFormData({...formData, cp: e.target.value.slice(0,5).replace(/\D/g,'')})} />{formErrors.cp && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.cp}</p>}</div>
                        <div><Input label="WO" value={formData.wo} onChange={(e:any) => setFormData({...formData, wo: e.target.value.slice(0,8).replace(/\D/g,'')})} />{formErrors.wo && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.wo}</p>}</div>
                      </div>
                      <div className="md:col-span-2"><Input label="Dirección de instalación" value={formData.address} onChange={(e:any) => setFormData({...formData, address: e.target.value})} />{formErrors.address && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.address}</p>}</div>
                   </div>
                </div>
              )}

              {step === 5 && (
                <div className="animate-in fade-in duration-500 flex-1 text-center">
                   <h2 className="text-5xl font-black tracking-tighter mb-4 italic leading-none uppercase">Validar Presupuesto</h2>
                   <p className="text-slate-400 mb-12 font-medium italic">Firme en el recuadro inferior para emitir el presupuesto oficial.</p>
                   <div className="max-w-xl mx-auto border-4 border-slate-100 rounded-[3.5rem] bg-white shadow-inner mb-6 relative overflow-hidden h-80">
                      <canvas ref={canvasRef} width={600} height={320} className="w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                      {!isSigned && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-100 text-6xl font-black opacity-30 uppercase italic">Firme Aquí</div>}
                   </div>
                   <button onClick={clearCanvas} className="text-red-500 font-black uppercase text-[10px] tracking-widest hover:underline mb-12">Limpiar Firma</button>
                   <div className="max-w-xl mx-auto bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden text-left mb-10 group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] rounded-full group-hover:scale-110 transition-transform duration-700"></div>
                      <div className="flex justify-between items-end"><span className="text-2xl font-black italic uppercase">Inversión Final</span><span className="text-5xl font-black text-blue-600 tracking-tighter">{formatCurrency(subtotal, language)}</span></div>
                   </div>
                </div>
              )}

              <div className="flex gap-4 mt-auto pt-10 border-t border-slate-50">
                {step > 1 && <button onClick={() => setStep(step - 1)} className="px-10 py-6 border-2 border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Atrás</button>}
                <button onClick={() => {
                    if (step === 1 && !selectedProduct) return alert('Selecciona unidad');
                    if (step === 2 && !selectedKit) return alert('Selecciona kit');
                    if (step === 4 && !validateStep4()) return;
                    if (step === 5) {
                      if (!isSigned) return alert('Firma obligatoria');
                      alert('¡Presupuesto generado con éxito!');
                      setView('landing'); return;
                    }
                    setStep(step + 1);
                  }} className={`flex-1 py-7 ${step === 5 ? 'bg-blue-600' : 'bg-slate-900'} text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3`}>
                   {step === 5 ? 'Finalizar Presupuesto' : 'Continuar'}
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
              </div>
           </div>
        </div>
      )}

      <footer className="py-32 border-t border-slate-100 text-center bg-white mt-40">
         <div className="flex items-center justify-center gap-2 mb-10 opacity-30 grayscale">
            <svg className="w-10 h-10 text-slate-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
            <span className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">{tenant?.name}</span>
         </div>
         <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic">© 2025 · EcoQuote AI · Smart Installation Solution</div>
      </footer>
    </div>
  );
};
