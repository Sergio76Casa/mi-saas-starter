
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

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
  label: { es: string; ca: string };
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

  const handleAiExtract = async (file: File) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('extract_products_from_file', {
        body: formData
      });

      if (error) throw error;
      
      const normalized = data;
      console.log("AI normalized ->", normalized);

      // Mapeo inteligente al estado de la UI
      setProductData((prev: any) => ({
        ...prev,
        brand: normalized.brand || prev.brand,
        model: normalized.model || prev.model,
        type: normalized.type || prev.type,
        pricing: normalized.pricing,
        installation_kits: normalized.installationKits || normalized.installation_kits,
        extras: normalized.extras,
        stock: normalized.stock || prev.stock
      }));

      if (normalized.technical) {
        const specs = Object.entries(normalized.technical)
          .filter(([_, v]) => !!v)
          .map(([k, v]) => ({ title: k, description: v as string }));
        setTechSpecs(specs);
      }

      setFinancing(normalized.financing);
      alert("✨ Datos sincronizados en todas las pestañas.");
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

  // Ayudante para actualizar campos i18n
  const updateI18nList = (key: string, index: number, field: string, lang: string, val: any) => {
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
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-[11px] uppercase shadow-xl">
          {saving ? 'GUARDANDO...' : 'GUARDAR PRODUCTO'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex border-b border-slate-100 mb-10 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {['general', 'technical', 'kits', 'extras_tab', 'financing', 'pricing', 'stock'].map(tid => (
            <button key={tid} onClick={() => setActiveTab(tid as TabId)} className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tid ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
              {tid.replace('_tab', '').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="bg-white p-8 md:p-14 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px]">
          {activeTab === 'general' && (
            <div className="space-y-10 max-w-3xl text-left">
              <div className="flex justify-between items-start">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Info Principal</h3>
                 <label className={`flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-blue-100 transition-all ${aiLoading ? 'opacity-50' : ''}`}>
                    <input type="file" className="hidden" onChange={(e) => e.target.files && handleAiExtract(e.target.files[0])} />
                    {aiLoading ? 'EXTRAYENDO...' : '✨ EXTRAER CON IA'}
                 </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Input label="Marca" value={productData.brand || ''} onChange={(e:any) => setProductData({...productData, brand: e.target.value})} />
                <Input label="Modelo" value={productData.model || ''} onChange={(e:any) => setProductData({...productData, model: e.target.value})} />
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase italic">Variantes de Precio</h3>
              {productData.pricing?.map((p: any, i: number) => (
                <div key={i} className="flex gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="flex-1"><Input label={`Nombre (${language})`} value={p.name?.[language] || ''} onChange={(e:any) => updateI18nList('pricing', i, 'name', language, e.target.value)} /></div>
                  <div className="w-32"><Input label="PVP (€)" type="number" value={p.price} onChange={(e:any) => updateSimpleList('pricing', i, 'price', parseFloat(e.target.value))} /></div>
                  <button onClick={() => setProductData((prev:any) => ({...prev, pricing: prev.pricing.filter((_:any,idx:number)=>idx!==i)}))} className="mb-4 p-2 text-red-400">×</button>
                </div>
              ))}
              <button onClick={() => setProductData((p:any)=>({...p, pricing: [...(p.pricing||[]), { name: {es:'',ca:''}, price: 0 }]}))} className="text-[10px] font-black uppercase text-blue-600">+ Añadir Variante</button>
            </div>
          )}

          {activeTab === 'kits' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase italic">Kits de Instalación</h3>
              <table className="w-full">
                <thead className="text-[10px] font-black uppercase text-slate-400"><tr><th className="text-left py-4">Nombre</th><th className="text-right">Precio (€)</th><th className="w-10"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {productData.installation_kits?.map((k: any, i: number) => (
                    <tr key={i}>
                      <td className="py-4"><input className="w-full bg-transparent font-bold outline-none" value={k.name?.[language] || ''} onChange={(e)=>updateI18nList('installation_kits', i, 'name', language, e.target.value)} /></td>
                      <td className="text-right"><input type="number" className="w-20 bg-transparent text-right font-black text-blue-600 outline-none" value={k.price} onChange={(e)=>updateSimpleList('installation_kits', i, 'price', parseFloat(e.target.value))} /></td>
                      <td className="text-center"><button onClick={()=>setProductData((p:any)=>({...p, installation_kits: p.installation_kits.filter((_:any,idx:number)=>idx!==i)}))} className="text-red-300">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setProductData((p:any)=>({...p, installation_kits: [...(p.installation_kits||[]), { name: {es:'',ca:''}, price: 0 }]}))} className="text-[10px] font-black uppercase text-blue-600">+ Añadir Kit</button>
            </div>
          )}

          {activeTab === 'extras_tab' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase italic">Extras</h3>
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  {productData.extras?.map((e: any, i: number) => (
                    <tr key={i}>
                      <td className="py-4"><input className="w-full bg-transparent font-bold outline-none" value={e.name?.[language] || ''} onChange={(val)=>updateI18nList('extras', i, 'name', language, val.target.value)} /></td>
                      <td className="text-right"><input type="number" className="w-20 bg-transparent text-right font-black text-blue-600 outline-none" value={e.price} onChange={(val)=>updateSimpleList('extras', i, 'price', parseFloat(val.target.value))} /></td>
                      <td className="text-center"><button onClick={()=>setProductData((p:any)=>({...p, extras: p.extras.filter((_:any,idx:number)=>idx!==i)}))} className="text-red-300">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setProductData((p:any)=>({...p, extras: [...(p.extras||[]), { name: {es:'',ca:''}, price: 0 }]}))} className="text-[10px] font-black uppercase text-blue-600">+ Añadir Extra</button>
            </div>
          )}

          {activeTab === 'financing' && (
            <div className="space-y-8 text-left">
              <h3 className="text-xl font-black uppercase italic">Financiación</h3>
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                {financing.map((f: any, i: number) => (
                  <div key={i} className="grid grid-cols-4 gap-4 mb-4 items-end">
                    <Input label="Etiqueta" value={f.label?.[language] || ''} onChange={(e:any) => {
                      const copy = [...financing];
                      copy[i].label = { ...copy[i].label, [language]: e.target.value };
                      setFinancing(copy);
                    }} />
                    <Input label="Meses" type="number" value={f.months} onChange={(e:any) => {
                      const copy = [...financing];
                      copy[i].months = parseInt(e.target.value);
                      setFinancing(copy);
                    }} />
                    <Input label="Coeficiente" type="number" step="0.0001" value={f.coefficient} onChange={(e:any) => {
                      const copy = [...financing];
                      copy[i].coefficient = parseFloat(e.target.value);
                      setFinancing(copy);
                    }} />
                    <button onClick={() => setFinancing(financing.filter((_,idx)=>idx!==i))} className="mb-4 text-red-400 font-black">ELIMINAR</button>
                  </div>
                ))}
                <button onClick={() => setFinancing([...financing, { label: {es:'12 meses',ca:'12 mesos'}, months: 12, commission: 0, coefficient: 0 }])} className="text-[10px] font-black uppercase text-blue-600">+ Añadir Tramo</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
