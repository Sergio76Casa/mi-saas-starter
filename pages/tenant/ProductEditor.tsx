
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

type I18n = { es: string; ca: string };

const TYPES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Caldera' },
  { id: 'termo_electrico', label: 'Termo Eléctrico' },
  { id: 'aerotermia', label: 'Aerotermia' }
];

const STATUSES = [
  { id: 'draft', label: 'Borrador' },
  { id: 'active', label: 'Activo' },
  { id: 'inactive', label: 'Inactivo' }
];

type TabId = 'general' | 'technical' | 'kits' | 'extras_tab' | 'financing' | 'pricing' | 'stock' | 'multimedia';

interface TechSpec {
  title: string;
  description: string;
}

interface FinancingRow {
  label: I18n;
  months: number;
  commission: number;
  coefficient: number;
}

export const ProductEditor = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { language } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [previews, setPreviews] = useState({ product: '', logo: '' });

  const [productData, setProductData] = useState<any>({
    brand: '',
    model: '',
    type: 'aire_acondicionado',
    status: 'draft',
    pricing: [],
    installation_kits: [],
    extras: [],
    stock: 0,
    features: '',
    image_url: '',
    brand_logo_url: ''
  });

  const [techSpecs, setTechSpecs] = useState<TechSpec[]>([]);
  const [financing, setFinancing] = useState<FinancingRow[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (id === 'new') {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (data && !error) {
        setProductData(data);
        setPreviews({ product: data.image_url || '', logo: data.brand_logo_url || '' });
        try {
          if (data.features) {
            const parsed = JSON.parse(data.features);
            if (parsed.techSpecs) setTechSpecs(parsed.techSpecs);
            if (parsed.financing) setFinancing(parsed.financing);
          }
        } catch (e) { console.error("Error parsing features"); }
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id, tenant.id]);

  const toNum = (v: any) => {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v || '0').replace(',', '.').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const normI18n = (obj: any, def = ""): I18n => {
    if (typeof obj === 'string') return { es: obj, ca: obj };
    return {
      es: obj?.es || obj?.ca || def,
      ca: obj?.ca || obj?.es || def
    };
  };

  const ensureArray = (val: any) => Array.isArray(val) ? val : (val ? [val] : []);

  const handleAiExtract = async (file: File) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('extract_products_from_file', {
        body: formData
      });

      if (error) throw error;
      
      const rawData = data;
      const normalized = rawData?.data?.products?.[0] ?? rawData?.products?.[0] ?? rawData?.product ?? rawData;
      console.log("AI normalized ->", normalized);

      // Normalización i18n y numérica para cada bloque
      const cleanPricing = ensureArray(normalized.pricing).map((p: any) => ({
        name: normI18n(p.name || p.variant, "Modelo Base"),
        price: toNum(p.price || normalized.price),
        cost: toNum(p.cost)
      }));

      const cleanKits = ensureArray(normalized.installationKits || normalized.installation_kits).map((k: any) => ({
        name: normI18n(k.name, "Instalación Básica"),
        price: toNum(k.price)
      }));

      const cleanExtras = ensureArray(normalized.extras).map((e: any) => ({
        name: normI18n(e.name, "Accesorio"),
        price: toNum(e.price)
      }));

      const cleanFinancing = ensureArray(normalized.financing).map((f: any) => ({
        label: normI18n(f.label, "12 Meses"),
        months: toNum(f.months) || 12,
        commission: toNum(f.commission),
        coefficient: toNum(f.coefficient)
      }));

      setProductData((prev: any) => ({
        ...prev,
        brand: normalized.brand || prev.brand,
        model: normalized.model || prev.model,
        type: normalized.type || prev.type,
        pricing: cleanPricing.length > 0 ? cleanPricing : [{ name: { es: "Precio Base", ca: "Preu Base" }, price: toNum(normalized.price || 0), cost: 0 }],
        installation_kits: cleanKits.length > 0 ? cleanKits : [{ name: { es: "Instalación Básica", ca: "Instal·lació Bàsica" }, price: 0 }],
        extras: cleanExtras.length > 0 ? cleanExtras : [{ name: { es: "Soportes", ca: "Suports" }, price: 0 }],
        stock: toNum(normalized.stock || prev.stock)
      }));

      if (normalized.technical) {
        const specs = Object.entries(normalized.technical)
          .filter(([_, v]) => !!v)
          .map(([k, v]) => ({ title: k, description: String(v) }));
        setTechSpecs(specs);
      }

      setFinancing(cleanFinancing.length > 0 ? cleanFinancing : [{ label: { es: "12 Meses", ca: "12 Mesos" }, months: 12, commission: 0, coefficient: 0.087 }]);
      alert("✨ Extracción completada. Los datos se han distribuido en todas las pestañas.");
    } catch (err: any) {
      alert("Error en extracción: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!productData.brand || !productData.model) {
      alert("Marca y Modelo son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        brand: productData.brand,
        model: productData.model,
        type: productData.type || 'aire_acondicionado',
        status: productData.status || 'draft',
        pricing: productData.pricing || [],
        installation_kits: productData.installation_kits || [],
        extras: productData.extras || [],
        stock: productData.stock || 0,
        features: JSON.stringify({ techSpecs, financing }),
        is_deleted: false
      };

      const { error } = id === 'new' 
        ? await supabase.from('products').insert([payload])
        : await supabase.from('products').update(payload).eq('id', id);

      if (error) throw error;
      navigate(`/t/${slug}/products`);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateI18nList = (key: string, index: number, field: string, lang: 'es' | 'ca', val: string) => {
    setProductData((prev: any) => {
      const list = [...(prev[key] || [])];
      const item = { ...list[index] };
      item[field] = { ...item[field], [lang]: val };
      list[index] = item;
      return { ...prev, [key]: list };
    });
  };

  const updateSimpleList = (key: string, index: number, field: string, val: any) => {
    setProductData((prev: any) => {
      const list = [...(prev[key] || [])];
      list[index] = { ...list[index], [field]: val };
      return { ...prev, [key]: list };
    });
  };

  const updateFinancingI18n = (index: number, field: 'label', lang: 'es' | 'ca', val: string) => {
    const next = [...financing];
    next[index] = { ...next[index], [field]: { ...next[index][field], [lang]: val } };
    setFinancing(next);
  };

  const updateFinancingSimple = (index: number, field: keyof FinancingRow, val: any) => {
    const next = [...financing];
    next[index] = { ...next[index], [field]: val };
    setFinancing(next);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-20">
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 md:px-12 py-5 z-[60] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex flex-col text-left">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">Editor de Producto</h1>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
          {saving ? 'GUARDANDO...' : 'GUARDAR PRODUCTO'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex border-b border-slate-100 mb-10 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {['general', 'technical', 'kits', 'extras_tab', 'financing', 'pricing', 'stock', 'multimedia'].map(tid => (
            <button key={tid} onClick={() => setActiveTab(tid as TabId)} className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tid ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {tid.replace('_tab', '').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="bg-white p-8 md:p-14 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px]">
          {activeTab === 'general' && (
            <div className="space-y-10 max-w-3xl text-left">
              <div className="flex justify-between items-start">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Información Principal</h3>
                 <label className={`flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-blue-100 transition-all ${aiLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files && handleAiExtract(e.target.files[0])} />
                    {aiLoading ? 'EXTRAYENDO...' : '✨ EXTRAER CON IA'}
                 </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Input label="Marca" value={productData.brand || ''} onChange={(e:any) => setProductData({...productData, brand: e.target.value})} />
                <Input label="Modelo" value={productData.model || ''} onChange={(e:any) => setProductData({...productData, model: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Tipo de Producto</label>
                  <select value={productData.type} onChange={(e) => setProductData({...productData, type: e.target.value})} className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                    {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Estado</label>
                  <select value={productData.status} onChange={(e:any) => setProductData({...productData, status: e.target.value})} className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase tracking-tight italic">Variantes de Precio</h3>
              {productData.pricing?.map((p: any, i: number) => (
                <div key={i} className="flex flex-col gap-6 bg-slate-50 p-8 rounded-3xl border border-slate-100 relative group">
                  <button onClick={() => setProductData((prev:any) => ({...prev, pricing: prev.pricing.filter((_:any,idx:number)=>idx!==i)}))} className="absolute top-4 right-4 text-red-300 hover:text-red-500 font-bold">ELIMINAR ×</button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Nombre Variante (ES)" value={p.name?.es || ''} onChange={(e:any) => updateI18nList('pricing', i, 'name', 'es', e.target.value)} />
                    <Input label="Nom Variant (CA)" value={p.name?.ca || ''} onChange={(e:any) => updateI18nList('pricing', i, 'name', 'ca', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="PVP (€)" type="number" value={p.price} onChange={(e:any) => updateSimpleList('pricing', i, 'price', toNum(e.target.value))} />
                    <Input label="Costo (€)" type="number" value={p.cost} onChange={(e:any) => updateSimpleList('pricing', i, 'cost', toNum(e.target.value))} />
                  </div>
                </div>
              ))}
              <button onClick={() => setProductData((p:any)=>({...p, pricing: [...(p.pricing||[]), { name: {es:'',ca:''}, price: 0, cost: 0 }]}))} className="w-full py-5 border-2 border-dashed border-slate-100 rounded-3xl text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all">+ Añadir Variante de Precio</button>
            </div>
          )}

          {activeTab === 'kits' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase tracking-tight italic">Kits de Instalación</h3>
              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                    <tr><th className="px-8 py-5 text-left">Nombre (ES)</th><th className="px-8 py-5 text-left">Nom (CA)</th><th className="px-8 py-5 text-right">Precio (€)</th><th className="w-16"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {productData.installation_kits?.map((k: any, i: number) => (
                      <tr key={i}>
                        <td className="px-8 py-5"><input className="w-full bg-transparent font-bold outline-none" value={k.name?.es || ''} onChange={(e)=>updateI18nList('installation_kits', i, 'name', 'es', e.target.value)} /></td>
                        <td className="px-8 py-5"><input className="w-full bg-transparent font-bold outline-none italic text-slate-500" value={k.name?.ca || ''} onChange={(e)=>updateI18nList('installation_kits', i, 'name', 'ca', e.target.value)} /></td>
                        <td className="px-8 py-5 text-right"><input type="number" className="w-24 bg-transparent text-right font-black text-blue-600 outline-none" value={k.price} onChange={(e)=>updateSimpleList('installation_kits', i, 'price', toNum(e.target.value))} /></td>
                        <td className="px-4 py-5 text-center"><button onClick={()=>setProductData((p:any)=>({...p, installation_kits: p.installation_kits.filter((_:any,idx:number)=>idx!==i)}))} className="text-red-300 hover:text-red-500">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setProductData((p:any)=>({...p, installation_kits: [...(p.installation_kits||[]), { name: {es:'',ca:''}, price: 0 }]}))} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">+ Añadir Kit</button>
            </div>
          )}

          {activeTab === 'extras_tab' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase tracking-tight italic">Extras y Materiales</h3>
              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                    <tr><th className="px-8 py-5 text-left">Nombre (ES)</th><th className="px-8 py-5 text-left">Nom (CA)</th><th className="px-8 py-5 text-right">Precio (€)</th><th className="w-16"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {productData.extras?.map((e: any, i: number) => (
                      <tr key={i}>
                        <td className="px-8 py-5"><input className="w-full bg-transparent font-bold outline-none" value={e.name?.es || ''} onChange={(v)=>updateI18nList('extras', i, 'name', 'es', v.target.value)} /></td>
                        <td className="px-8 py-5"><input className="w-full bg-transparent font-bold outline-none italic text-slate-500" value={e.name?.ca || ''} onChange={(v)=>updateI18nList('extras', i, 'name', 'ca', v.target.value)} /></td>
                        <td className="px-8 py-5 text-right"><input type="number" className="w-24 bg-transparent text-right font-black text-blue-600 outline-none" value={e.price} onChange={(v)=>updateSimpleList('extras', i, 'price', toNum(v.target.value))} /></td>
                        <td className="px-4 py-5 text-center"><button onClick={()=>setProductData((p:any)=>({...p, extras: p.extras.filter((_:any,idx:number)=>idx!==i)}))} className="text-red-300 hover:text-red-500">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setProductData((p:any)=>({...p, extras: [...(p.extras||[]), { name: {es:'',ca:''}, price: 0 }]}))} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">+ Añadir Extra</button>
            </div>
          )}

          {activeTab === 'financing' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase tracking-tight italic">Planes de Financiación</h3>
              {financing.map((f: any, i: number) => (
                <div key={i} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 relative group flex flex-col gap-6">
                  <button onClick={() => setFinancing(financing.filter((_,idx)=>idx!==i))} className="absolute top-4 right-4 text-red-400 font-black text-[10px]">ELIMINAR ×</button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Etiqueta (ES)" value={f.label?.es || ''} onChange={(e:any) => updateFinancingI18n(i, 'label', 'es', e.target.value)} />
                    <Input label="Etiqueta (CA)" value={f.label?.ca || ''} onChange={(e:any) => updateFinancingI18n(i, 'label', 'ca', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input label="Meses" type="number" value={f.months} onChange={(e:any) => updateFinancingSimple(i, 'months', parseInt(e.target.value))} />
                    <Input label="Comisión (%)" type="number" value={f.commission} onChange={(e:any) => updateFinancingSimple(i, 'commission', toNum(e.target.value))} />
                    <Input label="Coeficiente" type="number" step="0.000001" value={f.coefficient} onChange={(e:any) => updateFinancingSimple(i, 'coefficient', toNum(e.target.value))} />
                  </div>
                </div>
              ))}
              <button onClick={() => setFinancing([...financing, { label: {es:'12 meses',ca:'12 mesos'}, months: 12, commission: 0, coefficient: 0 }])} className="w-full py-5 border-2 border-dashed border-slate-100 rounded-3xl text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all">+ Añadir Tramo de Financiación</button>
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="animate-in fade-in space-y-8 text-left">
              <h3 className="text-xl font-black tracking-tight italic uppercase">Datos Técnicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {techSpecs.map((spec, index) => (
                  <div key={index} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-2 relative group">
                    <button onClick={() => setTechSpecs(techSpecs.filter((_, i) => i !== index))} className="absolute top-4 right-4 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-bold">×</button>
                    <Input label="Característica" value={spec.title} onChange={(e:any) => {
                      const next = [...techSpecs];
                      next[index].title = e.target.value;
                      setTechSpecs(next);
                    }} />
                    <Input label="Valor" value={spec.description} onChange={(e:any) => {
                      const next = [...techSpecs];
                      next[index].description = e.target.value;
                      setTechSpecs(next);
                    }} />
                  </div>
                ))}
                <button onClick={() => setTechSpecs([...techSpecs, { title: '', description: '' }])} className="p-10 border-2 border-dashed border-slate-100 rounded-3xl text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all">+ Añadir Fila Técnica</button>
              </div>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="animate-in fade-in max-w-sm text-left">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic mb-8">Control de Stock</h3>
              <Input label="Unidades en Inventario" type="number" value={productData.stock || 0} onChange={(e:any) => setProductData({...productData, stock: parseInt(e.target.value) || 0})} />
            </div>
          )}

          {activeTab === 'multimedia' && (
            <div className="animate-in fade-in space-y-12 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 mb-4 tracking-widest">Imagen de Producto</h4>
                  <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center overflow-hidden relative group">
                    {previews.product ? <img src={previews.product} className="w-full h-full object-contain p-4" /> : <span className="text-slate-300 font-black text-[10px] uppercase">Arrastra o sube imagen</span>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f) { setPreviews(p => ({...p, product: URL.createObjectURL(f)})); }
                    }} />
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 mb-4 tracking-widest">Logo de la Marca</h4>
                  <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center overflow-hidden relative group">
                    {previews.logo ? <img src={previews.logo} className="w-full h-full object-contain p-8" /> : <span className="text-slate-300 font-black text-[10px] uppercase">Sube logo marca</span>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f) { setPreviews(p => ({...p, logo: URL.createObjectURL(f)})); }
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
