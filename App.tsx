import React, { useState, useEffect, useMemo } from 'react';
import * as api from './services/api';
import { Product, ContactData, CompanyInfo } from './types';
import ProductCard from './components/ProductCard';
import Calculator from './components/Calculator';
import Admin from './components/Admin';
import LanguageSelector from './components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import { Settings, Lock, Mail, Phone, MapPin, Facebook, Instagram, Twitter, X, Send, Loader2, ArrowDown, SlidersHorizontal, ShieldCheck, Wrench, FileText, Cookie, Menu, Scale, Hammer, ClipboardCheck, Linkedin, UserCheck } from 'lucide-react';
import { getLangText } from './i18nUtils';
import { Session } from '@supabase/supabase-js';

const INFO_IMAGES: Record<string, string> = {
    instalacion: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=1000",
    mantenimiento: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=1000",
    reparacion: "https://images.unsplash.com/photo-1581094794329-cd11965d1169?auto=format&fit=crop&q=80&w=1000",
    garantias: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=1000",
    privacidad: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=1000",
    cookies: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1000",
    avisoLegal: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1000"
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'home' | 'calculator' | 'admin'>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [filterPrice, setFilterPrice] = useState<number>(3000);
  const [maxPriceAvailable, setMaxPriceAvailable] = useState<number>(3000);

  const [session, setSession] = useState<Session | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [showContact, setShowContact] = useState(false);
  const [contactForm, setContactForm] = useState<ContactData>({ nombre: '', email: '', mensaje: '' });
  const [contactErrors, setContactErrors] = useState<Partial<ContactData>>({});
  const [contactStatus, setContactStatus] = useState<'idle'|'sending'|'success'|'error'>('idle');

  const [activeInfoKey, setActiveInfoKey] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ address: '', phone: '', email: '' });

  useEffect(() => {
    api.getSession().then(setSession).catch(err => console.error("Session fetch error:", err));
    const subscription = api.onAuthStateChange((newSession) => {
        setSession(newSession);
        if (newSession && view === 'home' && showAdminLogin) {
            setView('admin');
            setShowAdminLogin(false);
        } else if (!newSession && view === 'admin') {
            setView('home');
        }
    });
    return () => { if (subscription && subscription.unsubscribe) subscription.unsubscribe(); };
  }, [view, showAdminLogin]);

  useEffect(() => {
    if (view === 'home') loadCatalog();
    api.getCompanyInfo().then(info => { if (info) setCompanyInfo(info); }).catch(e => console.error("Company info error:", e));
  }, [view]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await api.getCatalog();
      setProducts(data || []);
      if (data && data.length > 0) {
          const max = Math.max(...data.map(p => 
              p.pricing && p.pricing.length > 0 ? Math.min(...p.pricing.map(x => x.price)) : 0
          ));
          const calculatedMax = Math.ceil(max / 100) * 100 + 500;
          setMaxPriceAvailable(calculatedMax);
          setFilterPrice(calculatedMax);
      }
    } catch (e) { console.error("Failed to load catalog", e); } finally { setLoading(false); }
  };

  const uniqueBrands = useMemo(() => {
    const brands = new Set(products.map(p => p.brand));
    return Array.from(brands).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        if (filterType !== 'all' && p.type !== filterType) return false;
        if (filterBrand !== 'all' && p.brand !== filterBrand) return false;
        const basePrice = p.pricing && p.pricing.length > 0 ? Math.min(...p.pricing.map(x => x.price)) : 0;
        if (basePrice > filterPrice) return false;
        return true;
    });
  }, [products, filterType, filterBrand, filterPrice]);

  const handleAdminLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
        await api.signIn(email, password);
        setView('admin');
        setShowAdminLogin(false);
        setEmail('');
        setPassword('');
    } catch (err: any) {
        setAuthError(err.message || "Credenciales incorrectas.");
    } finally { setAuthLoading(false); }
  };

  const handleContactSubmit = async () => {
    if (!contactForm.nombre || !contactForm.email || !contactForm.mensaje) return;
    setContactStatus('sending');
    try {
        await api.sendContact(contactForm);
        setContactStatus('success');
        setTimeout(() => { setShowContact(false); setContactStatus('idle'); setContactForm({ nombre: '', email: '', mensaje: '' }); }, 2500);
    } catch(e) { setContactStatus('error'); alert(t('validation.contact_error')); }
  };

  if (view === 'admin') return <Admin onLogout={async () => { await api.signOut(); setView('home'); }} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/60 sticky top-0 z-50 h-20 flex items-center transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setView('home'); setSelectedProduct(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                {companyInfo.showLogo && companyInfo.logoUrl ? (
                    <img src={companyInfo.logoUrl} alt={companyInfo.brandName} className="h-12 w-auto object-contain" />
                ) : (
                    <>
                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-200">
                            {(companyInfo.brandName || "E").charAt(0)}
                        </div>
                        <span className="font-black text-xl text-brand-700 tracking-tight">{companyInfo.brandName || "EcoQuote"}</span>
                    </>
                )}
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
                <button onClick={() => setView('home')} className={`font-semibold px-3 py-2 rounded-lg transition-colors ${view === 'home' && !selectedProduct ? 'text-brand-600 bg-brand-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>{t('nav.home')}</button>
                <button onClick={() => document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth'})} className="font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors">{t('nav.products')}</button>
                <button onClick={() => setShowContact(true)} className="font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors">{t('nav.contact')}</button>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <LanguageSelector />
                {session ? (
                    <button onClick={() => setView('admin')} className="flex items-center gap-2 px-3 py-2 bg-brand-50 text-brand-700 rounded-xl font-bold hover:bg-brand-100"><UserCheck size={18}/> Panel Admin</button>
                ) : (
                    <button onClick={() => setShowAdminLogin(true)} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"><Settings size={20} /></button>
                )}
            </nav>
            <button className="md:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </div>
        {mobileMenuOpen && (
            <div className="absolute top-20 left-0 w-full bg-white border-b border-slate-200 shadow-xl p-6 flex flex-col gap-4 md:hidden animate-in slide-in-from-top-10">
                <button onClick={() => { setView('home'); setMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 p-3 hover:bg-slate-50 rounded-xl">{t('nav.home')}</button>
                <button onClick={() => { setShowContact(true); setMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 p-3 hover:bg-slate-50 rounded-xl">{t('nav.contact')}</button>
                <div className="p-3"><LanguageSelector /></div>
                {session ? <button onClick={() => setView('admin')} className="text-left font-bold text-brand-600 p-3 bg-brand-50 rounded-xl flex items-center gap-2"><UserCheck size={20}/> Admin</button> : <button onClick={() => setShowAdminLogin(true)} className="text-left font-bold text-brand-600 p-3 bg-brand-50 rounded-xl flex items-center gap-2"><Settings size={20}/> {t('nav.admin')}</button>}
            </div>
        )}
      </header>

      <main className="flex-1 w-full">
        {view === 'home' && (
            <div className="animate-in fade-in duration-700">
                {/* HERO SECTION - Recuperado diseño original con imagen */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 mb-16">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl min-h-[500px] flex items-center">
                        <div className="absolute inset-0 bg-slate-200">
                             <img src="https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2400&auto=format&fit=crop" className="w-full h-full object-cover" alt="Hero"/>
                             <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent"></div>
                        </div>
                        <div className="relative z-10 px-8 py-12 md:p-16 max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold mb-6 backdrop-blur-sm uppercase tracking-wider">
                                 <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span></span>
                                 {t('hero.badge')}
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
                                {t('hero.title_1')}<br/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-brand-500">{t('hero.title_2')}</span>
                            </h1>
                            <p className="text-lg text-slate-200 mb-8 leading-relaxed max-w-lg">{t('hero.subtitle')}</p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 group">{t('hero.cta_catalog')} <ArrowDown size={18} className="group-hover:translate-y-1 transition-transform"/></button>
                                <button onClick={() => setShowContact(true)} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-xl font-bold backdrop-blur-md transition-all">{t('hero.cta_budget')}</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="catalogo" className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('catalog.title')}</h2>
                        <p className="text-slate-500 mt-2">{t('catalog.subtitle')}</p>
                    </div>

                    {/* Filtros Bar */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-10 shadow-sm flex flex-col lg:flex-row gap-8 items-end">
                        <div className="flex-1 w-full lg:w-auto">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><SlidersHorizontal size={14}/> {t('catalog.filters.type')}</label>
                            <div className="flex flex-wrap gap-2">
                                {['all', 'Aire Acondicionado', 'Caldera', 'Termo Eléctrico'].map(type => (
                                    <button key={type} onClick={() => setFilterType(type)} className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${filterType === type ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{type === 'all' ? t('catalog.filters.all_types') : type}</button>
                                ))}
                            </div>
                        </div>
                        <div className="w-full lg:w-[200px]">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('catalog.filters.brand')}</label>
                            <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none hover:bg-white transition-colors">
                                <option value="all">{t('catalog.filters.all_brands')}</option>
                                {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div className="w-full lg:w-[250px]">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between"><span>{t('catalog.filters.max_price')}</span><span className="text-brand-600 font-bold">{filterPrice} €</span></label>
                            <input type="range" min="0" max={maxPriceAvailable} step="50" value={filterPrice} onChange={(e) => setFilterPrice(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600" />
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[1,2,3].map(i => <div key={i} className="h-[450px] bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 animate-pulse"><div className="h-48 bg-slate-100 rounded-xl"/><div className="h-6 w-2/3 bg-slate-100 rounded"/><div className="h-4 w-1/2 bg-slate-100 rounded"/><div className="mt-auto h-12 bg-slate-100 rounded-xl"/></div>)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {filteredProducts.length > 0 ? filteredProducts.map(p => <ProductCard key={p.id} product={p} onSelect={prod => { setSelectedProduct(prod); setView('calculator'); }} />) : <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-300"><h3 className="text-xl font-bold text-slate-700 mb-2">{t('catalog.no_results')}</h3><button onClick={() => { setFilterType('all'); setFilterBrand('all'); setFilterPrice(maxPriceAvailable); }} className="text-brand-600 font-bold hover:underline">{t('catalog.filters.clean')}</button></div>}
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === 'calculator' && selectedProduct && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8"><Calculator product={selectedProduct} onBack={() => { setView('home'); setSelectedProduct(null); }} /></div>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-300 py-16 mt-auto border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-black text-2xl text-white">
                        {companyInfo.showLogo && companyInfo.logoUrl ? <img src={companyInfo.logoUrl} className="h-10 w-auto object-contain brightness-0 invert" /> : <><div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold">{(companyInfo.brandName || "E").charAt(0)}</div>{companyInfo.brandName || "EcoQuote"}</>}
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{getLangText(companyInfo.companyDescription, i18n.language) || t('footer.brand_desc')}</p>
                    <div className="flex gap-4 pt-2">
                        {companyInfo.facebookUrl && <a href={companyInfo.facebookUrl} className="p-2 bg-slate-800 rounded-lg hover:bg-brand-600 hover:text-white transition-colors"><Facebook size={18}/></a>}
                        {companyInfo.instagramUrl && <a href={companyInfo.instagramUrl} className="p-2 bg-slate-800 rounded-lg hover:bg-brand-600 hover:text-white transition-colors"><Instagram size={18}/></a>}
                        {companyInfo.twitterUrl && <a href={companyInfo.twitterUrl} className="p-2 bg-slate-800 rounded-lg hover:bg-brand-600 hover:text-white transition-colors"><Twitter size={18}/></a>}
                    </div>
                </div>
                <div>
                    <h4 className="text-white font-bold text-lg mb-6">{t('footer.services')}</h4>
                    <ul className="space-y-3">
                        <li><button onClick={()=>setActiveInfoKey('instalacion')} className="hover:text-brand-400 transition-colors flex items-center gap-2"><Hammer size={14}/> {t('services.installation')}</button></li>
                        <li><button onClick={()=>setActiveInfoKey('mantenimiento')} className="hover:text-brand-400 transition-colors flex items-center gap-2"><ClipboardCheck size={14}/> {t('services.maintenance')}</button></li>
                        <li><button onClick={()=>setActiveInfoKey('garantias')} className="hover:text-brand-400 transition-colors flex items-center gap-2"><ShieldCheck size={14}/> {t('services.warranty')}</button></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-white font-bold text-lg mb-6">{t('footer.legal')}</h4>
                    <ul className="space-y-3">
                         <li><button onClick={()=>setActiveInfoKey('privacidad')} className="hover:text-brand-400 transition-colors flex items-center gap-2"><FileText size={14}/> {t('legal.privacy')}</button></li>
                         <li><button onClick={()=>setActiveInfoKey('cookies')} className="hover:text-brand-400 transition-colors flex items-center gap-2"><Cookie size={14}/> {t('legal.cookies')}</button></li>
                         <li><button onClick={()=>setActiveInfoKey('avisoLegal')} className="hover:text-brand-400 transition-colors flex items-center gap-2"><Scale size={14}/> {t('legal.notice')}</button></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-white font-bold text-lg mb-6">{t('footer.contact')}</h4>
                    <ul className="space-y-4">
                        <li className="flex gap-3 items-start"><MapPin className="text-brand-500 shrink-0 mt-1" size={18}/><span>{companyInfo.address}</span></li>
                        <li className="flex gap-3 items-center"><Phone className="text-brand-500 shrink-0" size={18}/><span>{companyInfo.phone}</span></li>
                        <li className="flex gap-3 items-center"><Mail className="text-brand-500 shrink-0" size={18}/><span>{companyInfo.email}</span></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-slate-800 pt-8 mt-12 text-center"><p className="text-xs text-slate-500">© {new Date().getFullYear()} {companyInfo.brandName} {t('footer.rights')}</p></div>
        </div>
      </footer>

      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl">
                <div className="flex justify-center mb-6"><div className="bg-slate-100 p-4 rounded-full"><Lock className="text-slate-500" size={32} /></div></div>
                <h3 className="text-center font-bold text-xl mb-6">{t('admin_login.title')}</h3>
                <div className="space-y-4">
                    <input type="email" className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-brand-500 bg-white" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
                    <input type="password" title="password" className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-brand-500 bg-white" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdminLogin()}/>
                </div>
                {authError && <p className="text-red-500 text-xs font-bold mt-4 text-center">{authError}</p>}
                <button onClick={handleAdminLogin} disabled={authLoading} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 rounded-xl transition-colors mt-6 flex items-center justify-center gap-2">{authLoading ? <Loader2 className="animate-spin" size={18}/> : <Lock size={18}/>} {t('admin_login.enter')}</button>
                <button onClick={()=>setShowAdminLogin(false)} className="w-full text-slate-400 font-bold py-3 mt-2 hover:text-slate-600 transition-colors">Cerrar</button>
            </div>
        </div>
      )}

      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
                <h3 className="font-bold text-2xl mb-6">{t('validation.contact_title')}</h3>
                <div className="space-y-4">
                    <input className="w-full border-2 border-slate-100 p-3 rounded-xl bg-slate-50 focus:bg-white focus:border-brand-500 outline-none" placeholder={t('validation.field_name')} value={contactForm.nombre} onChange={e=>setContactForm({...contactForm, nombre:e.target.value})}/>
                    <input className="w-full border-2 border-slate-100 p-3 rounded-xl bg-slate-50 focus:bg-white focus:border-brand-500 outline-none" placeholder={t('validation.field_email')} value={contactForm.email} onChange={e=>setContactForm({...contactForm, email:e.target.value})}/>
                    <textarea className="w-full border-2 border-slate-100 p-3 rounded-xl bg-slate-50 focus:bg-white focus:border-brand-500 outline-none h-32 resize-none" placeholder={t('validation.field_message')} value={contactForm.mensaje} onChange={e=>setContactForm({...contactForm, mensaje:e.target.value})}/>
                    <button onClick={handleContactSubmit} disabled={contactStatus === 'sending'} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">{contactStatus === 'sending' ? <Loader2 className="animate-spin"/> : <Send size={18}/>} {t('validation.send_button')}</button>
                    <button onClick={()=>setShowContact(false)} className="w-full text-slate-400 font-bold py-3 hover:text-slate-600 transition-colors">Cerrar</button>
                </div>
            </div>
        </div>
      )}

      {activeInfoKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="relative h-48 bg-slate-200 shrink-0"><img src={INFO_IMAGES[activeInfoKey]} alt="info" className="w-full h-full object-cover"/><button onClick={()=>setActiveInfoKey(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white p-2 rounded-full"><X size={20}/></button></div>
                <div className="p-8 overflow-y-auto custom-scrollbar"><h3 className="font-bold text-2xl mb-4 text-slate-900">{t(`info.${activeInfoKey}.title`)}</h3><p className="text-slate-600 leading-relaxed text-lg">{t(`info.${activeInfoKey}.text`)}</p><button onClick={()=>setActiveInfoKey(null)} className="w-full mt-8 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl transition-colors">Entendido</button></div>
             </div>
        </div>
      )}
    </div>
  );
};

export default App;