import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant } from '../../types';
import { formatCurrency } from '../../i18n';
import { useApp } from '../../AppProvider';
import { PDF_KITS, PDF_EXTRAS } from '../../data/pdfCatalog';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

type PublicCatalogResponse = { 
  tenant: { 
    id?: string; 
    name: string; 
    slug: string 
  }; 
  products: Array<{ 
    id: string; 
    name: string; 
    description?: string; 
    price: number; 
    category?: string;
    is_active?: boolean 
  }>; 
};

// Local translations for the Public Website (ES/CA only)
const LOCAL_I18N = {
  es: {
    nav_home: 'Inicio',
    nav_products: 'Productos',
    nav_contact: 'Contacto',
    nav_admin: 'Admin',
    nav_admin_btn: 'ADMIN',
    error_404_msg: 'Error: Empresa no encontrada',
    error_404_btn: 'Volver',
    hero_badge: 'Tecnología Inverter 2024',
    hero_title_1: 'Clima perfecto,',
    hero_title_2: 'Ahorro real.',
    hero_desc: 'Transforma tu hogar con nuestras soluciones de climatización de alta eficiencia. Instalación profesional, financiación a medida y las mejores marcas del mercado.',
    hero_cta_catalog: 'Ver Catálogo',
    hero_cta_wizard: 'Pedir Presupuesto',
    how_it_works: '¿Cómo funciona?',
    step1_title: '1. Selecciona',
    step1_desc: 'Elige la marca y el equipo que mejor se adapte a tu hogar.',
    step2_title: '2. Configura',
    step2_desc: 'Añade kits de instalación y materiales adicionales personalizados.',
    step3_title: '3. Firma',
    step3_desc: 'Valida tu presupuesto con firma digital y descárgalo al instante.',
    catalog_title: 'Catálogo Destacado',
    catalog_subtitle: 'Soluciones integrales de climatización profesional.',
    filter_search: 'Búsqueda',
    filter_brand: 'Filtrar por Marca',
    filter_all_brands: 'Todas las marcas',
    filter_max_price: 'Precio Máximo',
    brand_tag: 'MARCA',
    no_products_filter: 'No hay productos disponibles con estos filtros',
    brand_card_models: 'Varios modelos disponibles en el asistente',
    brand_card_gama: 'Gama',
    brand_card_from: 'Desde',
    brand_feat_warranty: 'Garantía Oficial',
    brand_feat_low_cons: 'Bajo Consumo',
    brand_feat_efficiency: 'Eficiencia',
    brand_feat_adaptable: 'Adaptable',
    wizard_step_product: 'Producto',
    wizard_step_install: 'Instalación',
    wizard_step_extras: 'Extras',
    wizard_step_client: 'Cliente',
    wizard_step_sign: 'Firma',
    wizard_models_available: 'Modelos disponibles',
    wizard_high_efficiency: 'Máxima Eficiencia',
    wizard_install_included: 'Instalación Incluida',
    wizard_status: 'ESTADO',
    wizard_kit_title: 'Kit de Instalación',
    wizard_extras_title: 'Materiales Extras',
    wizard_data_title: 'Datos de Facturación',
    wizard_fullname: 'Nombre Completo',
    wizard_email: 'Correo Electrónico',
    wizard_phone: 'Teléfono',
    wizard_address: 'Dirección',
    wizard_cp: 'CP',
    wizard_wo: 'WO',
    wizard_sign_title: 'Validar Presupuesto',
    wizard_sign_desc: 'Firme en el recuadro inferior para emitir el presupuesto oficial.',
    wizard_sign_here: 'Firme Aquí',
    wizard_clear_sign: 'Limpiar Firma',
    wizard_final_investment: 'Inversión Final',
    wizard_btn_back: 'Atrás',
    wizard_btn_continue: 'Continuar',
    wizard_btn_finish: 'Finalizar Presupuesto',
    contact_title: 'Contacto',
    contact_desc: 'Rellena el formulario para solicitar asistencia.',
    contact_phone: 'Teléfono',
    contact_message: 'Mensaje *',
    contact_success: '¡Enviado!',
    contact_success_desc: 'Pronto nos pondremos en contacto contigo.',
    contact_btn_cancel: 'Cancelar',
    contact_btn_send: 'Enviar',
    contact_sending: 'Enviando...',
    val_name_req: 'Nombre requerido',
    val_email_inv: 'Email inválido',
    val_phone_min: 'Mínimo 9 dígitos',
    val_cp_len: 'CP: 5 dígitos',
    val_wo_len: 'WO: 8 dígitos',
    val_addr_req: 'Dirección requerida',
    alert_sign_req: 'Firma obligatoria',
    alert_unit_req: 'Selecciona unidad',
    alert_kit_req: 'Selecciona kit',
    alert_success: '¡Presupuesto generado con éxito!',
    footer_copy: 'EcoQuote AI · Smart Installation Solution',
    cat_all: 'Todas',
    cat_ac: 'Aire Acondicionado',
    cat_boiler: 'Calderas',
    cat_thermo: 'Termos eléctricos'
  },
  ca: {
    nav_home: 'Inici',
    nav_products: 'Productes',
    nav_contact: 'Contacte',
    nav_admin: 'Admin',
    nav_admin_btn: 'ADMIN',
    error_404_msg: 'Error: Empresa no trobada',
    error_404_btn: 'Tornar',
    hero_badge: 'Tecnologia Inverter 2024',
    hero_title_1: 'Clima perfecte,',
    hero_title_2: 'Estalvi real.',
    hero_desc: 'Transforma la teva llar amb les nostres solucions de climatització d’alta eficiència. Instal·lació professional, finançament a mida i les millors marques del mercat.',
    hero_cta_catalog: 'Veure Catàleg',
    hero_cta_wizard: 'Demanar Pressupost',
    how_it_works: 'Com funciona?',
    step1_title: '1. Selecciona',
    step1_desc: 'Tria la marca i l’equip que millor s’adapti a la teva llar.',
    step2_title: '2. Configura',
    step2_desc: 'Afegeix kits d’instal·lació i materials addicionals personalitzats.',
    step3_title: '3. Firma',
    step3_desc: 'Valida el teu pressupost amb signatura digital i descarrega’l a l’instant.',
    catalog_title: 'Catàleg Destacat',
    catalog_subtitle: 'Solucions integrals de climatització professional.',
    filter_search: 'Cerca',
    filter_brand: 'Filtrar per Marca',
    filter_all_brands: 'Totes les marques',
    filter_max_price: 'Preu Màxim',
    brand_tag: 'MARCA',
    no_products_filter: 'No hi ha productes disponibles amb aquests filtres',
    brand_card_models: 'Diversos models disponibles a l’assistent',
    brand_card_gama: 'Gama',
    brand_card_from: 'Des de',
    brand_feat_warranty: 'Garantia Oficial',
    brand_feat_low_cons: 'Baix Consum',
    brand_feat_efficiency: 'Eficiència',
    brand_feat_adaptable: 'Adaptable',
    wizard_step_product: 'Producte',
    wizard_step_install: 'Instal·lació',
    wizard_step_extras: 'Extras',
    wizard_step_client: 'Client',
    wizard_step_sign: 'Firma',
    wizard_models_available: 'Models disponibles',
    wizard_high_efficiency: 'Màxima Eficiència',
    wizard_install_included: 'Instal·lació Inclosa',
    wizard_status: 'ESTAT',
    wizard_kit_title: 'Kit d’Instal·lació',
    wizard_extras_title: 'Materials Extras',
    wizard_data_title: 'Dades de Facturació',
    wizard_fullname: 'Nom Complet',
    wizard_email: 'Correu Electrònic',
    wizard_phone: 'Telèfon',
    wizard_address: 'Adreça',
    wizard_cp: 'CP',
    wizard_wo: 'WO',
    wizard_sign_title: 'Validar Pressupost',
    wizard_sign_desc: 'Signi en el requadre inferior per emetre el pressupost oficial.',
    wizard_sign_here: 'Signi Aquí',
    wizard_clear_sign: 'Netejar Firma',
    wizard_final_investment: 'Inversió Final',
    wizard_btn_back: 'Enrere',
    wizard_btn_continue: 'Continuar',
    wizard_btn_finish: 'Finalitzar Pressupost',
    contact_title: 'Contacte',
    contact_desc: 'Omple el formulari per sol·licitar assistència.',
    contact_phone: 'Telèfon',
    contact_message: 'Missatge *',
    contact_success: 'Enviat!',
    contact_success_desc: 'Aviat ens posarem en contacte amb tu.',
    contact_btn_cancel: 'Cancel·lar',
    contact_btn_send: 'Enviar',
    contact_sending: 'Enviant...',
    val_name_req: 'Nom requerit',
    val_email_inv: 'Email invàlid',
    val_phone_min: 'Mínim 9 dígits',
    val_cp_len: 'CP: 5 dígits',
    val_wo_len: 'WO: 8 dígits',
    val_addr_req: 'Adreça requerida',
    alert_sign_req: 'Firma obligatòria',
    alert_unit_req: 'Selecciona unitat',
    alert_kit_req: 'Selecciona kit',
    alert_success: 'Pressupost generat amb èxit!',
    footer_copy: 'EcoQuote AI · Smart Installation Solution',
    cat_all: 'Totes',
    cat_ac: 'Aire Condicionat',
    cat_boiler: 'Calderes',
    cat_thermo: 'Termos elèctrics'
  }
} as const;

export const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const { dbHealthy, language, setLanguage } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [dbProducts, setDbProducts] = useState<PublicCatalogResponse['products']>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Helper for local translations based strictly on language
  const tt = (key: keyof typeof LOCAL_I18N['es']) => LOCAL_I18N[language]?.[key] ?? LOCAL_I18N.es[key];

  // States for Wizard & UI
  const [view, setView] = useState<'landing' | 'wizard'>('landing');
  const [step, setStep] = useState(1);
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState(5000);

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
    const fetchCatalog = async () => {
      if (!isConfigured || !dbHealthy) { setLoading(false); return; }
      
      // ONLY LOAD DATA VIA RPC - NO DIRECT TABLE SELECTS IN PUBLIC WEBSITE
      const { data, error } = await supabase.rpc('get_public_catalog', { p_slug: slug });
      
      if (error || !data) {
        setTenant(null);
        setDbProducts([]);
      } else {
        const payload = data as PublicCatalogResponse;
        setTenant(payload.tenant ? (payload.tenant as any) : null);
        setDbProducts(Array.isArray(payload.products) ? payload.products : []);
      }
      setLoading(false);
    };
    fetchCatalog();
  }, [slug, dbHealthy]);

  useEffect(() => {
    if (view === 'wizard') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [view, step]);

  const brandGroups = useMemo(() => {
    const groups: Record<string, { 
      brand: string, 
      minPrice: number, 
      products: any[], 
      features: string[] 
    }> = {};

    dbProducts.forEach(p => {
      // Apply filters here
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesPrice = p.price <= maxPrice;
      const brand = p.name.split(' ')[0];
      const matchesBrand = !brandFilter || brand.includes(brandFilter);

      if (matchesCategory && matchesPrice && matchesBrand) {
        if (!groups[brand]) {
          groups[brand] = { 
            brand, 
            minPrice: p.price, 
            products: [], 
            features: [tt('brand_feat_warranty'), tt('brand_feat_low_cons')] 
          };
        }
        groups[brand].products.push(p);
        if (p.price < groups[brand].minPrice) groups[brand].minPrice = p.price;
        
        const description = (p.description || '').toLowerCase();
        if (description.includes('a++') && !groups[brand].features.includes(`${tt('brand_feat_efficiency')} A++`)) groups[brand].features.push(`${tt('brand_feat_efficiency')} A++`);
        if (description.includes('a+++') && !groups[brand].features.includes(`${tt('brand_feat_efficiency')} A+++`)) groups[brand].features.push(`${tt('brand_feat_efficiency')} A+++`);
        if (description.includes('multi-split') && !groups[brand].features.includes('Multi-split')) groups[brand].features.push('Multi-split');
        if (description.includes('inverter') && !groups[brand].features.includes('Inverter')) groups[brand].features.push('Inverter');
        if ((description.includes('pequeñas') || description.includes('grandes')) && !groups[brand].features.includes(tt('brand_feat_adaptable'))) {
          groups[brand].features.push(tt('brand_feat_adaptable'));
        }
      }
    });

    return Object.values(groups);
  }, [dbProducts, brandFilter, maxPrice, categoryFilter, language]);

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
    if (!formData.name) errors.name = tt('val_name_req');
    if (!emailRegex.test(formData.email)) errors.email = tt('val_email_inv');
    if (!/^\d{9,}$/.test(formData.phone)) errors.phone = tt('val_phone_min');
    if (!formData.address) errors.address = tt('val_addr_req');
    if (!/^\d{5}$/.test(formData.cp)) errors.cp = tt('val_cp_len');
    if (!/^\d{8}$/.test(formData.wo)) errors.wo = tt('val_wo_len');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-12 text-center">
       <div className="animate-in fade-in zoom-in duration-500">
         <h1 className="text-9xl font-black text-slate-100 mb-4 tracking-tighter uppercase italic">404</h1>
         <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{tt('error_404_msg')}</p>
         <Link to="/" className="mt-10 inline-block px-8 py-3 bg-blue-600 text-white rounded-full font-black uppercase text-[10px]">{tt('error_404_btn')}</Link>
       </div>
    </div>
  );

  const subtotal = (selectedProduct?.price || 0) + (selectedKit?.price || 0) + selectedExtras.reduce((acc, n) => acc + (PDF_EXTRAS.find(e => n === e.name)?.price || 0), 0);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-600/20">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 md:px-16 py-6 sticky top-0 bg-white/90 backdrop-blur-md z-[60] border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white shadow-sm rounded-lg flex items-center justify-center overflow-hidden border border-slate-50 relative">
             <div className="w-6 h-6 bg-blue-500 rounded-full blur-[2px] opacity-20 absolute"></div>
             <svg className="w-8 h-8 text-blue-600 relative" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
          </div>
          <div className="flex flex-col -gap-1">
             <span className="text-xl font-black italic tracking-tighter uppercase leading-none">{tenant.name}</span>
             <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none ml-1">Instal·lacions Integrals</span>
          </div>
        </div>
        <div className="flex items-center gap-10">
          <div className="hidden lg:flex items-center gap-8">
            <button onClick={navigateToHome} className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${view === 'landing' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>{tt('nav_home')}</button>
            <button onClick={navigateToCatalog} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">{tt('nav_products')}</button>
            <button onClick={() => setIsContactModalOpen(true)} className="text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors">{tt('nav_contact')}</button>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer border border-slate-100 rounded-lg px-2 py-1 bg-slate-50">
              <button onClick={() => setLanguage('es')} className={`px-1.5 rounded transition-all ${language === 'es' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>ES</button>
              <button onClick={() => setLanguage('ca')} className={`px-1.5 rounded transition-all ${language === 'ca' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>CA</button>
            </div>
            <button onClick={() => navigate(`/t/${slug}/dashboard`)} className="p-2 text-slate-400 hover:text-slate-900 transition-all bg-slate-50 rounded-lg hover:shadow-sm border border-slate-100 flex items-center gap-2 px-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span className="text-[10px] font-black uppercase tracking-widest">{tt('nav_admin_btn')}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Contact Modal */}
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
                <h3 className="text-3xl font-black italic uppercase leading-none">{tt('contact_success')}</h3>
                <p className="text-slate-400 font-medium italic mt-2">{tt('contact_success_desc')}</p>
              </div>
            ) : (
              <>
                <h3 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-4">{tt('contact_title')}</h3>
                <p className="text-slate-400 font-medium italic mb-10">{tt('contact_desc')}</p>
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label={tt('wizard_fullname') + " *"} placeholder={tt('wizard_fullname')} value={contactForm.name} onChange={(e:any) => setContactForm({...contactForm, name: e.target.value})} required />
                    <Input label={tt('wizard_email') + " *"} type="email" placeholder={tt('wizard_email')} value={contactForm.email} onChange={(e:any) => setContactForm({...contactForm, email: e.target.value})} required />
                  </div>
                  <Input label={tt('contact_phone')} placeholder={tt('contact_phone')} value={contactForm.phone} onChange={(e:any) => setContactForm({...contactForm, phone: e.target.value})} />
                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">{tt('contact_message')}</label>
                    <textarea 
                      className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-gray-50/50 h-32 resize-none" 
                      placeholder="..." 
                      value={contactForm.message} 
                      onChange={(e) => setContactForm({...contactForm, message: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{tt('contact_btn_cancel')}</button>
                    <button type="submit" disabled={contactStatus === 'sending'} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl shadow-blue-600/30 active:scale-95 transition-all">
                      {contactStatus === 'sending' ? tt('contact_sending') : tt('contact_btn_send')}
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
          <div className="px-6 md:px-12 pt-6">
            <section className="relative rounded-[2.5rem] h-[650px] overflow-hidden group shadow-2xl">
              <img src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Hero" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/30 to-transparent"></div>
              <div className="relative h-full flex flex-col justify-center items-start px-12 md:px-24 max-w-4xl text-left">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/90 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-white/20">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                  {tt('hero_badge')}
                </div>
                <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.9] tracking-tighter mb-10 uppercase">
                  {tt('hero_title_1')} <br/>
                  <span className="text-blue-400 italic">{tt('hero_title_2')}</span>
                </h1>
                <p className="text-lg md:text-xl text-white/80 max-w-xl font-medium leading-relaxed mb-12">
                  {tt('hero_desc')}
                </p>
                <div className="flex flex-wrap gap-4">
                  <button onClick={navigateToCatalog} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 flex items-center gap-3 active:scale-95">
                    {tt('hero_cta_catalog')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                  </button>
                  <button onClick={() => { setView('wizard'); setStep(1); }} className="px-10 py-5 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-2xl font-black uppercase text-[12px] tracking-widest hover:bg-white/20 transition-all active:scale-95">
                    {tt('hero_cta_wizard')}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="py-32 bg-slate-50 px-10 border-y border-slate-100 mt-20">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-24">
                <h2 className="text-5xl font-black tracking-tight uppercase italic leading-none mb-4">{tt('how_it_works')}</h2>
                <div className="w-24 h-2 bg-blue-600 mx-auto mt-6 rounded-full"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                 {[
                   { t: tt('step1_title'), d: tt('step1_desc'), i: "❄️" },
                   { t: tt('step2_title'), d: tt('step2_desc'), i: "⚙️" },
                   { t: tt('step3_title'), d: tt('step3_desc'), i: "✍️" }
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

          <section id="catalog" className="py-32 px-6 md:px-12 scroll-mt-24">
             <div className="max-w-7xl mx-auto">
               <div className="text-left mb-16">
                  <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-2">{tt('catalog_title')}</h2>
                  <p className="text-slate-400 font-bold text-sm italic">{tt('catalog_subtitle')}</p>
               </div>
               
               <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 mb-20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
                 <div className="flex flex-col gap-4 w-full md:w-auto">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                     Categoría
                   </span>
                   <div className="flex flex-wrap gap-2">
                     {[
                       { id: 'all', label: tt('cat_all') },
                       { id: 'aire_acondicionado', label: tt('cat_ac') },
                       { id: 'caldera', label: tt('cat_boiler') },
                       { id: 'termo_electrico', label: tt('cat_thermo') }
                     ].map(t => (
                       <button key={t.id} onClick={() => setCategoryFilter(t.id)} className={`px-6 py-3 rounded-full text-[12px] font-bold transition-all ${categoryFilter === t.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{t.label}</button>
                     ))}
                   </div>
                 </div>

                 <div className="h-10 w-px bg-slate-100 hidden md:block"></div>

                 <div className="flex flex-col gap-4 w-full md:w-auto">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tt('filter_brand')}</span>
                   <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-600 outline-none w-full md:w-56 appearance-none cursor-pointer">
                     <option value="">{tt('filter_all_brands')}</option>
                     {Array.from(new Set(dbProducts.map(p => p.name.split(' ')[0]))).map(brand => (
                       <option key={brand} value={brand}>{brand}</option>
                     ))}
                   </select>
                 </div>

                 <div className="h-10 w-px bg-slate-100 hidden md:block"></div>

                 <div className="flex flex-col gap-4 w-full md:w-auto flex-1 max-w-xs">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tt('filter_max_price')}</span>
                     <span className="text-[12px] font-black text-blue-600">{maxPrice} €</span>
                   </div>
                   <input type="range" min="0" max="10000" value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))} className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg" />
                 </div>
               </div>

               {brandGroups.length === 0 ? (
                 <div className="py-20 text-center text-slate-300 font-black uppercase tracking-[0.2em] italic">
                   {tt('no_products_filter')}
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                    {brandGroups.map(group => (
                      <div key={group.brand} className="group bg-white rounded-[4rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all flex flex-col text-left relative overflow-hidden">
                         <div className="h-64 bg-slate-50 rounded-[3.5rem] mb-10 flex items-center justify-center relative shadow-inner overflow-hidden">
                            <div className="absolute top-6 left-6 w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center p-2 opacity-80">
                              <span className="text-[8px] font-black text-slate-400">{tt('brand_tag')}</span>
                            </div>
                            <svg className="w-24 h-24 text-blue-100 group-hover:scale-110 transition-transform duration-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            <div className="absolute top-8 right-8 px-4 py-2 bg-white text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">{tt('brand_card_gama')} {group.brand}</div>
                         </div>
                         
                         <h3 className="text-4xl font-black mb-1 uppercase italic tracking-tighter">{group.brand}</h3>
                         <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-8 italic">{tt('brand_card_models')}</p>
                         
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
                                  <span className="text-lg text-slate-300 mr-2 uppercase italic font-bold">{tt('brand_card_from')}</span>
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
               )}
             </div>
          </section>
        </main>
      ) : (
        /* Wizard Section */
        <div className="max-w-5xl mx-auto py-24 px-8 animate-in slide-in-from-bottom-12 duration-700">
           <div className="mb-20 flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-50"><div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,0.4)]" style={{ width: `${(step / 5) * 100}%` }}></div></div>
              {[1, 2, 3, 4, 5].map(num => (
                <div key={num} className="flex items-center gap-4 relative z-10">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all border-2 ${step === num ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-110' : step > num ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-white border-slate-100 text-slate-200'}`}>
                      {step > num ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg> : num}
                   </div>
                   <div className="hidden lg:block text-left leading-none">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${step >= num ? 'text-slate-900' : 'text-slate-400'}`}>
                        {num === 1 ? tt('wizard_step_product') : num === 2 ? tt('wizard_step_install') : num === 3 ? tt('wizard_step_extras') : num === 4 ? tt('wizard_step_client') : tt('wizard_step_sign')}
                      </p>
                   </div>
                </div>
              ))}
           </div>

           <div className="bg-white p-12 md:p-20 rounded-[4.5rem] border border-slate-100 shadow-2xl relative text-left min-h-[500px] flex flex-col">
              {step === 1 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-4xl font-black tracking-tighter mb-10 italic leading-none uppercase">
                     {tt('wizard_models_available')} {selectedProduct?.name.split(' ')[0]}
                   </h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {dbProducts.filter((p: any) => !selectedProduct || p.name.split(' ')[0] === selectedProduct.name.split(' ')[0]).map((p: any) => (
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
                                {tt('wizard_high_efficiency')}
                              </span>
                           </div>
                           <h3 className="font-black text-2xl text-slate-900 uppercase italic mb-3 leading-none">{p.name}</h3>
                           <p className="text-slate-400 text-sm italic mb-8 line-clamp-2 flex-1">{p.description || p.desc}</p>
                           <div className="flex justify-between items-end border-t border-slate-100/50 pt-6 mt-4">
                              <div className="flex flex-col">
                                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{tt('wizard_status')}</span>
                                 <span className="text-[11px] font-bold text-slate-600">{tt('wizard_install_included')}</span>
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
                   <h2 className="text-5xl font-black tracking-tighter mb-12 italic leading-none uppercase">{tt('wizard_kit_title')}</h2>
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
                   <h2 className="text-5xl font-black tracking-tighter mb-12 italic leading-none uppercase">{tt('wizard_extras_title')}</h2>
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
                   <h2 className="text-5xl font-black tracking-tighter mb-12 italic leading-none uppercase">{tt('wizard_data_title')}</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                      <div><Input label={tt('wizard_fullname')} placeholder={tt('wizard_fullname')} value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />{formErrors.name && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.name}</p>}</div>
                      <div><Input label={tt('wizard_email')} placeholder={tt('wizard_email')} type="email" value={formData.email} onChange={(e:any) => setFormData({...formData, email: e.target.value})} />{formErrors.email && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.email}</p>}</div>
                      <div><Input label={tt('wizard_phone')} placeholder={tt('wizard_phone')} value={formData.phone} onChange={(e:any) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} />{formErrors.phone && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.phone}</p>}</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Input label={tt('wizard_cp')} placeholder={tt('wizard_cp')} value={formData.cp} onChange={(e:any) => setFormData({...formData, cp: e.target.value.slice(0,5).replace(/\D/g,'')})} />{formErrors.cp && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.cp}</p>}</div>
                        <div><Input label={tt('wizard_wo')} placeholder={tt('wizard_wo')} value={formData.wo} onChange={(e:any) => setFormData({...formData, wo: e.target.value.slice(0,8).replace(/\D/g,'')})} />{formErrors.wo && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.wo}</p>}</div>
                      </div>
                      <div className="md:col-span-2"><Input label={tt('wizard_address')} placeholder={tt('wizard_address')} value={formData.address} onChange={(e:any) => setFormData({...formData, address: e.target.value})} />{formErrors.address && <p className="text-[9px] text-red-500 font-black uppercase mt-1 ml-1">{formErrors.address}</p>}</div>
                   </div>
                </div>
              )}

              {step === 5 && (
                <div className="animate-in fade-in duration-500 flex-1 text-center">
                   <h2 className="text-5xl font-black tracking-tighter mb-4 italic leading-none uppercase">{tt('wizard_sign_title')}</h2>
                   <p className="text-slate-400 mb-12 font-medium italic">{tt('wizard_sign_desc')}</p>
                   <div className="max-w-xl mx-auto border-4 border-slate-100 rounded-[3.5rem] bg-white shadow-inner mb-6 relative overflow-hidden h-80">
                      <canvas ref={canvasRef} width={600} height={320} className="w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                      {!isSigned && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-100 text-6xl font-black opacity-30 uppercase italic">{tt('wizard_sign_here')}</div>}
                   </div>
                   <button onClick={clearCanvas} className="text-red-500 font-black uppercase text-[10px] tracking-widest hover:underline mb-12">{tt('wizard_clear_sign')}</button>
                   <div className="max-w-xl mx-auto bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden text-left mb-10 group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] rounded-full group-hover:scale-110 transition-transform duration-700"></div>
                      <div className="flex justify-between items-end"><span className="text-2xl font-black italic uppercase">{tt('wizard_final_investment')}</span><span className="text-5xl font-black text-blue-600 tracking-tighter">{formatCurrency(subtotal, language)}</span></div>
                   </div>
                </div>
              )}

              <div className="flex gap-4 mt-auto pt-10 border-t border-slate-50">
                {step > 1 && <button onClick={() => setStep(step - 1)} className="px-10 py-6 border-2 border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50 transition-all">{tt('wizard_btn_back')}</button>}
                <button onClick={() => {
                    if (step === 1 && !selectedProduct) return alert(tt('alert_unit_req'));
                    if (step === 2 && !selectedKit) return alert(tt('alert_kit_req'));
                    if (step === 4 && !validateStep4()) return;
                    if (step === 5) {
                      if (!isSigned) return alert(tt('alert_sign_req'));
                      alert(tt('alert_success'));
                      setView('landing'); return;
                    }
                    setStep(step + 1);
                  }} className={`flex-1 py-7 ${step === 5 ? 'bg-blue-600' : 'bg-slate-900'} text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3`}>
                   {step === 5 ? tt('wizard_btn_finish') : tt('wizard_btn_continue')}
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
         <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic">© 2025 · {tt('footer_copy')}</div>
      </footer>
    </div>
  );
};