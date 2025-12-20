
import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase, isConfigured } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, QuoteItem, Language, Product, LocalizedText, TechnicalSpecs } from './types';
// Removed non-existent 'translations' export which caused error on line 5
import { formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';
import { 
  ChevronRight, ChevronLeft, CheckCircle2, FileText, Settings, Users, LayoutDashboard, LogOut, 
  Menu, X, Sun, Snowflake, Shield, Zap, Globe, Plus, Trash2, Edit3, Save, Download, Mail, 
  PenTool, Image as ImageIcon, Search, ArrowRight, Package
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import emailjs from '@emailjs/browser';
import SignatureCanvas from 'react-signature-canvas';
import { useTranslation } from 'react-i18next';
import { GoogleGenAI, Type } from "@google/genai";

// --- Context & Hooks ---

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

// --- Helper Components ---

const LoadingSpinner = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50">
    <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-500 border-t-transparent shadow-xl"></div>
    <p className="mt-6 text-slate-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Cargando EcoQuote...</p>
  </div>
);

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  const languages: Language[] = ['es', 'ca', 'en', 'fr'];
  return (
    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
      {languages.map(lang => (
        <button 
          key={lang}
          onClick={() => setLanguage(lang)} 
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${language === lang ? 'bg-white text-brand-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
};

// --- Public Client Website (The Single Source of Truth for the Tenant Page) ---

const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  // Fixed error on line 71: removed 't: t_legacy' as it's not in AppContextType and 't' is provided by useTranslation hook
  const { language } = useApp();
  const { t, i18n } = useTranslation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'home' | 'quote'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Quote State
  const [quoteStep, setQuoteStep] = useState(1);
  const [quoteData, setQuoteData] = useState<Partial<Quote>>({
    client_name: '', client_email: '', client_phone: '', client_dni: '', 
    client_address: '', client_population: '', 
    selected_extras: [], selected_kit_id: '',
  });
  const sigCanvas = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: tenantData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (tenantData) {
        setTenant(tenantData);
        const { data: prodData } = await supabase.from('products').select('*').eq('tenant_id', tenantData.id).eq('is_active', true);
        if (prodData) setProducts(prodData);
      }
      setLoading(false);
    };
    fetchData();
  }, [slug]);

  const l = (obj: LocalizedText | any) => obj?.[language] || obj?.es || '';

  const startQuote = (product: Product) => {
    setSelectedProduct(product);
    setStep('quote');
    setQuoteStep(1);
  };

  const handleFinishQuote = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert(t('signature_required'));
      return;
    }
    const signature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    // Save to Supabase logic...
    setQuoteStep(5); // Success step
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return <div className="p-20 text-center font-black uppercase">404 - Empresa no encontrada</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="flex items-center justify-between px-8 py-6 sticky top-0 bg-white/80 backdrop-blur-2xl z-50 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-black tracking-tighter text-brand-600 italic uppercase">
            {tenant.branding?.logo_url ? <img src={tenant.branding.logo_url} className="h-10 w-auto" alt={tenant.name} /> : tenant.name}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {step === 'home' && (
            <>
              <a href="#catalog" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 transition-colors">Equipos</a>
              <a href="#services" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 transition-colors">Servicios</a>
            </>
          )}
          <LanguageSwitcher />
          <button onClick={() => setStep('home')} className="px-6 py-3 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-slate-200">
            {t('contact_section')}
          </button>
        </div>
      </nav>

      {step === 'home' ? (
        <main className="animate-in fade-in duration-1000">
          <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-slate-900 px-8">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-600/20 to-transparent"></div>
            <div className="relative text-center max-w-5xl">
              <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-8">
                ✨ Especialistas en Climatización de Alta Eficiencia
              </span>
              <h1 className="text-6xl md:text-9xl font-black text-white tracking-tighter leading-[0.8] mb-12 uppercase">
                Eco<span className="text-brand-500">Quote</span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto italic">
                El futuro de la climatización inteligente, ahora con presupuestos en tiempo real.
              </p>
              <div className="mt-16 flex flex-wrap justify-center gap-6">
                <a href="#catalog" className="px-12 py-6 bg-brand-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-2xl shadow-brand-500/20">Ver Catálogo</a>
                <button className="px-12 py-6 bg-white/5 text-white border border-white/10 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all backdrop-blur-xl">Sobre Nosotros</button>
              </div>
            </div>
          </section>

          <section id="catalog" className="py-32 px-8 max-w-7xl mx-auto">
            <div className="mb-20 text-center">
              <h2 className="text-5xl font-black tracking-tight text-slate-900 mb-4 uppercase italic">Soluciones Premium</h2>
              <div className="w-24 h-2 bg-brand-600 mx-auto rounded-full"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {products.map(p => (
                <div key={p.id} className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col">
                  <div className="h-48 w-full bg-slate-50 rounded-[2.5rem] mb-10 flex items-center justify-center overflow-hidden">
                    {p.image_url ? <img src={p.image_url} alt={p.model} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" /> : <Snowflake className="w-16 h-16 text-brand-200" />}
                  </div>
                  <div className="mb-8">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-600 mb-2 block">{p.brand}</span>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{p.model}</h3>
                  </div>
                  <div className="space-y-3 mb-12 flex-1">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Capacidad Frío</span>
                      <span className="text-slate-900">{p.technical_specs.coolingCapacityKw} kW</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Eficiencia</span>
                      <span className="text-brand-600 font-black">A+++</span>
                    </div>
                  </div>
                  <button onClick={() => startQuote(p)} className="w-full py-5 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] group-hover:bg-brand-600 transition-all">
                    Solicitar Presupuesto →
                  </button>
                </div>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <div className="max-w-4xl mx-auto py-20 px-8 animate-in slide-in-from-bottom-10 duration-700">
          {/* Multi-step Quote UI */}
          <div className="mb-12 flex justify-between items-center bg-white p-6 rounded-4xl border border-slate-100 shadow-sm">
            {[1, 2, 3, 4].map(num => (
              <div key={num} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all ${quoteStep === num ? 'bg-brand-600 text-white shadow-lg' : quoteStep > num ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
                  {quoteStep > num ? <CheckCircle2 className="w-5 h-5" /> : num}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-[9px] font-black uppercase tracking-widest ${quoteStep === num ? 'text-slate-900' : 'text-slate-400'}`}>
                    {num === 1 ? t('step_product') : num === 2 ? t('step_config') : num === 3 ? t('step_client') : t('step_sign')}
                  </p>
                </div>
                {num < 4 && <div className="w-8 h-[2px] bg-slate-100 mx-2"></div>}
              </div>
            ))}
          </div>

          <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 blur-[100px] rounded-full"></div>
            
            {quoteStep === 1 && (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-4xl font-black tracking-tighter mb-4">{t('technical_details')}</h2>
                <p className="text-slate-400 mb-10 font-medium italic">{l(selectedProduct?.description)}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                  {[
                    { label: t('brand'), val: selectedProduct?.brand, icon: Shield },
                    { label: t('cooling'), val: `${selectedProduct?.technical_specs.coolingCapacityKw}kW`, icon: Snowflake },
                    { label: t('heating'), val: `${selectedProduct?.technical_specs.heatingCapacityKw}kW`, icon: Sun },
                    { label: t('warranty'), val: selectedProduct?.technical_specs.warranty, icon: Zap },
                  ].map((spec, i) => (
                    <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <spec.icon className="w-6 h-6 text-brand-500 mb-4" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{spec.label}</p>
                      <p className="text-sm font-black text-slate-900">{spec.val}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setQuoteStep(2)} className="w-full py-6 bg-brand-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-brand-500/20 hover:scale-[1.02] transition-all">Configurar Instalación →</button>
              </div>
            )}

            {quoteStep === 2 && (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-4xl font-black tracking-tighter mb-8">{t('step_config')}</h2>
                <div className="space-y-10">
                  <section>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">{t('installation_kit')}</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProduct?.installation_kits.map(kit => (
                        <button 
                          key={kit.id} 
                          onClick={() => setQuoteData({...quoteData, selected_kit_id: kit.id})}
                          className={`p-6 rounded-3xl border-2 text-left transition-all ${quoteData.selected_kit_id === kit.id ? 'border-brand-600 bg-brand-50 shadow-lg' : 'border-slate-100 hover:border-brand-200'}`}
                        >
                          <p className="font-black text-slate-900 mb-2">{l(kit.name)}</p>
                          <p className="text-lg font-black text-brand-600">{formatCurrency(kit.price || 0, language)}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                  <div className="flex gap-4">
                    <button onClick={() => setQuoteStep(1)} className="px-8 py-5 border border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400">Volver</button>
                    <button onClick={() => setQuoteStep(3)} className="flex-1 py-6 bg-brand-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl">Tus Datos →</button>
                  </div>
                </div>
              </div>
            )}

            {quoteStep === 3 && (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-4xl font-black tracking-tighter mb-8">{t('step_client')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  <input type="text" placeholder={t('name')} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500" value={quoteData.client_name} onChange={e => setQuoteData({...quoteData, client_name: e.target.value})} />
                  <input type="text" placeholder={t('dni')} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500" value={quoteData.client_dni} onChange={e => setQuoteData({...quoteData, client_dni: e.target.value})} />
                  <input type="email" placeholder={t('email')} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500" value={quoteData.client_email} onChange={e => setQuoteData({...quoteData, client_email: e.target.value})} />
                  <input type="text" placeholder={t('phone')} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500" value={quoteData.client_phone} onChange={e => setQuoteData({...quoteData, client_phone: e.target.value})} />
                  <div className="md:col-span-2">
                    <input type="text" placeholder={t('address')} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500" value={quoteData.client_address} onChange={e => setQuoteData({...quoteData, client_address: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setQuoteStep(2)} className="px-8 py-5 border border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400">Volver</button>
                  <button onClick={() => setQuoteStep(4)} className="flex-1 py-6 bg-brand-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl">Finalizar →</button>
                </div>
              </div>
            )}

            {quoteStep === 4 && (
              <div className="animate-in fade-in duration-500 text-center">
                <h2 className="text-4xl font-black tracking-tighter mb-4">{t('step_sign')}</h2>
                <p className="text-slate-400 mb-10 font-medium italic">Confirme su presupuesto con su firma digital para proceder.</p>
                <div className="border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50 mb-8 overflow-hidden">
                  <SignatureCanvas ref={sigCanvas} penColor='#0f172a' canvasProps={{className: 'w-full h-64 cursor-crosshair'}} />
                </div>
                <div className="flex justify-center gap-4 mb-10">
                  <button onClick={() => sigCanvas.current?.clear()} className="px-6 py-3 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-colors">Limpiar Firma</button>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setQuoteStep(3)} className="px-8 py-5 border border-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400">Volver</button>
                  <button onClick={handleFinishQuote} className="flex-1 py-6 bg-slate-950 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl hover:bg-brand-600 transition-all">Firmar y Solicitar</button>
                </div>
              </div>
            )}

            {quoteStep === 5 && (
              <div className="animate-in zoom-in duration-700 text-center py-12">
                <div className="w-24 h-24 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-10 border-4 border-white shadow-xl">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-5xl font-black tracking-tighter mb-6">¡Gracias, {quoteData.client_name}!</h2>
                <p className="text-xl text-slate-400 mb-12 max-w-md mx-auto italic">{t('success_msg')}</p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button className="px-10 py-5 bg-brand-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-3">
                    <Download className="w-4 h-4" /> {t('download_pdf')}
                  </button>
                  <button onClick={() => setStep('home')} className="px-10 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="py-24 border-t border-slate-100 text-center bg-white mt-40">
        <div className="text-2xl font-black text-slate-200 mb-8 tracking-tighter italic uppercase">{tenant.name}</div>
        <div className="flex justify-center gap-10 mb-12">
          {['Instagram', 'Facebook', 'LinkedIn'].map(s => (
            <a key={s} href="#" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-brand-600 transition-colors">{s}</a>
          ))}
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">© 2025 · Powered by EcoQuote AI</div>
      </footer>
    </div>
  );
};

// --- Tenant Admin Dashboard Section ---

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, profile, session } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (data) setTenant(data);
    };
    fetchTenant();
  }, [slug]);

  if (loading || !tenant) return <LoadingSpinner />;
  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans">
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col shrink-0 z-50">
        <div className="p-8 h-24 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center text-white font-black italic">E</div>
          <div className="font-black text-xl tracking-tighter text-slate-900 uppercase italic">Admin<span className="text-brand-600">Hub</span></div>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          {[
            { to: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
            { to: 'products', label: t('products'), icon: Package },
            { to: 'quotes', label: t('quotes'), icon: FileText },
            { to: 'customers', label: t('customers'), icon: Users },
            { to: 'settings', label: t('settings'), icon: Settings },
          ].map(item => (
            <Link key={item.to} to={`/t/${slug}/${item.to}`} className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive(item.to) ? 'bg-brand-600 text-white shadow-xl shadow-brand-500/20' : 'text-slate-400 hover:bg-slate-50'}`}>
              <item.icon className="w-4 h-4" /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-50">
          <button onClick={signOut} className="w-full flex items-center gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-2xl transition-all">
            <LogOut className="w-4 h-4" /> {t('logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white border-b border-slate-100 flex items-center justify-between px-12 shrink-0">
          <div><h2 className="text-2xl font-black text-slate-900 tracking-tight capitalize">{tenant.name}</h2></div>
          <div className="flex gap-4">
            <Link to={`/c/${slug}`} target="_blank" className="px-5 py-2.5 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-full border border-slate-200 hover:bg-slate-200 transition-all flex items-center gap-2">
              <Globe className="w-3 h-3" /> Web Pública ↗
            </Link>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-12 bg-slate-50/50">
          <Outlet context={{ tenant }} />
        </div>
      </main>
    </div>
  );
};

const ProductManager = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);
  const { language } = useApp();

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

  useEffect(() => { fetchProducts(); }, [tenant.id]);

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Logic for Gemini PDF parsing...
    alert("AI Parsing simulation started. In a production environment, this calls Gemini API.");
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Catálogo de Equipos</h3>
        <div className="flex gap-4">
          <label className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg cursor-pointer flex items-center gap-2 hover:bg-black transition-all">
            <FileText className="w-4 h-4" /> IA: Cargar PDF
            <input type="file" className="hidden" accept=".pdf" onChange={handleAIUpload} />
          </label>
          <button onClick={() => { setCurrentProduct({}); setIsEditing(true); }} className="px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2 hover:scale-105 transition-all">
            <Plus className="w-4 h-4" /> Nuevo Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map(p => (
          <div key={p.id} className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all">
            <div className="h-40 w-full bg-slate-50 rounded-3xl mb-6 flex items-center justify-center">
              <Snowflake className="w-12 h-12 text-brand-100" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1 block">{p.brand}</span>
              <h4 className="text-xl font-black text-slate-900 mb-4">{p.model}</h4>
              <p className="text-xs text-slate-400 mb-6 line-clamp-2">{p.description.es}</p>
            </div>
            <div className="flex justify-between items-center pt-6 border-t border-slate-50">
              <div className="flex gap-2">
                <button className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                <button className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <span className={`px-3 py-1 text-[8px] font-black uppercase rounded-full ${p.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                {p.is_active ? 'Activo' : 'Borrador'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Entry Point & Main Auth Flow ---

const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'es');

  const setLanguage = (lang: Language) => { 
    setLanguageState(lang); 
    localStorage.setItem('app_lang', lang); 
    i18n.changeLanguage(lang);
  };

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
  }, []);

  const refreshProfile = async () => { if (session) await fetchProfileData(session.user.id); };
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); setMemberships([]); };

  return (
    <AppContext.Provider value={{ session, profile, memberships, loading, language, setLanguage, refreshProfile, signOut }}>
      {children}
    </AppContext.Provider>
  );
};

import i18n from './i18n';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/c/:slug" element={<PublicTenantWebsite />} />
          <Route path="/t/:slug" element={<TenantLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<ProductManager />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="customers" element={<Customers />} />
            <Route path="settings" element={<TenantSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}

// --- Placeholder Components to avoid compile errors ---

const Dashboard = () => <div className="p-10 bg-white rounded-5xl border border-slate-100 shadow-sm text-center font-black uppercase text-xs italic text-slate-300">Resumen del Negocio</div>;
const Quotes = () => <div className="p-10 bg-white rounded-5xl border border-slate-100 shadow-sm text-center font-black uppercase text-xs italic text-slate-300">Historial de Presupuestos</div>;
const Customers = () => <div className="p-10 bg-white rounded-5xl border border-slate-100 shadow-sm text-center font-black uppercase text-xs italic text-slate-300">Base de Datos de Clientes</div>;
const TenantSettings = () => <div className="p-10 bg-white rounded-5xl border border-slate-100 shadow-sm text-center font-black uppercase text-xs italic text-slate-300">Configuración de Marca y Empresa</div>;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { refreshProfile } = useApp();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { await refreshProfile(); navigate('/'); } else alert("Credenciales incorrectas");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 text-center">
        <h2 className="text-4xl font-black mb-10 text-slate-900 tracking-tighter uppercase italic">Eco<span className="text-brand-600">Quote</span></h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="email" placeholder="Email" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="w-full py-5 bg-slate-950 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">Entrar</button>
        </form>
      </div>
    </div>
  );
};

const Signup = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center font-black uppercase">
    Registro temporalmente deshabilitado
  </div>
);
