
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
  label: string;
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
  
  // Storage Previews
  const [previews, setPreviews] = useState({ product: '', logo: '' });
  const [productFile, setProductFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Main States
  const [productData, setProductData] = useState<Partial<Product>>({
    brand: '',
    model: '',
    type: 'aire_acondicionado',
    status: 'draft',
    pricing: [{ variant: '', price: 0 }],
    installation_kits: [],
    extras: [],
    stock: 0,
    features: '',
    pdf_url: '',
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
        } catch (e) {
          console.error("Error parsing technical features");
        }
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
      
      if (data) {
        // Translation Helper
        const getT = (obj: any) => obj?.[language] || obj?.es || "";

        // 1. UPDATE GENERAL & PRICING
        setProductData(prev => ({
          ...prev,
          brand: data.brand || prev.brand,
          model: data.model || prev.model,
          type: data.type || prev.type,
          pricing: data.pricing_variants ? data.pricing_variants.map((v: any) => ({
            variant: getT(v.name),
            price: v.price
          })) : prev.pricing,
          installation_kits: data.installation_kits ? data.installation_kits.map((k: any) => ({
            name: getT(k.name),
            price: k.price
          })) : prev.installation_kits,
          extras: data.extras ? data.extras.map((e: any) => ({
            name: getT(e.name),
            price: e.price
          })) : prev.extras
        }));

        // 2. UPDATE TECHNICAL DATA
        if (data.technical_specs) {
          const newSpecs = data.technical_specs.map((s: any) => ({
            title: getT(s.label),
            description: s.value
          }));
          setTechSpecs(newSpecs);
        }

        // 3. UPDATE FINANCING
        if (data.financing_table) {
          const newFinancing = data.financing_table.map((f: any) => ({
            label: getT(f.label),
            months: f.months,
            commission: f.commission || 0,
            coefficient: f.coefficient || 0
          }));
          setFinancing(newFinancing);
        }

        // Feedback: Saltamos a la pestaña de datos técnicos para que el usuario vea el resultado
        setActiveTab('technical');
      }
    } catch (err: any) {
      alert("Error al extraer datos con IA: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!productData.brand || !productData.model) {
      alert("Marca y Modelo son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...productData,
        features: JSON.stringify({ techSpecs, financing }),
        tenant_id: tenant.id,
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

  const updateRow = (listKey: 'pricing' | 'installation_kits' | 'extras', index: number, field: string, value: any) => {
    setProductData(prev => {
      const newList = [...(prev[listKey] || [])];
      newList[index] = { ...newList[index], [field]: value };
      return { ...prev, [listKey]: newList };
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">ID: {id === 'new' ? 'NUEVO' : id?.slice(0,8)}</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
          {saving ? 'GUARDANDO...' : 'GUARDAR PRODUCTO'}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex border-b border-slate-100 mb-10 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {[
            { id: 'general', label: 'General' },
            { id: 'technical', label: 'Datos Técnicos' },
            { id: 'kits', label: 'Kits' },
            { id: 'extras_tab', label: 'Extras' },
            { id: 'financing', label: 'Financiación' },
            { id: 'pricing', label: 'Precios' },
            { id: 'stock', label: 'Stock' },
            { id: 'multimedia', label: 'Multimedia' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white p-8 md:p-14 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[600px]">
          {activeTab === 'general' && (
            <div className="animate-in fade-in space-y-10 max-w-3xl text-left">
              <div className="flex justify-between items-start">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Información Principal</h3>
                 <div className="flex items-center gap-3">
                    <input type="file" id="ai-extract" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files && handleAiExtract(e.target.files[0])} />
                    <label htmlFor="ai-extract" className={`flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-brand-100 transition-colors ${aiLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                       {aiLoading ? 'Leyendo documento...' : '✨ Autocompletar con IA'}
                    </label>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Input label="Marca" value={productData.brand} onChange={(e:any) => setProductData({...productData, brand: e.target.value})} />
                <Input label="Modelo" value={productData.model} onChange={(e:any) => setProductData({...productData, model: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Tipo de Producto</label>
                  <select value={productData.type} onChange={(e) => setProductData({...productData, type: e.target.value})} className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50/50 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Estado</label>
                  <select value={productData.status} onChange={(e:any) => setProductData({...productData, status: e.target.value})} className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50/50 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="animate-in fade-in space-y-8 text-left">
              <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Datos Técnicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {techSpecs.map((spec, index) => (
                  <div key={index} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-2 group relative">
                    <button onClick={() => setTechSpecs(techSpecs.filter((_, i) => i !== index))} className="absolute top-4 right-4 text-red-300 hover:text-red-500 transition-colors">×</button>
                    <Input label="Concepto / Etiqueta" value={spec.title} onChange={(e:any) => {
                      const copy = [...techSpecs];
                      copy[index].title = e.target.value;
                      setTechSpecs(copy);
                    }} />
                    <Input label="Valor" value={spec.description} onChange={(e:any) => {
                      const copy = [...techSpecs];
                      copy[index].description = e.target.value;
                      setTechSpecs(copy);
                    }} />
                  </div>
                ))}
                <button onClick={() => setTechSpecs([...techSpecs, { title: '', description: '' }])} className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all">+ Añadir Fila</button>
              </div>
            </div>
          )}

          {activeTab === 'kits' && (
            <div className="animate-in fade-in space-y-8 text-left">
              <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Kits de Instalación</h3>
              <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                    <tr><th className="px-8 py-4 text-left">Nombre</th><th className="px-8 py-4 text-right">Precio (€)</th><th className="w-16"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {productData.installation_kits?.map((kit, i) => (
                      <tr key={i}>
                        <td className="px-8 py-4"><input className="w-full bg-transparent font-bold outline-none" value={kit.name} onChange={(e) => updateRow('installation_kits', i, 'name', e.target.value)} /></td>
                        <td className="px-8 py-4 text-right"><input type="number" className="w-24 bg-transparent text-right font-black text-blue-600" value={kit.price} onChange={(e) => updateRow('installation_kits', i, 'price', parseFloat(e.target.value))} /></td>
                        <td className="px-4 py-4 text-center"><button onClick={() => setProductData(prev => ({...prev, installation_kits: prev.installation_kits?.filter((_,idx) => idx !== i)}))} className="text-red-300 hover:text-red-500">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setProductData(prev => ({...prev, installation_kits: [...(prev.installation_kits || []), { name: '', price: 0 }]}))} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">+ Añadir Kit</button>
            </div>
          )}

          {activeTab === 'extras_tab' && (
            <div className="animate-in fade-in space-y-8 text-left">
              <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Extras y Materiales</h3>
              <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                    <tr><th className="px-8 py-4 text-left">Concepto</th><th className="px-8 py-4 text-right">Precio (€)</th><th className="w-16"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {productData.extras?.map((ex, i) => (
                      <tr key={i}>
                        <td className="px-8 py-4"><input className="w-full bg-transparent font-bold outline-none" value={ex.name} onChange={(e) => updateRow('extras', i, 'name', e.target.value)} /></td>
                        <td className="px-8 py-4 text-right"><input type="number" className="w-24 bg-transparent text-right font-black text-blue-600" value={ex.price} onChange={(e) => updateRow('extras', i, 'price', parseFloat(e.target.value))} /></td>
                        <td className="px-4 py-4 text-center"><button onClick={() => setProductData(prev => ({...prev, extras: prev.extras?.filter((_,idx) => idx !== i)}))} className="text-red-300 hover:text-red-500">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setProductData(prev => ({...prev, extras: [...(prev.extras || []), { name: '', price: 0 }]}))} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">+ Añadir Extra</button>
            </div>
          )}

          {activeTab === 'financing' && (
            <div className="animate-in fade-in space-y-8 text-left">
              <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Financiación</h3>
              <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                    <tr><th className="px-8 py-4 text-left">Etiqueta</th><th className="px-8 py-4 text-center">Meses</th><th className="px-8 py-4 text-right">Coeficiente</th><th className="w-16"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {financing.map((f, i) => (
                      <tr key={i}>
                        <td className="px-8 py-4"><input className="w-full bg-transparent font-bold outline-none" value={f.label} onChange={(e) => {
                          const copy = [...financing];
                          copy[i].label = e.target.value;
                          setFinancing(copy);
                        }} /></td>
                        <td className="px-8 py-4 text-center"><input type="number" className="w-16 bg-transparent text-center outline-none" value={f.months} onChange={(e) => {
                          const copy = [...financing];
                          copy[i].months = parseInt(e.target.value);
                          setFinancing(copy);
                        }} /></td>
                        <td className="px-8 py-4 text-right"><input type="number" step="0.000001" className="w-32 bg-transparent text-right font-black text-blue-600" value={f.coefficient} onChange={(e) => {
                          const copy = [...financing];
                          copy[i].coefficient = parseFloat(e.target.value);
                          setFinancing(copy);
                        }} /></td>
                        <td className="px-4 py-4 text-center"><button onClick={() => setFinancing(financing.filter((_,idx) => idx !== i))} className="text-red-300 hover:text-red-500">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setFinancing([...financing, { label: '', months: 12, commission: 0, coefficient: 0 }])} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">+ Añadir Tramo</button>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="animate-in fade-in space-y-8 text-left">
              <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Precios y Variantes</h3>
              <div className="grid grid-cols-1 gap-4">
                {productData.pricing?.map((p, i) => (
                  <div key={i} className="flex gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex-1"><Input label="Nombre de Variante" value={p.variant} onChange={(e:any) => updateRow('pricing', i, 'variant', e.target.value)} /></div>
                    <div className="w-48"><Input label="PVP (€)" type="number" value={p.price} onChange={(e:any) => updateRow('pricing', i, 'price', parseFloat(e.target.value))} /></div>
                    <button onClick={() => setProductData(prev => ({...prev, pricing: prev.pricing?.filter((_,idx) => idx !== i)}))} className="mb-4 p-2 text-red-400 hover:bg-red-50 rounded-lg">×</button>
                  </div>
                ))}
                <button onClick={() => setProductData(prev => ({...prev, pricing: [...(prev.pricing || []), { variant: '', price: 0 }]}))} className="py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all">+ Añadir Variante</button>
              </div>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="animate-in fade-in max-w-sm text-left">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic mb-8">Stock</h3>
              <Input label="Unidades en Inventario" type="number" value={productData.stock || 0} onChange={(e:any) => setProductData({...productData, stock: parseInt(e.target.value)})} />
            </div>
          )}

          {activeTab === 'multimedia' && (
            <div className="animate-in fade-in space-y-12 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 mb-4">Imagen del Producto</h4>
                  <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center overflow-hidden relative group">
                    {previews.product ? <img src={previews.product} className="w-full h-full object-contain p-4" /> : <span className="text-slate-300 font-black text-[10px] uppercase">Sin Imagen</span>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f) { setProductFile(f); setPreviews(p => ({...p, product: URL.createObjectURL(f)})); }
                    }} />
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 mb-4">Logo Marca</h4>
                  <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center overflow-hidden relative group">
                    {previews.logo ? <img src={previews.logo} className="w-full h-full object-contain p-8" /> : <span className="text-slate-300 font-black text-[10px] uppercase">Sin Logo</span>}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f) { setLogoFile(f); setPreviews(p => ({...p, logo: URL.createObjectURL(f)})); }
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
