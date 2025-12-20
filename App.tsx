
import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, Navigate, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase, isConfigured, SUPABASE_URL, saveManualConfig, clearManualConfig } from './supabaseClient';
import { Membership, Profile, Tenant, Customer, Quote, QuoteItem, Language, PlatformContent, Product, LocalizedText, TechnicalSpecs } from './types';
import { translations, formatCurrency, formatDate } from './i18n';
import { Session } from '@supabase/supabase-js';
import { 
  ChevronRight, ChevronLeft, CheckCircle2, FileText, Settings, Users, LayoutDashboard, LogOut, 
  Menu, X, Sun, Snowflake, Shield, Zap, Globe, Plus, Trash2, Edit3, Save, Download, Mail, 
  PenTool, Image as ImageIcon, Search, ArrowRight, Package, Share2, Filter, Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';

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
  // Fixed: Error message updated to reflect root component name
  if (!context) throw new Error("useApp must be used within App");
  return context;
};

// --- Common UI Components ---

const LoadingSpinner = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50">
    <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-500 border-t-transparent shadow-xl"></div>
    <p className="mt-6 text-slate-400 font-black uppercase tracking-widest text-[10px] animate-pulse">EcoQuote is connecting...</p>
  </div>
);

const LanguageSwitcher = () => {
  const { language, setLanguage } = useApp();
  const langs: Language[] = ['es', 'ca', 'en', 'fr'];
  return (
    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
      {langs.map(l => (
        <button 
          key={l}
          onClick={() => setLanguage(l)} 
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${language === l ? 'bg-white text-brand-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};

// --- EcoQuote Public Website Component ---

const PublicTenantWebsite = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { language, t } = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'wizard'>('home');
  
  // Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quoteData, setQuoteData] = useState<Partial<Quote>>({
    client_name: '', client_dni: '', client_email: '', client_phone: '',
    client_address: '', client_population: '', selected_extras: [], selected_kit_id: ''
  });
  const sigCanvas = useRef<any>(null);

  // Filters
  const [brandFilter, setBrandFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: tenantData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
      if (tenantData) {
        setTenant(tenantData);
        const { data: prods } = await supabase.from('products').select('*').eq('tenant_id', tenantData.id).eq('is_active', true);
        if (prods) setProducts(prods);
      }
      setLoading(false);
    };
    fetchData();
  }, [slug]);

  const l = (obj: LocalizedText | any) => obj?.[language] || obj?.es || '';

  const startQuote = (p: Product) => {
    setSelectedProduct(p);
    setView('wizard');
    setWizardStep(1);
  };

  const filteredProducts = products.filter(p => 
    (!brandFilter || p.brand === brandFilter) && 
    (!typeFilter || p.type === typeFilter)
  );

  const totalAmount = useMemo(() => {
    if (!selectedProduct) return 0;
    // Basic price calculation (example logic)
    let total = selectedProduct.pricing_items?.[0]?.price || 0;
    const kit = selectedProduct.installation_kits?.find(k => k.id === quoteData.selected_kit_id);
    if (kit) total += kit.price || 0;
    quoteData.selected_extras?.forEach(ext => {
      const extra = selectedProduct.extras?.find(e => e.id === ext.id);
      if (extra) total += (extra.unitPrice || 0) * ext.quantity;
    });
    return total;
  }, [selectedProduct, quoteData]);

  const handleFinish = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert(t('signature_required'));
      return;
    }
    const signature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    // Save to Supabase logic...
    setWizardStep(5);
  };

  if (loading) return <LoadingSpinner />;
  if (!tenant) return <div className="p-20 text-center font-black text-slate-400 uppercase italic">404 - Empresa No Encontrada</div>;

  return (
    <div className="min-h-screen bg-white text-slate-950 font-sans selection:bg-brand-500 selection:text-white">
      {/* Dynamic Nav */}
      <nav className="flex items-center justify-between px-8 py-6 sticky top-0 bg-white/80 backdrop-blur-2xl z-50 border-b border-slate-100">
        <div className="flex items-center gap-4">
          {tenant.branding?.logo_url ? (
            <img src={tenant.branding.logo_url} className="h-10 w-auto" alt={tenant.name} />
          ) : (
            <div className="text-2xl font-black tracking-tighter text-brand-600 italic uppercase">{tenant.name}</div>
          )}
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#catalog" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-600 transition-all">Catálogo</a>
          <LanguageSwitcher />
          <button onClick={() => setView('home')} className="px-6 py-3 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-slate-200">
            {t('contact_section')}
          </button>
        </div>
      </nav>

      {view === 'home' ? (
        <main className="animate-in fade-in duration-1000">
          {/* Hero Section */}
          <section className="relative h-[85vh] flex items-center justify-center bg-slate-950 px-8 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.15),_transparent)]"></div>
            <div className="relative text-center max-w-5xl">
              <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-10">
                ✨ Especialistas en Climatización de Alta Eficiencia
              </span>
              <h1 className="text-7xl md:text-[10rem] font-black text-white tracking-tighter leading-[0.8] mb-12 uppercase">
                Eco<span className="text-brand-600">Quote</span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto italic opacity-80 mb-16">
                Diseñamos tu confort ideal con presupuestos personalizados en tiempo real. Rápido, profesional y digital.
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                <a href="#catalog" className="px-12 py-6 bg-brand-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-2xl shadow-brand-500/20">Solicitar Presupuesto</a>
                <button className="px-12 py-6 bg-white/5 text-white border border-white/10 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all backdrop-blur-xl">Sobre Nosotros</button>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="py-32 px-8 bg-slate-50">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-24">
                <h2 className="text-5xl font-black tracking-tight mb-4 uppercase italic">{t('how_it_works')}</h2>
                <div className="w-24 h-2 bg-brand-600 mx-auto rounded-full"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                {[
                  { icon: Snowflake, t: t('how_1'), d: t('how_1_d') },
                  { icon: Settings, t: t('how_2'), d: t('how_2_d') },
                  { icon: PenTool, t: t('how_3'), d: t('how_3_d') },
                ].map((step, i) => (
                  <div key={i} className="text-center group">
                    <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-10 group-hover:scale-110 transition-all border border-slate-100">
                      <step.icon className="w-10 h-10 text-brand-600" />
                    </div>
                    <h3 className="text-2xl font-black mb-6 tracking-tight leading-none">{step.t}</h3>
                    <p className="text-slate-400 font-medium italic leading-relaxed">{step.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Catalog with Filters */}
          <section id="catalog" className="py-32 px-8 max-w-7xl mx-auto scroll-mt-24">
            <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-20">
              <div className="max-w-xl text-left">
                <h2 className="text-6xl font-black tracking-tighter uppercase italic mb-4">Soluciones Premium</h2>
                <p className="text-slate-400 font-medium italic">Selecciona el equipo que mejor se adapte a tu espacio y necesidades energéticas.</p>
              </div>
              <div className="flex gap-4">
                <div className="relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    onChange={e => setBrandFilter(e.target.value)}
                    className="pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  >
                    <option value="">Todas las Marcas</option>
                    {[...new Set(products.map(p => p.brand))].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col">
                  <div className="h-56 w-full bg-slate-50 rounded-[2.8rem] mb-10 flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.model} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <Snowflake className="w-16 h-16 text-brand-100" />
                    )}
                  </div>
                  <div className="mb-8 flex justify-between items-start text-left">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-600 mb-2 block">{p.brand}</span>
                      <h3 className="text-3xl font-black tracking-tight">{p.model}</h3>
                    </div>
                    <button onClick={() => alert(t('share'))} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all"><Share2 className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-4 mb-12 flex-1">
                    <div className="flex justify-between text-xs font-bold text-slate-400 border-b border-slate-50 pb-2">
                      <span>{t('cooling')}</span>
                      <span className="text-slate-900 font-black">{p.technical_specs.coolingCapacityKw} kW</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 border-b border-slate-50 pb-2">
                      <span>Eficiencia</span>
                      <span className="text-green-600 font-black">A+++</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>{t('warranty')}</span>
                      <span className="text-slate-900 font-black">{p.technical_specs.warranty}</span>
                    </div>
                  </div>
                  <button onClick={() => startQuote(p)} className="w-full py-6 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] group-hover:bg-brand-600 transition-all shadow-xl shadow-slate-200">
                    Configurar Presupuesto →
                  </button>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-20 text-center font-black uppercase text-slate-300 italic tracking-widest">No hay resultados</div>
              )}
            </div>
          </section>
        </main>
      ) : (
        /* EcoQuote Wizard Experience */
        <div className="max-w-5xl mx-auto py-20 px-8 animate-in slide-in-from-bottom-10 duration-700">
          {/* Progress Nav */}
          <div className="mb-16 flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-50">
              <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${(wizardStep / 4) * 100}%` }}></div>
            </div>
            {[1, 2, 3, 4].map(num => (
              <div key={num} className="flex items-center gap-4 relative z-10">
                <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center font-black text-sm transition-all border-2 ${wizardStep === num ? 'bg-brand-600 border-brand-600 text-white shadow-xl scale-110' : wizardStep > num ? 'bg-brand-50 border-brand-100 text-brand-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                  {wizardStep > num ? <CheckCircle2 className="w-6 h-6" /> : num}
                </div>
                <div className="hidden lg:block text-left">
                  <p className={`text-[10px] font-black uppercase tracking-widest leading-none ${wizardStep >= num ? 'text-slate-900' : 'text-slate-400'}`}>
                    {num === 1 ? t('step_product') : num === 2 ? t('step_config') : num === 3 ? t('step_client') : t('step_sign')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-12 lg:p-20 rounded-[4rem] border border-slate-100 shadow-2xl relative">
            <div className="absolute top-10 right-10 flex gap-4">
              <div className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Estimado</p>
                <p className="text-xl font-black text-brand-600">{formatCurrency(totalAmount, language)}</p>
              </div>
            </div>

            {wizardStep === 1 && (
              <div className="animate-in fade-in duration-500 text-left">
                <div className="flex flex-col lg:flex-row gap-20">
                  <div className="flex-1">
                    <h2 className="text-5xl font-black tracking-tighter mb-6">{selectedProduct?.brand} {selectedProduct?.model}</h2>
                    <p className="text-xl text-slate-400 font-medium italic leading-relaxed mb-10">{l(selectedProduct?.description)}</p>
                    <div className="grid grid-cols-2 gap-6 mb-12">
                      {[
                        { label: t('brand'), val: selectedProduct?.brand, icon: Shield },
                        { label: t('cooling'), val: `${selectedProduct?.technical_specs.coolingCapacityKw}kW`, icon: Snowflake },
                        { label: t('heating'), val: `${selectedProduct?.technical_specs.heatingCapacityKw}kW`, icon: Sun },
                        { label: t('warranty'), val: selectedProduct?.technical_specs.warranty, icon: Zap },
                      ].map((s, i) => (
                        <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <s.icon className="w-6 h-6 text-brand-500 mb-4" />
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                          <p className="text-sm font-black text-slate-900">{s.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full lg:w-96">
                    <div className="bg-slate-50 rounded-[3rem] p-4 aspect-square flex items-center justify-center border border-slate-100 mb-10 overflow-hidden">
                      {selectedProduct?.image_url ? <img src={selectedProduct.image_url} className="w-full h-full object-cover rounded-[2.5rem]" /> : <ImageIcon className="w-20 h-20 text-slate-200" />}
                    </div>
                  </div>
                </div>
                <button onClick={() => setWizardStep(2)} className="w-full py-8 bg-brand-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-brand-500/30 hover:scale-[1.02] transition-all">Configurar Instalación →</button>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="animate-in fade-in duration-500 text-left">
                <h2 className="text-5xl font-black tracking-tighter mb-12">{t('step_config')}</h2>
                <div className="space-y-16">
                  <section>
                    <div className="flex justify-between items-center mb-8">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Kit de Instalación</label>
                      <Info className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedProduct?.installation_kits.map(kit => (
                        <button 
                          key={kit.id} 
                          onClick={() => setQuoteData({...quoteData, selected_kit_id: kit.id})}
                          className={`p-10 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden group ${quoteData.selected_kit_id === kit.id ? 'border-brand-600 bg-brand-50 shadow-2xl scale-[1.02]' : 'border-slate-100 hover:border-brand-200 bg-white'}`}
                        >
                          <div className={`absolute top-0 right-0 w-24 h-24 bg-brand-500/5 blur-3xl rounded-full transition-opacity ${quoteData.selected_kit_id === kit.id ? 'opacity-100' : 'opacity-0'}`}></div>
                          <p className="font-black text-2xl text-slate-950 mb-3">{l(kit.name)}</p>
                          <ul className="space-y-2 mb-8">
                            {kit.items.slice(0, 3).map((it, i) => (
                              <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                                <div className="w-1 h-1 bg-brand-500 rounded-full"></div> {it}
                              </li>
                            ))}
                          </ul>
                          <p className="text-2xl font-black text-brand-600">{formatCurrency(kit.price || 0, language)}</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="flex justify-between items-center mb-8">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Materiales y Servicios Extra</label>
                      <button className="text-[10px] font-black uppercase text-brand-600 underline">Ver todos</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProduct?.extras.slice(0, 4).map(extra => {
                        const isSelected = quoteData.selected_extras?.some(e => e.id === extra.id);
                        return (
                          <button 
                            key={extra.id} 
                            onClick={() => {
                              const existing = quoteData.selected_extras?.find(e => e.id === extra.id);
                              if (existing) {
                                setQuoteData({...quoteData, selected_extras: quoteData.selected_extras?.filter(e => e.id !== extra.id)});
                              } else {
                                setQuoteData({...quoteData, selected_extras: [...(quoteData.selected_extras || []), { id: extra.id, quantity: 1 }]});
                              }
                            }}
                            className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all ${isSelected ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-slate-50 hover:border-brand-100 bg-slate-50/50'}`}
                          >
                            <div className="text-left">
                              <p className="font-black text-sm uppercase">{l(extra.name)}</p>
                              <p className="text-[10px] opacity-60 font-bold">{formatCurrency(extra.unitPrice || 0, language)} / unidad</p>
                            </div>
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-200 bg-white'}`}>
                              {isSelected && <CheckCircle2 className="w-4 h-4" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
                <div className="flex gap-4 mt-20">
                  <button onClick={() => setWizardStep(1)} className="px-10 py-6 border border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Atrás</button>
                  <button onClick={() => setWizardStep(3)} className="flex-1 py-8 bg-brand-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl">Continuar →</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="animate-in fade-in duration-500 text-left">
                <h2 className="text-5xl font-black tracking-tighter mb-12">{t('step_client')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('name')}</label>
                    <input type="text" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-bold" value={quoteData.client_name} onChange={e => setQuoteData({...quoteData, client_name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('dni')}</label>
                    <input type="text" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-bold" value={quoteData.client_dni} onChange={e => setQuoteData({...quoteData, client_dni: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('email')}</label>
                    <input type="email" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-bold" value={quoteData.client_email} onChange={e => setQuoteData({...quoteData, client_email: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('phone')}</label>
                    <input type="text" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-bold" value={quoteData.client_phone} onChange={e => setQuoteData({...quoteData, client_phone: e.target.value})} />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">{t('address')}</label>
                    <input type="text" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-bold" value={quoteData.client_address} onChange={e => setQuoteData({...quoteData, client_address: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(2)} className="px-10 py-6 border border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Atrás</button>
                  <button onClick={() => setWizardStep(4)} className="flex-1 py-8 bg-brand-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl">Revisar y Firmar →</button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="animate-in fade-in duration-500 text-center">
                <h2 className="text-5xl font-black tracking-tighter mb-4">{t('step_sign')}</h2>
                <p className="text-slate-400 mb-12 font-medium italic">Revise los datos y firme en el recuadro para emitir su presupuesto oficial.</p>
                
                <div className="max-w-xl mx-auto mb-16 space-y-4">
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] text-left border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Resumen del Pedido</p>
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-slate-600">{selectedProduct?.model}</span>
                      <span className="font-black">{formatCurrency(selectedProduct?.pricing_items?.[0]?.price || 0, language)}</span>
                    </div>
                    {quoteData.selected_kit_id && (
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-slate-600 italic">Kit: {l(selectedProduct?.installation_kits.find(k => k.id === quoteData.selected_kit_id)?.name)}</span>
                        <span className="font-black">{formatCurrency(selectedProduct?.installation_kits.find(k => k.id === quoteData.selected_kit_id)?.price || 0, language)}</span>
                      </div>
                    )}
                    <div className="h-[2px] bg-slate-100 my-6"></div>
                    <div className="flex justify-between items-end">
                      <span className="text-2xl font-black uppercase">Total</span>
                      <span className="text-4xl font-black text-brand-600">{formatCurrency(totalAmount, language)}</span>
                    </div>
                  </div>
                </div>

                <div className="max-w-xl mx-auto border-4 border-slate-100 rounded-[3rem] bg-white shadow-inner mb-8 overflow-hidden">
                  {/* Fixed: Props spreading to bypass TypeScript property checking for penColor in certain SignatureCanvas versions */}
                  <SignatureCanvas 
                    ref={sigCanvas} 
                    {...({ penColor: '#020617' } as any)}
                    canvasProps={{ className: 'w-full h-72 cursor-crosshair' }} 
                  />
                </div>
                
                <div className="flex justify-center gap-4 mb-16">
                  <button onClick={() => sigCanvas.current?.clear()} className="px-8 py-3 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-red-500 hover:border-red-100 transition-all flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> {t('clear')}
                  </button>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(3)} className="px-10 py-6 border border-slate-100 rounded-3xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Atrás</button>
                  <button onClick={handleFinish} className="flex-1 py-8 bg-slate-950 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-brand-600 transition-all">Emitir Presupuesto →</button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="animate-in zoom-in duration-700 text-center py-20">
                <div className="w-32 h-32 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-12 border-4 border-white shadow-2xl">
                  <CheckCircle2 className="w-16 h-16" />
                </div>
                <h2 className="text-6xl font-black tracking-tighter mb-8 italic">¡Todo listo!</h2>
                <p className="text-2xl text-slate-400 mb-16 max-w-lg mx-auto italic font-medium leading-relaxed">{t('success_msg')}</p>
                <div className="flex flex-wrap justify-center gap-6">
                  <button className="px-12 py-6 bg-brand-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-4 hover:scale-105 transition-all">
                    <Download className="w-5 h-5" /> {t('download_pdf')}
                  </button>
                  <button onClick={() => setView('home')} className="px-12 py-6 bg-slate-100 text-slate-600 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Corporate Footer */}
      <footer className="py-24 border-t border-slate-100 text-center bg-white mt-40">
        <div className="text-3xl font-black text-slate-200 mb-10 tracking-tighter italic uppercase">{tenant.name}</div>
        <div className="flex justify-center gap-12 mb-16">
          {['Instagram', 'Facebook', 'LinkedIn', 'WhatsApp'].map(s => (
            <a key={s} href="#" className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 hover:text-brand-600 transition-colors">{s}</a>
          ))}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">© 2025 · Powered by EcoQuote AI · CLIMATIZACIÓN INTELIGENTE</div>
      </footer>
    </div>
  );
};

// --- App Entry & Other Components ---

const AdminDashboard = () => (
  <div className="space-y-12 animate-in fade-in duration-700">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {[ { label: 'Total Tenants', val: '24', icon: '🏢' }, { label: 'Usuarios Activos', val: '1,2k', icon: '👥' }, { label: 'Ingresos MRR', val: '8.450€', icon: '💰' }, { label: 'Uptime', val: '99.9%', icon: '⚡' } ].map((s, i) => (
        <div key={i} className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-slate-800 transition-all">
          <div className="absolute -right-6 -bottom-6 text-8xl opacity-5 group-hover:scale-110 transition-all">{s.icon}</div>
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">{s.label}</div>
          <div className="text-4xl font-black text-white tracking-tighter">{s.val}</div>
        </div>
      ))}
    </div>
  </div>
);

const Landing = () => {
  const { t, session, memberships } = useApp();
  const dashboardLink = memberships.length > 0 ? `/t/${memberships[0].tenant?.slug}/dashboard` : '/onboarding';
  return (
    <div className="min-h-screen bg-white font-sans text-center">
      <header className="flex items-center justify-between px-10 py-6 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="text-2xl font-black text-brand-600 italic uppercase tracking-tighter">EcoQuote</div>
        <div className="flex items-center gap-8"><LanguageSwitcher />{session ? <Link to={dashboardLink} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full">Panel Admin</Link> : <Link to="/login" className="px-8 py-3 bg-brand-600 text-white text-[10px] font-black uppercase rounded-full">Empezar</Link>}</div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-40">
        <h1 className="text-8xl font-black text-slate-900 mb-10 tracking-tighter leading-[0.9] uppercase italic">Controla tu negocio con precisión.</h1>
        <p className="text-xl text-slate-500 mb-16 max-w-2xl mx-auto font-medium">La plataforma definitiva para instaladores bilingües de climatización.</p>
        <Link to={session ? dashboardLink : "/signup"} className="px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] text-sm font-black uppercase tracking-widest shadow-2xl">EMPEZAR GRATIS</Link>
      </main>
    </div>
  );
};

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-500"></div>
          <h2 className="text-4xl font-black mb-10 text-slate-900 tracking-tighter leading-none italic uppercase">EcoQuote</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Email</label>
              <input type="email" placeholder="email@company.com" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none mt-1 focus:ring-2 focus:ring-brand-500" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Contraseña</label>
              <input type="password" placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none mt-1 focus:ring-2 focus:ring-brand-500" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="w-full py-5 bg-slate-950 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-brand-600 transition-all">ENTRAR</button>
          </form>
          <button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} className="w-full py-4 mt-8 bg-white text-slate-700 border border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Workspace de Prueba</button>
        </div>
      </div>
    </div>
  );
};

const Signup = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 font-black uppercase text-xs tracking-widest text-slate-300 italic">
    Registro temporalmente deshabilitado
  </div>
);

const Onboarding = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 font-black uppercase text-xs tracking-widest text-slate-300 italic">
    Configuración de empresa en desarrollo
  </div>
);

// --- Dashboard & Management ---

const TenantLayout = () => {
  const { slug } = useParams();
  const { memberships, signOut, loading, t, profile, session, dbHealthy } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const currentMembership = memberships.find(m => m.tenant?.slug === slug);
  const currentTenant = currentMembership?.tenant;

  useEffect(() => {
    if (!loading && !session) navigate('/login');
  }, [loading, session, navigate]);

  if (loading || !currentTenant) return <LoadingSpinner />;
  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] font-sans">
      <aside className="w-80 bg-white border-r border-slate-100 flex flex-col shrink-0 z-30">
        <div className="p-8 h-24 flex items-center justify-between font-black text-xl text-brand-600 uppercase italic truncate tracking-tighter">{currentTenant.name}</div>
        <nav className="flex-1 p-6 space-y-2">
          <Link to={`/t/${slug}/dashboard`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('dashboard') ? 'bg-brand-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>📊 {t('dashboard')}</Link>
          <Link to={`/t/${slug}/customers`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('customers') ? 'bg-brand-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>👥 {t('customers')}</Link>
          <Link to={`/t/${slug}/quotes`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('quotes') ? 'bg-brand-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>📄 {t('quotes')}</Link>
          <Link to={`/t/${slug}/settings`} className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest transition-all ${isActive('settings') ? 'bg-brand-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>⚙️ {t('settings')}</Link>
        </nav>
        <div className="p-8 border-t border-slate-50"><button onClick={signOut} className="w-full flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-2xl transition-all">🚪 {t('logout')}</button></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white border-b border-slate-100 flex items-center justify-between px-12 shrink-0">
          <div className="flex flex-col"><h2 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">{currentTenant.name}</h2></div>
          <div className="flex gap-4"><a href={`#/c/${slug}`} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-slate-50 text-slate-400 text-[9px] font-black uppercase rounded-full border border-slate-100 hover:text-slate-900 transition-all flex items-center gap-2 tracking-widest"><Globe className="w-3 h-3" /> Web Pública ↗</a></div>
        </header>
        <div className="flex-1 overflow-auto p-12 bg-slate-50/50"><Outlet context={{ tenant: currentTenant }} /></div>
      </main>
    </div>
  );
};

const Dashboard = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[ { l: 'Ingresos Totales', v: '0.00 €', i: '💰' }, { l: 'Presupuestos Activos', v: '0', i: '⏳' }, { l: 'Clientes Totales', v: '0', i: '👥' } ].map((s, i) => (
            <div key={i} className="bg-white p-10 rounded-[2.8rem] shadow-sm border border-slate-100 hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-brand-600 group-hover:text-white transition-all">{s.i}</div>
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{s.l}</h3>
              <p className="text-4xl font-black mt-2 text-slate-900 tracking-tighter">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 h-80 flex items-center justify-center text-slate-300 font-black uppercase tracking-widest text-xs italic">Hub de {tenant.name}</div>
    </div>
  );
};

// Fixed: Renamed AppProvider to App and added default export to resolve index.tsx error
const App = () => {
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
            <Route path="customers" element={<div className="p-10 font-black uppercase text-slate-300 italic tracking-widest text-xs">Gestión de Clientes</div>} />
            <Route path="quotes" element={<div className="p-10 font-black uppercase text-slate-300 italic tracking-widest text-xs">Gestión de Presupuestos</div>} />
            <Route path="settings" element={<div className="p-10 font-black uppercase text-slate-300 italic tracking-widest text-xs">Configuración de Empresa</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
}

export default App;
