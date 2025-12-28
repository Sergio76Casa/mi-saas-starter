
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
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
    brand: string;
    model: string;
    description?: string; 
    features?: string;
    price: number; 
    type?: string;
    status?: string;
    image_url?: string;
    brand_logo_url?: string;
    pdf_url?: string;
    pricing?: Array<{ variant: string; price: number }>;
  }>; 
};

const LOCAL_I18N = {
  es: {
    nav_home: 'Inicio',
    nav_products: 'Productos',
    nav_contact: 'Contacto',
    nav_admin: 'Admin',
    nav_admin_btn: 'ADMIN',
    error_404_msg: 'Error: Empresa no encontrada',
    error_404_btn: 'Volver',
    hero_badge: 'TECNOLOGÍA INVERTER 2024',
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
    hero_badge: 'TECNOLOGIA INVERTER 2024',
    hero_title_1: 'Clima perfecte,',
    hero_title_2: 'Estalvi real.',
    hero_desc: 'Transforma la teva llar amb les nostres solucions de climatització d’alta eficiència. Instal·lació profesional, finançament a mida i les millors marques del mercat.',
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
    wizard_high_efficiency: 'Máxima Eficiència',
    wizard_install_included: 'Instal·lació Inclosa',
    wizard_status: 'ESTADO',
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
  const { dbHealthy, language, setLanguage, session, memberships, profile } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [dbProducts, setDbProducts] = useState<PublicCatalogResponse['products']>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const tt = (key: keyof typeof LOCAL_I18N['es']) => LOCAL_I18N[language]?.[key] ?? LOCAL_I18N.es[key];

  const [view, setView] = useState<'landing' | 'wizard'>('landing');
  const [step, setStep] = useState(1);
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState(5000);

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
      const { data, error } = await supabase.rpc('get_public_catalog', { p_slug: slug });
      if (error || !data) { setTenant(null); setDbProducts([]); } 
      else {
        const payload = data as PublicCatalogResponse;
        setTenant(payload.tenant ? (payload.tenant as any) : null);
        // CA-STATUS: Solo mostramos productos activos en la web pública
        const allProducts = Array.isArray(payload.products) ? payload.products : [];
        setDbProducts(allProducts.filter(p => p.status === 'active'));
      }
      setLoading(false);
    };
    fetchCatalog();
  }, [slug, dbHealthy]);

  useEffect(() => { if (view === 'wizard') window.scrollTo({ top: 0, behavior: 'smooth' }); }, [view, step]);

  const brandGroups = useMemo(() => {
    const groups: Record<string, { brand: string, minPrice: number, products: any[], features: string[] }> = {};
    dbProducts.forEach(p => {
      const brand = p.brand;
      const effectiveCategory = p.type || 'aire_acondicionado';
      const matchesCategory = categoryFilter === 'all' || effectiveCategory === categoryFilter;
      const matchesPrice = p.price <= maxPrice;
      const matchesBrand = !brandFilter || brand === brandFilter;

      if (matchesCategory && matchesPrice && matchesBrand) {
        if (!groups[brand]) {
          groups[brand] = { brand, minPrice: p.price, products: [], features: [tt('brand_feat_warranty'), tt('brand_feat_low_cons')] };
        }
        groups[brand].products.push(p);
        if (p.price < groups[brand].minPrice) groups[brand].minPrice = p.price;
        const feats = (p.features || '').toLowerCase();
        if (feats.includes('a++') && !groups[brand].features.includes(`${tt('brand_feat_efficiency')} A++`)) groups[brand].features.push(`${tt('brand_feat_efficiency')} A++`);
        if (feats.includes('inverter') && !groups[brand].features.includes('Inverter')) groups[brand].features.push('Inverter');
      }
    });
    return Object.values(groups);
  }, [dbProducts, brandFilter, maxPrice, categoryFilter, language]);

  const navigateToHome = () => { setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigateToCatalog = () => {
    const scrollToCatalog = () => { const el = document.getElementById('catalog'); if (el) el.scrollIntoView({ behavior: 'smooth' }); };
    if (view !== 'landing') { setView('landing'); setTimeout(scrollToCatalog, 100); } 
    else scrollToCatalog();
  };

  const handleAdminClick = () => {
    const adminUrl = `/t/${slug}/dashboard`;
    if (!session) navigate(`/login?returnTo=${encodeURIComponent(adminUrl)}`);
    else {
      const isMember = memberships.some(m => m.tenant?.slug === slug);
      if (isMember || profile?.is_superadmin) navigate(adminUrl);
      else alert("No tienes permisos para esta empresa.");
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    setContactStatus('sending');
    setTimeout(() => { setContactStatus('success'); setTimeout(() => { setIsContactModalOpen(false); setContactStatus('idle'); setContactForm({ name: '', email: '', phone: '', message: '' }); }, 2000); }, 1000);
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

  const clearCanvas = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); setIsSigned(false); } };

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
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
       <div className="animate-in fade-in zoom-in duration-500">
         <h1 className="text-7xl md:text-9xl font-black text-slate-100 mb-4 tracking-tighter uppercase italic">404</h1>
         <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{tt('error_404_msg')}</p>
         <Link to="/" className="mt-10 inline-block px-8 py-3 bg-blue-600 text-white rounded-full font-black uppercase text-[10px]">{tt('error_404_btn')}</Link>
       </div>
    </div>
  );

  const subtotal = (selectedProduct?.price || 0) + (selectedKit?.price || 0) + selectedExtras.reduce((acc, n) => acc + (PDF_EXTRAS.find(e => n === e.name)?.price || 0), 0);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-600/20 overflow-x-hidden">
      {/* HEADER: FIXED GLASSMORPHISM NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-white/80 backdrop-blur-md z-[100] border-b border-gray-100 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 md:px-10">
          <button onClick={navigateToHome} className="flex items-center gap-3 group">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 text-white shadow-lg shadow-blue-600/20 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
               <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
            </div>
            <span className="text-lg md:text-xl font-black italic tracking-tighter uppercase text-slate-900">eco-efficient</span>
          </button>
          
          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden lg:flex items-center gap-1">
              <button onClick={navigateToHome} className={`px-4 py-2 rounded-lg text-[13px] font-bold tracking-tight transition-all ${view === 'landing' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>{tt('nav_home')}</button>
              <button onClick={navigateToCatalog} className="px-4 py-2 rounded-lg text-[13px] font-bold tracking-tight text-slate-500 hover:text-slate-900 transition-all">{tt('nav_products')}</button>
              <button onClick={() => setIsContactModalOpen(true)} className="px-4 py-2 rounded-lg text-[13px] font-bold tracking-tight text-slate-500 hover:text-slate-900 transition-all">{tt('nav_contact')}</button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="h-8 w-px bg-slate-200 hidden lg:block"></div>
              
              <div className="flex items-center gap-1.5 cursor-pointer group">
                <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9-9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-[11px] font-black uppercase text-slate-600 outline-none cursor-pointer">
                   <option value="es">ES</option>
                   <option value="ca">CA</option>
                </select>
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
              </div>

              <button onClick={handleAdminClick} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all bg-slate-50 border border-slate-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* CONTACT MODAL */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-14 w-full max-w-xl shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsContactModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            {contactStatus === 'success' ? (
              <div className="text-center py-8"><div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg></div><h3 className="text-2xl font-black italic uppercase">{tt('contact_success')}</h3></div>
            ) : (
              <><h3 className="text-3xl font-black tracking-tighter uppercase italic mb-8">{tt('contact_title')}</h3>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label={tt('wizard_fullname')} value={contactForm.name} onChange={(e:any) => setContactForm({...contactForm, name: e.target.value})} required /><Input label={tt('wizard_email')} type="email" value={contactForm.email} onChange={(e:any) => setContactForm({...contactForm, email: e.target.value})} required /></div>
                  <Input label={tt('contact_phone')} value={contactForm.phone} onChange={(e:any) => setContactForm({...contactForm, phone: e.target.value})} />
                  <textarea className="w-full px-4 py-3 border border-gray-100 rounded-xl shadow-sm bg-gray-50/50 h-24 resize-none text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder={tt('contact_message')} value={contactForm.message} onChange={(e) => setContactForm({...contactForm, message: e.target.value})} required />
                  <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[12px] tracking-widest shadow-xl shadow-blue-600/30">{contactStatus === 'sending' ? tt('contact_sending') : tt('contact_btn_send')}</button>
                </form></>
            )}
          </div>
        </div>
      )}

      {view === 'landing' ? (
        <main className="animate-in fade-in duration-1000 pb-20 pt-16 md:pt-20">
          <div className="px-4 md:px-8 pt-4 md:pt-8">
            <section className="max-w-7xl mx-auto relative rounded-[2rem] md:rounded-[3.5rem] h-[400px] md:h-[550px] overflow-hidden group shadow-2xl flex items-center">
              <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover" alt="Modern Home" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-transparent w-[100%] md:w-[60%]"></div>
              <div className="relative px-8 md:px-20 max-w-4xl text-left">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600/30 border border-blue-500/50 text-white rounded-full text-[9px] md:text-[11px] font-black uppercase tracking-widest mb-6 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  {tt('hero_badge')}
                </div>
                <h1 className="text-4xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter mb-6 uppercase italic drop-shadow-lg">
                  {tt('hero_title_1')} <br/>
                  <span className="text-blue-500">{tt('hero_title_2')}</span>
                </h1>
                <p className="text-sm md:text-lg text-white/80 max-w-xl font-medium mb-10 italic leading-relaxed">
                  {tt('hero_desc')}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={navigateToCatalog} className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                    {tt('hero_cta_catalog')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  <button onClick={() => { setView('wizard'); setStep(1); }} className="w-full sm:w-auto px-8 py-4 bg-white/10 border border-white/40 hover:bg-white/20 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 flex items-center justify-center backdrop-blur-md">
                    {tt('hero_cta_wizard')}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section id="catalog" className="py-20 md:py-24 px-4 md:px-8 scroll-mt-24">
             <div className="max-w-7xl mx-auto">
               <div className="text-left mb-12">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic mb-2">{tt('catalog_title')}</h2>
                  <p className="text-slate-400 font-bold text-xs italic">{tt('catalog_subtitle')}</p>
               </div>
               
               <div className="bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 mb-12 shadow-sm flex flex-col md:flex-row items-center gap-6">
                 <div className="w-full md:w-auto overflow-x-auto"><div className="flex gap-2 whitespace-nowrap">
                   {['all', 'aire_acondicionado', 'caldera', 'termo_electrico'].map(id => (
                     <button key={id} onClick={() => setCategoryFilter(id)} className={`px-4 py-2 rounded-full text-[10px] font-bold transition-all ${categoryFilter === id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500'}`}>{id === 'all' ? tt('cat_all') : tt(`cat_${id === 'aire_acondicionado' ? 'ac' : id === 'caldera' ? 'boiler' : 'thermo'}`)}</button>
                   ))}
                 </div></div>
                 <div className="hidden md:block h-10 w-px bg-slate-100"></div>
                 <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="w-full md:w-48 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-600 outline-none"><option value="">{tt('filter_all_brands')}</option>{Array.from(new Set(dbProducts.map(p => p.brand))).map(brand => (<option key={brand} value={brand}>{brand}</option>))}</select>
                 <div className="w-full md:flex-1 max-w-xs"><div className="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-2"><span>Precio Máx.</span><span>{maxPrice} €</span></div><input type="range" min="0" max="10000" value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))} className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg" /></div>
               </div>

               {brandGroups.length === 0 ? (<div className="py-20 text-center text-slate-300 font-black uppercase italic">{tt('no_products_filter')}</div>) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                    {brandGroups.map(group => (
                      <div key={group.brand} className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col text-left">
                         <div className="h-48 md:h-64 bg-slate-50 rounded-[1.5rem] md:rounded-[2.5rem] mb-6 md:mb-8 flex items-center justify-center relative shadow-inner overflow-hidden">
                            {group.products[0]?.image_url ? (
                              <img src={group.products[0].image_url} className="w-full h-full object-contain p-4" alt={group.brand} />
                            ) : (
                              <svg className="w-16 h-16 md:w-24 md:h-24 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            )}
                            <div className="absolute top-4 right-4 px-3 py-1 bg-white text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm border border-slate-50">{group.brand}</div>
                         </div>
                         <h3 className="text-3xl font-black mb-1 uppercase italic tracking-tighter">{group.brand}</h3>
                         <div className="flex flex-wrap gap-2 mb-8">{group.features.slice(0, 3).map(feat => (<span key={feat} className="px-2 py-1 bg-slate-50 text-slate-600 rounded-full text-[8px] font-black uppercase border border-slate-100">{feat}</span>))}</div>
                         <div className="flex items-center justify-between border-t border-slate-50 pt-6 mt-auto">
                            <div><p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-none"><span className="text-[10px] text-slate-300 mr-1 uppercase italic">Desde</span>{formatCurrency(group.minPrice, language)}</p></div>
                            <button onClick={() => { setSelectedProduct(group.products[0]); setView('wizard'); setStep(1); }} className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center active:scale-95 shadow-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg></button>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
             </div>
          </section>
        </main>
      ) : (
        <div className="max-w-5xl mx-auto py-10 md:py-24 px-4 md:px-8 animate-in slide-in-from-bottom-12 duration-700 mt-16 md:mt-20">
           <div className="mb-10 md:mb-20 flex justify-start items-center bg-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-x-auto whitespace-nowrap gap-4 scrollbar-hide">
              {[1, 2, 3, 4, 5].map(num => (
                <div key={num} className="flex items-center gap-2 md:gap-4 shrink-0">
                   <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center font-black text-xs md:text-sm transition-all border-2 ${step === num ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-110' : step > num ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-white border-slate-100 text-slate-200'}`}>{step > num ? <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg> : num}</div>
                   <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:block ${step >= num ? 'text-slate-900' : 'text-slate-400'}`}>{num === 1 ? 'Producto' : num === 2 ? 'Kit' : num === 3 ? 'Extras' : num === 4 ? 'Datos' : 'Firma'}</p>
                </div>
              ))}
           </div>

           <div className="bg-white p-6 md:p-20 rounded-[2rem] md:rounded-[4.5rem] border border-slate-100 shadow-2xl relative text-left min-h-[450px] flex flex-col">
              {step === 1 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-8 italic uppercase">{tt('wizard_models_available')}</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {dbProducts.filter((p: any) => !selectedProduct || p.brand === selectedProduct.brand).map((p: any) => (
                        <button key={p.id} onClick={() => setSelectedProduct(p)} className={`p-6 md:p-10 rounded-2xl md:rounded-[3rem] border-2 text-left transition-all relative flex flex-col h-full ${selectedProduct?.id === p.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-white'}`}>
                           <h3 className="font-black text-xl md:text-2xl text-slate-900 uppercase italic mb-2 leading-none">{p.brand} {p.model}</h3>
                           <p className="text-slate-400 text-xs italic mb-6 line-clamp-2 flex-1">{p.features || p.description}</p>
                           <p className="text-2xl md:text-3xl font-black text-blue-600 tracking-tighter">{formatCurrency(p.price, language)}</p>
                        </button>
                      ))}
                   </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-8 italic uppercase">{tt('wizard_kit_title')}</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {PDF_KITS.map(kit => (
                        <button key={kit.name} onClick={() => setSelectedKit(kit)} className={`p-6 md:p-10 rounded-2xl md:rounded-[3rem] border-2 text-left transition-all ${selectedKit?.name === kit.name ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-white'}`}>
                           <h3 className="font-black text-lg md:text-2xl text-slate-900 uppercase italic mb-1">{kit.name}</h3>
                           <p className="text-2xl font-black text-blue-600">{formatCurrency(kit.price, language)}</p>
                        </button>
                      ))}
                   </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-8 italic uppercase">{tt('wizard_extras_title')}</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto max-h-[350px] pr-2">
                      {PDF_EXTRAS.map(extra => {
                        const isSel = selectedExtras.includes(extra.name);
                        return (
                          <button key={extra.name} onClick={() => setSelectedExtras(prev => isSel ? prev.filter(i => i !== extra.name) : [...prev, extra.name])} className={`flex items-center justify-between p-4 rounded-xl md:rounded-[2rem] border-2 transition-all ${isSel ? 'border-blue-600 bg-blue-50' : 'border-slate-50 bg-slate-50/50'}`}>
                             <p className="font-bold text-[10px] uppercase text-slate-900 leading-tight pr-2">{extra.name}</p>
                             <p className="text-[10px] font-black text-blue-600 shrink-0">{formatCurrency(extra.price, language)}</p>
                          </button>
                        );
                      })}
                   </div>
                </div>
              )}

              {step === 4 && (
                <div className="animate-in fade-in duration-500 flex-1">
                   <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-8 italic uppercase">{tt('wizard_data_title')}</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label={tt('wizard_fullname')} value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
                      <Input label={tt('wizard_email')} type="email" value={formData.email} onChange={(e:any) => setFormData({...formData, email: e.target.value})} />
                      <Input label={tt('wizard_phone')} value={formData.phone} onChange={(e:any) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} />
                      <div className="grid grid-cols-2 gap-4">
                        <Input label={tt('wizard_cp')} value={formData.cp} onChange={(e:any) => setFormData({...formData, cp: e.target.value.slice(0,5).replace(/\D/g,'')})} />
                        <Input label={tt('wizard_wo')} value={formData.wo} onChange={(e:any) => setFormData({...formData, wo: e.target.value.slice(0,8).replace(/\D/g,'')})} />
                      </div>
                      <div className="md:col-span-2"><Input label={tt('wizard_address')} value={formData.address} onChange={(e:any) => setFormData({...formData, address: e.target.value})} /></div>
                   </div>
                </div>
              )}

              {step === 5 && (
                <div className="animate-in fade-in duration-500 flex-1 text-center">
                   <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 italic uppercase">{tt('wizard_sign_title')}</h2>
                   <div className="w-full border-2 border-slate-100 rounded-2xl bg-white shadow-inner mb-4 relative overflow-hidden h-64 md:h-80">
                      <canvas ref={canvasRef} width={600} height={320} className="w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                   </div>
                   <button onClick={clearCanvas} className="text-red-500 font-black uppercase text-[9px] mb-8">{tt('wizard_clear_sign')}</button>
                   <div className="bg-slate-900 text-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] text-left">
                      <div className="flex justify-between items-end"><span className="text-lg md:text-2xl font-black italic uppercase">Total</span><span className="text-3xl md:text-5xl font-black text-blue-600 tracking-tighter">{formatCurrency(subtotal, language)}</span></div>
                   </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-3 mt-auto pt-8 border-t border-slate-50">
                {step > 1 && <button onClick={() => setStep(step - 1)} className="w-full md:w-auto px-10 py-5 border-2 border-slate-100 rounded-xl md:rounded-3xl font-black uppercase text-[10px] text-slate-400">{tt('wizard_btn_back')}</button>}
                <button onClick={() => {
                    if (step === 1 && !selectedProduct) return alert(tt('alert_unit_req'));
                    if (step === 2 && !selectedKit) return alert(tt('alert_kit_req'));
                    if (step === 4 && !validateStep4()) return;
                    if (step === 5) { if (!isSigned) return alert(tt('alert_sign_req')); alert(tt('alert_success')); setView('landing'); return; }
                    setStep(step + 1);
                  }} className="flex-1 py-5 bg-slate-900 text-white rounded-xl md:rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-2">
                   {step === 5 ? tt('wizard_btn_finish') : tt('wizard_btn_continue')}
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
              </div>
           </div>
        </div>
      )}

      <footer className="py-20 md:py-32 border-t border-slate-100 text-center bg-white mt-20">
         <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic">© 2025 · {tt('footer_copy')}</div>
      </footer>
    </div>
  );
};
