
import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase, isConfigured, SUPABASE_URL, saveManualConfig, clearManualConfig } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, QuoteItem, Language, PlatformContent } from './types';
import { translations, formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';
import { 
  Snowflake, Settings, PenTool, CheckCircle2, Filter, Share2, Download, Info, Shield, Zap, Sun, 
  ChevronRight, ChevronLeft, Globe, Trash2, Image as ImageIcon, Check 
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

// --- PDF Specific Data ---
const PDF_PRODUCTS = [
  { id: 'cf09', name: 'COMFEE CF 09', price: 829.00, desc: 'Eficiencia A++ en refrigeración, ideal para estancias pequeñas.' },
  { id: 'cf12', name: 'COMFEE CF 12', price: 889.00, desc: 'Clasificación A++, perfecto equilibrio entre potencia y consumo.' },
  { id: 'cf18', name: 'COMFEE CF 18', price: 1139.00, desc: 'Alta capacidad de refrigeración (4601 kcal/h) para grandes espacios.' },
  { id: 'cf2x1', name: 'COMFEE CF 2X1', price: 1489.00, desc: 'Sistema multi-split para climatizar dos estancias con una unidad exterior.' },
];

const PDF_KITS = [
  { id: 'ite3', name: 'KIT INSTALACIÓN ITE-3', price: 149.00 },
  { id: 'ite3_2x1', name: 'KIT INSTALACIÓN ITE-3 2X1', price: 249.00 },
];

const PDF_EXTRAS = [
  { id: 'm38', name: 'METRO LINIAL (3/8)', price: 90.00 },
  { id: 'm12', name: 'METRO LINIAL (1/2)', price: 100.00 },
  { id: 'm58', name: 'METRO LINIAL (5/8)', price: 110.00 },
  { id: 'm325', name: 'MANGUERA 3x2,5mm', price: 10.00 },
  { id: 'm515', name: 'MANGUERA 5x1,5mm', price: 10.00 },
  { id: 't1438', name: 'TUBERÍA 1/4 - 3/8', price: 35.00 },
  { id: 't1412', name: 'TUBERÍA 1/4 - 1/2', price: 45.00 },
  { id: 't3858', name: 'TUBERÍA 3/8 - 5/8', price: 55.00 },
  { id: 'c6060', name: 'CANAL 60x60', price: 35.00 },
  { id: 'c8060', name: 'CANAL 80x60', price: 45.00 },
  { id: 'c10060', name: 'CANAL 100x60', price: 55.00 },
  { id: 'alt', name: 'TRABAJOS EN ALTURA', price: 80.00 },
  { id: 'bomb', name: 'BOMBA DE CONDENSADOS', price: 180.00 },
  { id: 'tcris', name: 'TUBO CRISTAL PARA BOMBA', price: 5.00 },
  { id: 'cfina', name: 'CANAL FINA TOMA CORRIENTE', price: 20.00 },
  { id: 'cext', name: 'CURVA EXTERIOR CANAL', price: 20.00 },
  { id: 'cint', name: 'CURVA INTERIOR CANAL', price: 20.00 },
  { id: 'tcie', name: 'TAPA CIEGA CANAL', price: 20.00 },
  { id: 'moa', name: 'MANO DE OBRA ADICIONAL', price: 0.00 },
];

const FINANCING_COEFFICIENTS: Record<number, number> = {
  12: 0.087,
  24: 0.045104,
  36: 0.032206,
  48: 0.0253,
  60: 0.021183,
};

// --- Context & Hooks ---

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  isDemoMode: boolean;
  dbHealthy: boolean | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  enterDemoMode: (asAdmin?: boolean) => void;
  t: (key: keyof typeof translations['es']) => string;
}

const AppContext = createContext<AppContextType | null>(null);

const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

// --- Common Components ---

const LoadingSpinner = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
    <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent shadow-xl"></div>
    <p className="mt-6 text-gray-500 font-black uppercase tracking-widest text-[10px] animate-pulse italic">Conectando...</p>
  </div>
);

const ConnectionStatusBadge = () => {
  const { dbHealthy } = useApp();
  if (!isConfigured) return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-200">
      ⚠️ Error Config
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

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  return (
    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200/50">
      <button onClick={() => setLanguage('es')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'es' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>ES</button>
      <button onClick={() => setLanguage('ca')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${language === 'ca' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>CA</button>
    </div>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="mb-4 text-left">
    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">{label}</label>
    <input className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-gray-50/50" {...props} />
  </div>
);

const SuperAdminFloatingBar = () => {
  const { profile } = useApp();
  if (!profile?.is_superadmin) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <Link to="/admin/dashboard" className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-full shadow-2xl border border-white/10 hover:scale-105 transition-all group">
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Panel del Sistema Central</span>
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </Link>
    </div>
  );
};

// --- Tenant Operations Components ---

const QuoteEditor = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, session, language } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Quote>>({
    status: 'draft',
    client_name: '',
    client_dni: '',
    client_address: '',
    client_population: '',
    client_email: '',
    client_phone: '',
    maintenance_no: '',
    total_amount: 0,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [],
    financing_months: 12
  });

  const addItem = (description: string, price: number) => {
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      quote_id: id || 'new',
      description,
      quantity: 1,
      unit_price: price,
      total: price
    };
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
      if (data) setCustomers(data);
    };
    fetchCustomers();
    
    // Check for pre-selected product from URL
    const productId = searchParams.get('productId');
    if (productId && id === 'new') {
      const product = PDF_PRODUCTS.find(p => p.id === productId);
      if (product) {
        addItem(product.name, product.price);
      }
    }
  }, [tenant.id, id, searchParams]);

  const subtotal = useMemo(() => {
    return (formData.items || []).reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  }, [formData.items]);

  const monthlyFee = useMemo(() => {
    if (!formData.financing_months) return 0;
    const coeff = FINANCING_COEFFICIENTS[formData.financing_months];
    return subtotal * coeff;
  }, [subtotal, formData.financing_months]);

  const updateItemQty = (id: string, qty: number) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(item => item.id === id ? { ...item, quantity: qty, total: qty * item.unit_price } : item)
    }));
  };

  const removeItem = (id: string) => {
    setFormData(prev => ({ ...prev, items: (prev.items || []).filter(item => item.id !== id) }));
  };

  const handleCustomerSelect = (custId: string) => {
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setFormData(prev => ({
        ...prev,
        customer_id: custId,
        client_name: cust.name,
        client_email: cust.email,
        client_phone: cust.phone || '',
        client_dni: cust.dni || '',
        client_address: cust.address || '',
        client_population: cust.population || ''
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    // Dummy save for now until DB schema is updated
    console.log("Saving Quote:", { ...formData, total_amount: subtotal, financing_fee: monthlyFee });
    setTimeout(() => {
      setLoading(false);
      navigate(`/t/${tenant.slug}/quotes`);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-700 pb-24">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-4xl font-black text-gray-900 tracking-tighter">{t('new_quote')}</h3>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mt-2">Ref: {new Date().getFullYear()}-XXXX</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate(-1)} className="px-6 py-3 text-gray-400 text-[10px] font-black uppercase">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">
            {loading ? 'Guardando...' : 'Finalizar y Congelar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-10 rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Datos del Cliente
            </h4>
            
            <div className="mb-8 text-left">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Seleccionar de Base de Datos</label>
              <select 
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Nuevo Cliente --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Nombre" value={formData.client_name} onChange={(e:any) => setFormData({...formData, client_name: e.target.value})} />
              <Input label={t('dni')} value={formData.client_dni} onChange={(e:any) => setFormData({...formData, client_dni: e.target.value})} />
              <div className="md:col-span-2">
                <Input label={t('address')} value={formData.client_address} onChange={(e:any) => setFormData({...formData, client_address: e.target.value})} />
              </div>
              <Input label={t('population')} value={formData.client_population} onChange={(e:any) => setFormData({...formData, client_population: e.target.value})} />
              <Input label={t('maintenance_no')} value={formData.maintenance_no} onChange={(e:any) => setFormData({...formData, maintenance_no: e.target.value})} />
            </div>
          </section>

          <section className="bg-white p-10 rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Conceptos del Presupuesto
            </h4>
            
            <table className="w-full text-left mb-8">
              <thead className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50">
                <tr>
                  <th className="py-4">Descripción</th>
                  <th className="py-4 text-center">Cant.</th>
                  <th className="py-4 text-right">Precio</th>
                  <th className="py-4 text-right">Total</th>
                  <th className="py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(formData.items || []).map(item => (
                  <tr key={item.id} className="text-sm">
                    <td className="py-4 font-bold text-gray-700">{item.description}</td>
                    <td className="py-4">
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => updateItemQty(item.id, parseInt(e.target.value))}
                        className="w-16 mx-auto block bg-gray-50 border border-gray-100 rounded-lg py-1 px-2 text-center"
                      />
                    </td>
                    <td className="py-4 text-right text-gray-400">{formatCurrency(item.unit_price, language)}</td>
                    <td className="py-4 text-right font-black text-gray-900">{formatCurrency(item.total, language)}</td>
                    <td className="py-4 text-right">
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 px-2">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-6 text-left">
              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-3">Modelos Comfee (PDF)</span>
                <div className="flex flex-wrap gap-2">
                  {PDF_PRODUCTS.map(p => (
                    <button key={p.name} onClick={() => addItem(p.name, p.price)} className="px-4 py-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-100 rounded-xl text-[10px] font-black transition-all">{p.name} ({p.price}€)</button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-3">Kits de Instalación</span>
                <div className="flex flex-wrap gap-2">
                  {PDF_KITS.map(k => (
                    <button key={k.name} onClick={() => addItem(k.name, k.price)} className="px-4 py-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-100 rounded-xl text-[10px] font-black transition-all">{k.name} ({k.price}€)</button>
                  ))}
                </div>
              </div>

              <div>
                <button 
                  onClick={() => addItem('Concepto Manual', 0)}
                  className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all"
                >
                  + Añadir Concepto Personalizado
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <div className="bg-slate-900 text-white p-10 rounded-[2.8rem] shadow-2xl relative overflow-hidden sticky top-32 text-left">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 blur-[80px] rounded-full"></div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-8">Resumen Total (IVA incl.)</h4>
            
            <div className="space-y-4 mb-10">
              <div className="flex justify-between text-sm opacity-60">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, language)}</span>
              </div>
              <div className="flex justify-between text-4xl font-black pt-4 border-t border-white/10">
                <span>TOTAL</span>
                <span>{formatCurrency(subtotal, language)}</span>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-4">Calculadora de Financiación</label>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[12, 24, 36, 48, 60].map(m => (
                  <button 
                    key={m} 
                    onClick={() => setFormData({...formData, financing_months: m})}
                    className={`py-2 rounded-lg text-[10px] font-black border transition-all ${formData.financing_months === m ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <div className="bg-white/5 p-6 rounded-2xl text-center">
                 <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Cuota Mensual Est.</div>
                 <div className="text-2xl font-black text-blue-500">{formatCurrency(monthlyFee, language)}</div>
                 <div className="text-[8px] text-slate-600 mt-2 italic">*Coeficiente PDF: {FINANCING_COEFFICIENTS[formData.financing_months || 12]}</div>
              </div>
            </div>

            <div className="mt-8 text-[9px] text-slate-500 text-center uppercase font-black leading-relaxed">
              Válido durante 1 mes <br/>
              Hasta {formatDate(formData.valid_until || '', language)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { dbHealthy, t, session, memberships, profile, language } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'wizard'>('home');
  const [wizardStep, setWizardStep] = useState(1);
  const [brandFilter, setBrandFilter] = useState('');
  
  // Wizard State
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>({
    client_name: '', client_dni: '', client_email: '', client_phone: '',
    client_address: '', client_population: '', selected_extras: [], selected_kit_id: ''
  });
  const sigCanvas = useRef<any>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!isConfigured || !dbHealthy) { setLoading(false); return; }
      const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (data) setTenant(data);
      setLoading(false);
    };
    fetchTenant();
  }, [slug, dbHealthy]);

  const startWizard = (product: any) => {
    setSelectedProduct(product);
    setView('wizard');
    setWizardStep(1);
  };

  const totalAmount = useMemo(() => {
    if (!selectedProduct) return 0;
    let total = selectedProduct.price;
    const kit = PDF_KITS.find(k => k.id === quoteData.selected_kit_id);
    if (kit) total += kit.price;
    quoteData.selected_extras.forEach((extId: string) => {
      const extra = PDF_EXTRAS.find(e => e.id === extId);
      if (extra) total += extra.price;
    });
    return total;
  }, [selectedProduct, quoteData]);

  const handleFinish = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      /* Added missing key signature_required in i18n.ts */
      alert(t('signature_required'));
      return;
    }
    setWizardStep(5);
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-12 text-center">
       <div className="animate-in fade-in zoom-in duration-500">
         <h1 className="text-9xl font-black text-gray-100 mb-4">404</h1>
         <p className="text-gray-400 font-black uppercase tracking-widest text-xs italic">Empresa no encontrada</p>
         <Link to="/" className="mt-10 inline-block text-blue-600 font-black uppercase text-[10px] underline tracking-widest">Volver al inicio</Link>
       </div>
    </div>
  );

  const filteredProducts = PDF_PRODUCTS.filter(p => !brandFilter || p.name.includes(brandFilter));

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-10 py-8 sticky top-0 bg-white/80 backdrop-blur-xl z-50 border-b border-gray-50">
        <div className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">{tenant.name}</div>
        <div className="flex items-center gap-10">
           <button onClick={() => setView('home')} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">Inicio</button>
           <a href="#catalog" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">Catálogo</a>
           <LanguageSwitcher />
           <button onClick={() => setView('home')} className="px-8 py-3 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all">{t('contact_section')}</button>
        </div>
      </nav>

      {view === 'home' ? (
        <main className="animate-in fade-in duration-1000">
          {/* Hero */}
          <section className="py-40 text-center px-6">
            <div className="inline-block px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-10 border border-blue-100 shadow-sm">✨ Especialistas en Confort Térmico</div>
            <h1 className="text-[6rem] md:text-[8rem] font-black text-slate-900 tracking-tighter leading-[0.8] mb-12 uppercase">Eco<span className="text-blue-600">Quote</span></h1>
            <p className="text-2xl text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed italic opacity-80 mb-16">
              Diseñamos soluciones inteligentes de climatización con presupuestos profesionales en segundos.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
               <a href="#catalog" className="px-12 py-6 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-2xl shadow-blue-500/30">Explorar Catálogo</a>
               <button className="px-12 py-6 bg-slate-100 text-slate-600 rounded-[2.5rem] font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Sobre Nosotros</button>
            </div>
          </section>

          {/* How it works */}
          <section className="py-32 bg-slate-50 px-10">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-24">
                {/* Added missing key how_it_works in i18n.ts */}
                <h2 className="text-5xl font-black text-slate-900 tracking-tight uppercase italic">{t('how_it_works')}</h2>
                <div className="w-24 h-2 bg-blue-600 mx-auto mt-4 rounded-full"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                 {[
                   /* Added missing keys how_1, how_2, how_3 in i18n.ts */
                   { icon: Snowflake, t: t('how_1'), d: 'Selecciona el equipo Midea o Comfee que mejor se adapte a tu hogar.' },
                   { icon: Settings, t: t('how_2'), d: 'Configura kits de instalación y materiales adicionales a medida.' },
                   { icon: PenTool, t: t('how_3'), d: 'Firma digitalmente y recibe tu presupuesto oficial al instante.' }
                 ].map((step, i) => (
                   <div key={i} className="text-center group">
                      <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-10 group-hover:scale-110 transition-all border border-slate-100">
                         <step.icon className="w-10 h-10 text-blue-600" />
                      </div>
                      <h3 className="text-2xl font-black mb-6 text-slate-900">{step.t}</h3>
                      <p className="text-slate-400 font-medium italic leading-relaxed">{step.d}</p>
                   </div>
                 ))}
              </div>
            </div>
          </section>

          {/* Catalog */}
          <section id="catalog" className="py-40 px-10 scroll-mt-24">
             <div className="max-w-7xl mx-auto">
               <div className="flex flex-col md:flex-row justify-between items-end gap-10 mb-20">
                  <div className="text-left">
                     <h2 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic mb-4">Soluciones HVAC</h2>
                     <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">Tecnología de alta eficiencia energética</p>
                  </div>
                  <div className="flex gap-4">
                     <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                          onChange={(e) => setBrandFilter(e.target.value)}
                          className="pl-12 pr-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                        >
                          <option value="">Todas las Marcas</option>
                          <option value="COMFEE">Comfee</option>
                          <option value="MIDEA">Midea</option>
                        </select>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col text-left">
                       <div className="h-64 bg-slate-50 rounded-[2.5rem] mb-10 flex items-center justify-center relative overflow-hidden">
                          <ImageIcon className="w-16 h-16 text-slate-100 group-hover:scale-110 transition-transform" />
                          <div className="absolute top-6 right-6 px-4 py-2 bg-white rounded-full text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm">A+++</div>
                       </div>
                       <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2 block">Premium Unit</span>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{p.name}</h3>
                          </div>
                          <button className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-blue-600 transition-all"><Share2 className="w-5 h-5" /></button>
                       </div>
                       <p className="text-slate-400 text-sm italic mb-10 flex-1">{p.desc}</p>
                       <div className="flex flex-col gap-6">
                          <div className="flex justify-between items-end">
                             <div className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Precio desde</div>
                             <div className="text-3xl font-black text-slate-900">{formatCurrency(p.price, language)}</div>
                          </div>
                          <button 
                            onClick={() => startWizard(p)}
                            className="w-full py-6 bg-slate-950 text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl"
                          >
                            Solicitar Presupuesto →
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
        <div className="max-w-5xl mx-auto py-20 px-8 animate-in slide-in-from-bottom-10 duration-700">
           {/* Stepper */}
           <div className="mb-16 flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-50">
                 <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(wizardStep / 4) * 100}%` }}></div>
              </div>
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="flex items-center gap-4 relative z-10">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all border-2 ${wizardStep === num ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-110' : wizardStep > num ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                      {wizardStep > num ? <Check className="w-6 h-6" /> : num}
                   </div>
                   <div className="hidden lg:block text-left leading-none">
                      <p className={`text-[9px] font-black uppercase tracking-widest ${wizardStep >= num ? 'text-slate-900' : 'text-slate-400'}`}>
                        {num === 1 ? 'Equipo' : num === 2 ? 'Instalación' : num === 3 ? 'Tus Datos' : 'Firma'}
                      </p>
                   </div>
                </div>
              ))}
           </div>

           <div className="bg-white p-12 lg:p-20 rounded-[4rem] border border-slate-100 shadow-2xl relative">
              <div className="absolute top-10 right-10 flex gap-4">
                 <div className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-left">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Presupuesto</p>
                    <p className="text-xl font-black text-blue-600">{formatCurrency(totalAmount, language)}</p>
                 </div>
              </div>

              {wizardStep === 1 && (
                <div className="animate-in fade-in duration-500 text-left">
                   <div className="flex flex-col lg:flex-row gap-16">
                      <div className="flex-1">
                         <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-6">{selectedProduct.name}</h2>
                         <p className="text-xl text-slate-400 font-medium italic leading-relaxed mb-10">{selectedProduct.desc}</p>
                         <div className="grid grid-cols-2 gap-4 mb-12">
                            {[
                              { label: 'Garantía', val: '2 Años Total', icon: Shield },
                              { label: 'Eficiencia', val: 'A+++ R32', icon: Zap },
                              { label: 'Control', val: 'WiFi Incluido', icon: Globe },
                              { label: 'Sonido', val: '21 dB Silencioso', icon: Snowflake },
                            ].map((s, i) => (
                              <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                                 <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600"><s.icon className="w-5 h-5" /></div>
                                 <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">{s.label}</p>
                                    <p className="text-sm font-bold text-slate-900">{s.val}</p>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                      <div className="w-full lg:w-80">
                         <div className="bg-slate-50 rounded-[3rem] p-10 border border-slate-100 aspect-square flex items-center justify-center">
                            <Snowflake className="w-32 h-32 text-blue-100" />
                         </div>
                      </div>
                   </div>
                   <button onClick={() => setWizardStep(2)} className="w-full py-8 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-[1.02] transition-all">Siguiente: Configurar Instalación →</button>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="animate-in fade-in duration-500 text-left">
                   <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-12">Detalles de Instalación</h2>
                   <div className="space-y-16">
                      <section>
                         <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-6">Kit de Instalación</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {PDF_KITS.map(kit => (
                              <button 
                                key={kit.id} 
                                onClick={() => setQuoteData({...quoteData, selected_kit_id: kit.id})}
                                className={`p-8 rounded-[2.5rem] border-2 text-left transition-all ${quoteData.selected_kit_id === kit.id ? 'border-blue-600 bg-blue-50 shadow-xl' : 'border-slate-100 hover:border-blue-200 bg-white'}`}
                              >
                                 <p className="font-black text-xl text-slate-950 mb-1">{kit.name}</p>
                                 <p className="text-xl font-black text-blue-600">{formatCurrency(kit.price, language)}</p>
                              </button>
                            ))}
                         </div>
                      </section>
                      <section>
                         <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-6">Materiales Extras</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {PDF_EXTRAS.slice(0, 9).map(extra => {
                              const isSelected = quoteData.selected_extras.includes(extra.id);
                              return (
                                <button 
                                  key={extra.id} 
                                  onClick={() => {
                                    const newExtras = isSelected ? quoteData.selected_extras.filter((id: string) => id !== extra.id) : [...quoteData.selected_extras, extra.id];
                                    setQuoteData({...quoteData, selected_extras: newExtras});
                                  }}
                                  className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-50 hover:border-blue-100 bg-slate-50'}`}
                                >
                                   <div className="text-left"><p className="font-bold text-[11px] uppercase text-slate-900">{extra.name}</p></div>
                                   <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
                                      {isSelected && <Check className="w-4 h-4" />}
                                   </div>
                                </button>
                              );
                            })}
                         </div>
                      </section>
                   </div>
                   <div className="flex gap-4 mt-20">
                      <button onClick={() => setWizardStep(1)} className="px-10 py-6 border border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50">Atrás</button>
                      <button onClick={() => setWizardStep(3)} className="flex-1 py-8 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl">Continuar →</button>
                   </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="animate-in fade-in duration-500 text-left">
                   <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-12">Datos de Contacto</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                      <Input label="Nombre Completo" value={quoteData.client_name} onChange={(e:any) => setQuoteData({...quoteData, client_name: e.target.value})} />
                      <Input label="DNI / NIF" value={quoteData.client_dni} onChange={(e:any) => setQuoteData({...quoteData, client_dni: e.target.value})} />
                      <Input label="Email" type="email" value={quoteData.client_email} onChange={(e:any) => setQuoteData({...quoteData, client_email: e.target.value})} />
                      <Input label="Teléfono" value={quoteData.client_phone} onChange={(e:any) => setQuoteData({...quoteData, client_phone: e.target.value})} />
                      <div className="md:col-span-2"><Input label="Dirección de Instalación" value={quoteData.client_address} onChange={(e:any) => setQuoteData({...quoteData, client_address: e.target.value})} /></div>
                   </div>
                   <div className="flex gap-4">
                      <button onClick={() => setWizardStep(2)} className="px-10 py-6 border border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50">Atrás</button>
                      <button onClick={() => setWizardStep(4)} className="flex-1 py-8 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl">Revisar y Firmar →</button>
                   </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="animate-in fade-in duration-500 text-center">
                   <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">Revisión y Firma</h2>
                   <p className="text-slate-400 mb-12 font-medium italic">Firme en el recuadro inferior para validar su presupuesto oficial.</p>
                   
                   <div className="max-w-xl mx-auto mb-16 bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 text-left">
                      <div className="flex justify-between items-center mb-6">
                         <span className="text-slate-900 font-black text-2xl">{selectedProduct.name}</span>
                         <span className="text-blue-600 font-black text-xl">{formatCurrency(selectedProduct.price, language)}</span>
                      </div>
                      <div className="h-[1px] bg-slate-200 mb-6"></div>
                      <div className="flex justify-between items-end">
                         <span className="text-3xl font-black text-slate-900">TOTAL</span>
                         <span className="text-5xl font-black text-blue-600">{formatCurrency(totalAmount, language)}</span>
                      </div>
                   </div>

                   <div className="max-w-xl mx-auto border-4 border-slate-100 rounded-[3rem] bg-white shadow-inner mb-6 overflow-hidden">
                      {/* @ts-ignore - penColor is a valid prop for SignatureCanvas but might be missing from some versions of the type definitions */}
                      <SignatureCanvas 
                        ref={sigCanvas} 
                        penColor='#0f172a' 
                        canvasProps={{ className: 'w-full h-72 cursor-crosshair' }} 
                      />
                   </div>
                   <button onClick={() => sigCanvas.current?.clear()} className="px-8 py-3 text-slate-400 font-black uppercase text-[9px] tracking-widest mb-16 hover:text-red-500 transition-colors flex items-center gap-2 mx-auto"><Trash2 className="w-3 h-3" /> Limpiar Firma</button>

                   <div className="flex gap-4">
                      <button onClick={() => setWizardStep(3)} className="px-10 py-6 border border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50">Atrás</button>
                      <button onClick={handleFinish} className="flex-1 py-8 bg-slate-950 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-blue-600 transition-all">Generar Presupuesto</button>
                   </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="animate-in zoom-in duration-700 text-center py-20">
                   <div className="w-32 h-32 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-12 border-4 border-white shadow-2xl">
                      <CheckCircle2 className="w-16 h-16" />
                   </div>
                   <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-8 italic">¡Todo listo!</h2>
                   <p className="text-2xl text-slate-400 mb-16 max-w-lg mx-auto italic font-medium leading-relaxed">Su presupuesto ha sido generado con éxito y se ha enviado una copia a su email.</p>
                   <div className="flex flex-wrap justify-center gap-6">
                      <button className="px-12 py-6 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-4 hover:scale-105 transition-all">
                         <Download className="w-5 h-5" /> Descargar PDF
                      </button>
                      <button onClick={() => setView('home')} className="px-12 py-6 bg-slate-100 text-slate-600 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Volver al Inicio</button>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-24 border-t border-gray-50 text-center bg-gray-50/30 mt-40">
         <div className="text-2xl font-black text-gray-200 mb-6 tracking-tighter italic uppercase">{tenant.name}</div>
         <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">© 2025 · Powered by EcoQuote · Climatización Profesional</div>
      </footer>
    </div>
  );
};

const Customers = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, session } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', dni: '', address: '', population: '' });

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    if (data) setCustomers(data);
  };

  useEffect(() => { fetchCustomers(); }, [tenant.id]);

  const handleCreate = async () => {
    const ref = sessionStorage.getItem(`atribucion_${tenant.slug}`);
    const { error } = await supabase.from('customers').insert([{ ...newCust, tenant_id: tenant.id, created_by: session?.user.id, referred_by: ref || null }]);
    if (error) alert(error.message);
    else { setIsCreating(false); setNewCust({ name: '', email: '', phone: '', dni: '', address: '', population: '' }); fetchCustomers(); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center text-left">
        <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{t('customers')}</h3>
        <button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all">+ Nuevo Cliente</button>
      </div>

      {isCreating && (
        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Input label="Nombre" value={newCust.name} onChange={(e:any) => setNewCust({...newCust, name: e.target.value})} />
             <Input label="Email" value={newCust.email} onChange={(e:any) => setNewCust({...newCust, email: e.target.value})} />
             <Input label="Teléfono" value={newCust.phone} onChange={(e:any) => setNewCust({...newCust, phone: e.target.value})} />
             <Input label={t('dni')} value={newCust.dni} onChange={(e:any) => setNewCust({...newCust, dni: e.target.value})} />
             <Input label={t('address')} value={newCust.address} onChange={(e:any) => setNewCust({...newCust, address: e.target.value})} />
             <Input label={t('population')} value={newCust.population} onChange={(e:any) => setNewCust({...newCust, population: e.target.value})} />
           </div>
           <div className="flex gap-4">
             <button onClick={handleCreate} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl">Guardar</button>
             <button onClick={() => setIsCreating(false)} className="px-8 py-3 text-gray-400 text-[10px] font-black uppercase">Cancelar</button>
           </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-[2.8rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Cliente</th><th className="px-10 py-6">Contacto</th><th className="px-10 py-6 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-10 py-6">
                  <div className="font-black text-gray-900">{c.name}</div>
                  <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{c.dni || 'Sin DNI'}</div>
                </td>
                <td className="px-10 py-6 text-sm text-gray-500">{c.email} <br/> <span className="text-[10px] font-bold text-gray-400">{c.phone}</span></td>
                <td className="px-10 py-6 text-right"><button className="text-blue-600 font-black text-[9px] uppercase tracking-widest">Ver Ficha</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Quotes = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const fetchQuotes = async () => {
    const { data } = await supabase.from('quotes').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    if (data) setQuotes(data as any);
  };

  useEffect(() => { fetchQuotes(); }, [tenant.id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center text-left">
        <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{t('quotes')}</h3>
        <button onClick={() => navigate(`/t/${tenant.slug}/quotes/new`)} className="px-6 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Crear Presupuesto</button>
      </div>

      <div className="bg-white border border-gray-100 rounded-[2.8rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Ref/Fecha</th><th className="px-10 py-6">Cliente</th><th className="px-10 py-6">Importe</th><th className="px-10 py-6 text-right">Estado</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quotes.map(q => (
              <tr key={q.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/t/${tenant.slug}/quotes/${q.id}`)}>
                <td className="px-10 py-6 text-left"><div className="font-black text-gray-900">{q.quote_no || `#Q-${q.id.slice(0,4)}`}</div><div className="text-[9px] text-gray-400 font-bold">{formatDate(q.created_at, language)}</div></td>
                <td className="px-10 py-6 text-left font-bold text-gray-600">{q.client_name || q.customer?.name || 'Cliente Genérico'}</td>
                <td className="px-10 py-6 text-left font-black text-blue-600">{formatCurrency(q.total_amount, language)}</td>
                <td className="px-10 py-6 text-right"><span className="px-3 py-1 bg-amber-50 text-amber-600 text-[9px] font-black uppercase rounded-full border border-amber-100">{q.status}</span></td>
              </tr>
            ))}
            {quotes.length === 0 && <tr><td colSpan={4} className="px-10 py-20 text-center text-gray-300 font-black uppercase text-xs italic">No hay presupuestos emitidos todavía.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TenantSettings = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  const [name, setName] = useState(tenant.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({ name }).eq('id', tenant.id);
    if (!error) alert("Ajustes guardados");
    setSaving(false);
  };

  return (
    <div className="max-w-2xl animate-in fade-in duration-500 text-left">
      <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-10">{t('settings')}</h3>
      <div className="bg-white p-10 rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
         <Input label="Nombre de la Empresa" value={name} onChange={(e:any) => setName(e.target.value)} />
         <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 tracking-widest text-left">Plan de Suscripción</label>
            <div className="flex justify-between items-center">
               <span className="font-black text-blue-600 uppercase italic">{tenant.plan}</span>
               <button className="text-[9px] font-black text-slate-400 uppercase underline">Cambiar Plan</button>
            </div>
         </div>
         <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl">
            {saving ? 'Guardando...' : 'Actualizar Perfil'}
         </button>
      </div>
    </div>
  );
};

// --- SuperAdmin Components ---

const AdminLayout = () => {
  const { profile, signOut, t, loading } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && (!profile || !profile.is_superadmin)) navigate('/');
  }, [profile, loading, navigate]);

  if (loading || !profile?.is_superadmin) return <LoadingSpinner />;
  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex min-h-screen bg-[#050505] text-slate-100 font-sans">
      <aside className="w-72 bg-slate-900/40 backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0">
        <div className="p-8 h-24 flex items-center text-left"><div className="font-black text-2xl tracking-tighter text-white flex items-center gap-2"><div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-xs text-white">S</div>SYSTEM<span className="text-blue-500">ADMIN</span></div></div>
        <nav className="flex-1 p-6 space-y-2">
          <Link to="/admin/dashboard" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive('dashboard') ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>📊 Dashboard</Link>
          <Link to="/admin/cms" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive('cms') ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>📝 Platform CMS</Link>
          <Link to="/admin/tenants" className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive('tenants') ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>🏢 Tenants/Empresas</Link>
        </nav>
        <div className="p-6 border-t border-white/5"><button onClick={signOut} className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-400/10 rounded-2xl transition-all">🚪 {t('logout')}</button></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden text-left">
        <header className="h-24 bg-white/[0.02] border-b border-white/5 flex items-center justify-between px-10 shrink-0">
          <div className="flex flex-col"><h2 className="text-xl font-black text-white tracking-tight">Consola de Control</h2></div>
          <div className="flex items-center gap-6"><Link to="/" className="text-[10px] font-black text-slate-400 hover:text-blue-500 uppercase tracking-widest transition-colors">Web Pública ↗</Link><div className="h-12 w-12 bg-gradient-to-tr from-blue-600 to-blue-400 text-white rounded-2xl flex items-center justify-center font-black shadow-xl text-sm">SA</div></div>
        </header>
        <div className="flex-1 overflow-auto p-12 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.05),_transparent)]"><Outlet /></div>
      </main>
    </div>
  );
};

const AdminDashboard = () => (
  <div className="space-y-12 animate-in fade-in duration-700 text-left">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {[ { label: 'Total Tenants', val: '24', icon: '🏢' }, { label: 'Usuarios Activos', val: '1,2k', icon: '👥' }, { label: 'Ingresos MRR', val: '8.450€', icon: '💰' }, { label: 'Uptime', val: '99.9%', icon: '⚡' } ].map((s, i) => (
        <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-white/10 transition-all">
          <div className="absolute -right-6 -bottom-6 text-8xl opacity-5 group-hover:scale-110 transition-all">{s.icon}</div>
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">{s.label}</div>
          <div className="text-4xl font-black text-white tracking-tighter">{s.val}</div>
        </div>
      ))}
    </div>
  </div>
);

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'free' });
  const { dbHealthy } = useApp();

  const fetchTenants = async () => {
    if (!dbHealthy) return;
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) setTenants(data as any);
  };

  useEffect(() => { fetchTenants(); }, [dbHealthy]);

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug) return alert("Rellena nombre y slug");
    const { error } = await supabase.from('tenants').insert([newTenant]);
    if (!error) { setIsCreating(false); setNewTenant({ name: '', slug: '', plan: 'free' }); fetchTenants(); }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center"><h3 className="text-2xl font-black text-white tracking-tight">Directorio de Empresas</h3><button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Registrar Empresa</button></div>
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
              <h4 className="text-xl font-black text-white mb-6">Nuevo Registro</h4>
              <div className="space-y-4">
                 <input placeholder="Nombre de Empresa" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} />
                 <input placeholder="url-personalizada" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} />
              </div>
              <div className="flex gap-4 mt-10"><button onClick={handleCreateTenant} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase">Crear Empresa</button><button onClick={() => setIsCreating(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase">Cerrar</button></div>
           </div>
        </div>
      )}
      <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest"><tr><th className="px-10 py-6 text-left">Empresa</th><th className="px-10 py-6 text-left">Licencia</th><th className="px-10 py-6 text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-white/5 text-left">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-10 py-6"><div className="font-black text-white">{t.name}</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">/{t.slug}</div></td>
                <td className="px-10 py-6"><span className="px-4 py-1.5 text-[9px] font-black uppercase rounded-full bg-slate-800 text-slate-400 border border-white/5">{t.plan}</span></td>
                <td className="px-10 py-6 text-right flex gap-3 justify-end"><Link to={`/t/${t.slug}/dashboard`} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl border border-white/5">Panel →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminCMS = () => {
  const [content, setContent] = useState<PlatformContent[]>([]);
  const [editing, setEditing] = useState<PlatformContent | null>(null);
  const { dbHealthy } = useApp();

  const fetchCMS = async () => {
    if (!dbHealthy) return;
    const { data } = await supabase.from('platform_content').select('*');
    if (data) setContent(data);
  };

  useEffect(() => { fetchCMS(); }, [dbHealthy]);

  const handleSave = async () => {
    if (!editing) return;
    const { error } = await supabase.from('platform_content').upsert([editing]);
    if (!error) { fetchCMS(); setEditing(null); }
  };

  return (
    <div className="space-y-6 text-left">
      <h3 className="text-2xl font-black text-white tracking-tight">Editor Global (CMS)</h3>
      {editing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-12 rounded-[3rem] w-full max-w-xl shadow-2xl">
              <h4 className="text-xl font-black text-white mb-8">Editar Nodo: <span className="text-blue-500 text-xs font-mono">{editing.key}</span></h4>
              <div className="space-y-6"><textarea value={editing.es} onChange={e => setEditing({...editing, es: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none" /><textarea value={editing.ca} onChange={e => setEditing({...editing, ca: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none" /></div>
              <div className="flex gap-4 mt-10"><button onClick={handleSave} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">Publicar</button><button onClick={() => setEditing(null)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase">Cerrar</button></div>
           </div>
        </div>
      )}
      <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden text-left">
        <table className="w-full text-left"><thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest"><tr><th className="px-10 py-6 text-left">Clave</th><th className="px-10 py-6 text-right">Acción</th></tr></thead><tbody className="divide-y divide-white/5">{content.map(item => (
          <tr key={item.key} className="hover:bg-white/[0.02] transition-colors"><td className="px-10 py-6 font-mono text-[10px] text-blue-400 font-black tracking-widest text-left">{item.key}</td><td className="px-10 py-6 text-right"><button onClick={() => setEditing(item)} className="px-5 py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase">Editar</button></td></tr>
        ))}</tbody></table>
      </div>
    </div>
  );
};

// --- Authentication ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { refreshProfile, enterDemoMode } = useApp();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { await refreshProfile(); navigate('/'); } else alert("Error de acceso.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
          <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none">Acceso</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
            <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
            <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl">ENTRAR</button>
          </form>
          <button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} className="w-full py-4 mt-8 bg-white text-gray-700 border border-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Workspace de Prueba</button>
        </div>
      </div>
    </div>
  );
};

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (!error) navigate('/login'); else alert(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100 text-center">
        <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter">Registro</h2>
        <form onSubmit={handleSignup} className="space-y-6">
          <Input label="Nombre" type="text" value={fullName} onChange={(e: any) => setFullName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">REGISTRARME</button>
        </form>
      </div>
    </div>
  );
};

const Landing = () => {
  const { t, session, memberships } = useApp();
  const dashboardLink = memberships.length > 0 ? `/t/${memberships[0].tenant?.slug}/dashboard` : '/onboarding';
  return (
    <div className="min-h-screen bg-white font-sans text-center">
      <header className="flex items-center justify-between px-10 py-6 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="text-2xl font-black text-blue-600 italic">ACME</div>
        <div className="flex items-center gap-8"><LanguageSwitcher />{session ? <Link to={dashboardLink} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full">Panel Admin</Link> : <Link to="/login" className="px-8 py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-full">Empezar</Link>}</div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-40">
        <h1 className="text-8xl font-black text-gray-900 mb-10 tracking-tighter leading-[0.9]">Controla tu negocio con precisión.</h1>
        <p className="text-xl text-gray-500 mb-16 max-w-2xl mx-auto font-medium">La plataforma definitiva para instaladores bilingües.</p>
        <Link to={session ? dashboardLink : "/signup"} className="px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] text-sm font-black uppercase tracking-widest shadow-2xl">EMPEZAR GRATIS</Link>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile, session, dbHealthy } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [impersonatedTenant, setImpersonatedTenant] = useState<Tenant | null>(null);

  const currentMembership = memberships.find(m => m.tenant?.slug === slug);
  const currentTenant = currentMembership?.tenant || impersonatedTenant;

  useEffect(() => {
    const fetchImpersonated = async () => {
      if (profile?.is_superadmin && !currentMembership && slug && dbHealthy) {
        const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
        if (data) setImpersonatedTenant(data);
      }
    };
    fetchImpersonated();
  }, [slug, profile, currentMembership, dbHealthy]);

  useEffect(() => {
    if (!loading && !session) navigate('/login');
  }, [loading, session, navigate]);

  if (loading || !currentTenant) return <LoadingSpinner />;
  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] font-sans">
      <aside className="w-80 bg-white border-r border-gray-100 flex flex-col shrink-0 z-30">
        <div className="p-8 h-24 flex items-center justify-between font-black text-xl text-blue-600 uppercase italic truncate text-left">{currentTenant.name}</div>
        <nav className="flex-1 p-6 space-y-2">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('dashboard') ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📊 {t('dashboard')}</Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('customers') ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>👥 {t('customers')}</Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('quotes') ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>📄 {t('quotes')}</Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('settings') ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>⚙️ {t('settings')}</Link>
        </nav>
        <div className="p-8 border-t border-gray-50"><button onClick={signOut} className="w-full flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-2xl transition-all">🚪 {t('logout')}</button></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden text-left">
        <header className="h-24 bg-white border-b border-gray-100 flex items-center justify-between px-12 shrink-0">
          <div className="flex flex-col"><h2 className="text-2xl font-black text-gray-900 tracking-tight">{currentTenant.name}</h2></div>
          <div className="flex gap-4"><a href={`#/c/${slug}`} target="_blank" rel="noreferrer" className="px-4 py-2 bg-gray-50 text-gray-400 text-[9px] font-black uppercase rounded-full border border-gray-100 hover:text-gray-900 transition-all">Ver Web Pública ↗</a>{profile?.is_superadmin && <Link to="/admin/dashboard" className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-full shadow-lg">SYSTEM ADMIN</Link>}</div>
        </header>
        <div className="flex-1 overflow-auto p-12 bg-slate-50/50"><Outlet context={{ tenant: currentTenant }} /></div>
      </main>
      <SuperAdminFloatingBar />
    </div>
  );
};

const Dashboard = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[ { l: t('total_revenue'), v: '0.00 €', i: '💰' }, { l: t('active_quotes'), v: '0', i: '⏳' }, { l: t('total_customers'), v: '0', i: '👥' } ].map((s, i) => (
            <div key={i} className="bg-white p-10 rounded-[2.8rem] shadow-sm border border-gray-100 hover:shadow-2xl transition-all group text-left">
              <div className="w-14 h-14 bg-gray-50 text-gray-900 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">{s.i}</div>
              <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{s.l}</h3>
              <p className="text-4xl font-black mt-2 text-gray-900 tracking-tighter">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-50 h-80 flex items-center justify-center text-gray-300 font-black uppercase tracking-widest text-xs italic">Hub de {tenant.name}</div>
    </div>
  );
};

const Onboarding = () => {
    const { session, refreshProfile, signOut } = useApp();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { data: tenant, error } = await supabase.from('tenants').insert([{ name, slug }]).select().single();
        if (!error && tenant) {
            await supabase.from('memberships').insert([{ user_id: session?.user.id, tenant_id: tenant.id, role: 'owner' }]);
            await refreshProfile();
            navigate(`/t/${slug}/dashboard`);
        } else alert("Error: " + error?.message);
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 text-center font-sans">
            <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100">
                <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none">Tu Nuevo Equipo</h2>
                <form onSubmit={handleCreate} className="space-y-6">
                    <Input label="Nombre de la Empresa" value={name} onChange={(e:any) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')); }} required />
                    <Input label="Slug / URL personalizada" value={slug} onChange={(e: any) => setSlug(e.target.value)} required />
                    <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">{loading ? 'CREANDO...' : 'EMPEZAR'}</button>
                </form>
            </div>
        </div>
    );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'es');

  const setLanguage = (lang: Language) => { setLanguageState(lang); localStorage.setItem('app_lang', lang); }
  const t_func = (key: keyof typeof translations['es']) => (translations[language] as any)[key] || key;

  useEffect(() => {
    if (!isConfigured) { setDbHealthy(false); return; }
    supabase.from('profiles').select('count', { count: 'exact', head: true }).then(({ error }) => setDbHealthy(!error));
  }, []);

  const fetchProfileData = async (userId: string) => {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileData) setProfile(profileData);
    const { data: membershipData } = await supabase.from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId);
    if (membershipData) setMemberships(membershipData as any);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchProfileData(session.user.id).finally(() => setLoading(false));
        else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) fetchProfileData(session.user.id);
        else { setProfile(null); setMemberships([]); }
    });
    return () => subscription.unsubscribe();
  }, [dbHealthy]);

  const refreshProfile = async () => { if (session) await fetchProfileData(session.user.id); };
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); setMemberships([]); };
  
  const enterDemoMode = (asAdmin = false) => { 
    if (asAdmin) {
      setSession({ user: { id: 'admin', email: 'admin@system.com' } } as any);
      setProfile({ id: 'admin', email: 'admin@system.com', is_superadmin: true, full_name: 'Super Administrator' });
      setMemberships([]);
    } else {
      setSession({ user: { id: 'demo', email: 'demo@demo.com' } } as any);
      setProfile({ id: 'demo', email: 'demo@demo.com', is_superadmin: false, full_name: 'Usuario Demo' });
      setMemberships([{ id: 'm1', user_id: 'demo', tenant_id: 't1', role: 'owner', tenant: { id: 't1', name: 'Demo Corp', slug: 'demo', plan: 'pro', created_at: '' } }]);
    }
    setLoading(false); 
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AppContext.Provider value={{ session, profile, memberships, loading, isDemoMode: !!(session?.user?.id === 'demo' || session?.user?.id === 'admin'), dbHealthy, language, setLanguage, t: t_func, refreshProfile, signOut, enterDemoMode }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/c/:slug" element={<PublicTenantWebsite />} />
          <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteEditor />} />
            <Route path="settings" element={<TenantSettings />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="cms" element={<AdminCMS />} />
            <Route path="tenants" element={<AdminTenants />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}
