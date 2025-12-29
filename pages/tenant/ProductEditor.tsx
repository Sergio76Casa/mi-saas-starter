
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const TYPES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Caldera' },
  { id: 'termo_electrico', label: 'Termo Eléctrico' }
];

const STATUSES = [
  { id: 'draft', label: 'Borrador' },
  { id: 'active', label: 'Activo' },
  { id: 'inactive', label: 'Inactivo' }
];

type TabId = 'general' | 'technical' | 'pricing' | 'stock' | 'multimedia';

interface TechSpec {
  title: string;
  description: string;
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
  
  // File states for local preview and upload
  const [productFile, setProductFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState({ product: '', logo: '' });

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

  // State for structured technical specifications
  const [techSpecs, setTechSpecs] = useState<TechSpec[]>([]);

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
            if (Array.isArray(parsed)) {
              setTechSpecs(parsed);
            } else {
              setTechSpecs([{ title: 'Descripción General', description: data.features }]);
            }
          }
        } catch (e) {
          if (data.features) {
            setTechSpecs([{ title: 'Descripción General', description: data.features }]);
          }
        }
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'logo' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'product') {
      setProductFile(file);
      setPreviews(prev => ({ ...prev, product: URL.createObjectURL(file) }));
    } else if (type === 'logo') {
      setLogoFile(file);
      setPreviews(prev => ({ ...prev, logo: URL.createObjectURL(file) }));
    } else {
      setPdfFile(file);
    }
  };

  const uploadToStorage = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const path = `${tenant.id}/${folder}/${fileName}`;
    
    const { error } = await supabase.storage.from('products').upload(path, file);
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
    return publicUrl;
  };

  const handleAiExtract = async (file: File) => {
    if (productData.brand || productData.model) {
      if (!window.confirm("La IA rellenará los campos automáticamente. ¿Deseas sobreescribir los datos actuales?")) return;
    }
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('defaultCategory', productData.type || 'aire_acondicionado');

      const { data, error } = await supabase.functions.invoke('extract_products_from_file', {
        body: formData
      });

      if (error) throw error;
      
      if (data) {
        // Multi-language helper
        const getT = (obj: any) => obj?.[language] || obj?.es || "";

        // Map type
        const typeMap: Record<string, string> = {
          "Aire Acondicionado": "aire_acondicionado",
          "Caldera": "caldera",
          "Termo Eléctrico": "termo_electrico",
          "Aerotermia": "aire_acondicionado"
        };

        // Update product basic data
        setProductData(prev => ({
          ...prev,
          brand: data.brand || prev.brand,
          model: data.model || prev.model,
          type: typeMap[data.type] || prev.type,
          pricing: data.pricing ? data.pricing.map((v: any) => ({
            variant: getT(v.name),
            price: v.price
          })) : prev.pricing,
          installation_kits: data.installationKits ? data.installationKits.map((k: any) => ({
            name: getT(k.name),
            price: k.price
          })) : prev.installation_kits,
          extras: data.extras ? data.extras.map((e: any) => ({
            name: getT(e.name),
            price: e.price
          })) : prev.extras
        }));
        
        // Generate tech specs from technical object and features array
        const combinedSpecs: TechSpec[] = [];
        
        // From technical key-value
        if (data.technical) {
          const techLabels: Record<string, string> = {
            powerCooling: "Potencia Frío",
            powerHeating: "Potencia Calor",
            efficiency: "Eficiencia",
            gasType: "Refrigerante",
            voltage: "Voltaje",
            warranty: "Garantía"
          };

          Object.entries(data.technical).forEach(([key, val]) => {
            if (val) {
              combinedSpecs.push({
                title: techLabels[key] || key,
                description: val as string
              });
            }
          });
        }

        // From features array
        if (data.features && Array.isArray(data.features)) {
          data.features.forEach((f: any) => {
            combinedSpecs.push({
              title: getT(f.title),
              description: getT(f.description)
            });
          });
        }

        setTechSpecs(combinedSpecs);
        setActiveTab('technical');
      }
    } catch (err: any) {
      console.error("Error IA:", err.message);
      alert("Hubo un problema al procesar con IA.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!productData.brand || !productData.model) {
      alert("Marca y Modelo son obligatorios para poder guardar.");
      setActiveTab('general');
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = productData.image_url;
      let finalLogoUrl = productData.brand_logo_url;
      let finalPdfUrl = productData.pdf_url;

      if (productFile) finalImageUrl = await uploadToStorage(productFile, 'images');
      if (logoFile) finalLogoUrl = await uploadToStorage(logoFile, 'logos');
      if (pdfFile) finalPdfUrl = await uploadToStorage(pdfFile, 'docs');

      const payload = {
        ...productData,
        features: JSON.stringify(techSpecs),
        image_url: finalImageUrl,
        brand_logo_url: finalLogoUrl,
        pdf_url: finalPdfUrl,
        tenant_id: tenant.id,
        is_deleted: false
      };

      const { error } = id === 'new' 
        ? await supabase.from('products').insert([payload])
        : await supabase.from('products').update(payload).eq('id', id);

      if (error) throw error;
      navigate(`/t/${slug}/products`);
    } catch (err: any) {
      alert("Atención: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addRow = (listKey: 'pricing' | 'installation_kits' | 'extras') => {
    setProductData(prev => ({
      ...prev,
      [listKey]: [...(prev[listKey] || []), { name: '', variant: '', price: 0 }]
    }));
  };

  const removeRow = (listKey: 'pricing' | 'installation_kits' | 'extras', index: number) => {
    setProductData(prev => {
      const newList = [...(prev[listKey] || [])];
      newList.splice(index, 1);
      return { ...prev, [listKey]: newList };
    });
  };

  const updateRow = (listKey: 'pricing' | 'installation_kits' | 'extras', index: number, field: string, value: any) => {
    setProductData(prev => {
      const newList = [...(prev[listKey] || [])];
      newList[index] = { ...newList[index], [field]: value };
      return { ...prev, [listKey]: newList };
    });
  };

  const addTechSpec = () => {
    setTechSpecs([...techSpecs, { title: '', description: '' }]);
  };

  const updateTechSpec = (index: number, field: keyof TechSpec, value: string) => {
    const updated = [...techSpecs];
    updated[index] = { ...updated[index], [field]: value };
    setTechSpecs(updated);
  };

  const removeTechSpec = (index: number) => {
    setTechSpecs(techSpecs.filter((_, i) => i !== index));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[#fcfcfc] animate-in fade-in duration-500 pb-20">
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 md:px-12 py-5 z-[60] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex flex-col text-left">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">Editor de Producto</h1>
            <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest mt-1.5">{id === 'new' ? 'NUEVO REGISTRO' : `UUID: ${id?.slice(0, 8)}`}</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
          {saving ? 'PROCESANDO...' : 'GUARDAR CAMBIOS'}
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex border-b border-slate-100 mb-10 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {(['general', 'technical', 'pricing', 'stock', 'multimedia'] as TabId[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab === 'general' ? 'General' : tab === 'technical' ? 'Datos Técnicos' : tab === 'pricing' ? 'Precios' : tab === 'stock' ? 'Stock' : 'Multimedia'}
            </button>
          ))}
        </div>

        <div className="bg-white p-8 md:p-14 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px]">
          {activeTab === 'general' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-10 max-w-3xl text-left">
              <div className="flex justify-between items-start">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Información Principal</h3>
                 <div className="flex items-center gap-3">
                    <input type="file" id="ai-extract" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files && handleAiExtract(e.target.files[0])} />
                    <label htmlFor="ai-extract" className={`flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-brand-100 transition-colors ${aiLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                       {aiLoading ? 'Analizando...' : '✨ Importar con IA'}
                    </label>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Input label="Marca *" placeholder="Ej: Mitsubishi" value={productData.brand} onChange={(e:any) => setProductData({...productData, brand: e.target.value})} />
                <Input label="Modelo *" placeholder="Ej: MSZ-HR35VF" value={productData.model} onChange={(e:any) => setProductData({...productData, model: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Tipo / Categoría</label>
                  <select value={productData.type} onChange={(e) => setProductData({...productData, type: e.target.value})} className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                    {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Estado</label>
                  <select value={productData.status} onChange={(e:any) => setProductData({...productData, status: e.target.value})} className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-8 text-left">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Especificaciones Técnicas</h3>
                </div>
                <button 
                  onClick={addTechSpec}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all"
                >
                  + Nueva Especificación
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {techSpecs.map((spec, index) => (
                  <div key={index} className="relative group p-8 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                    <button 
                      onClick={() => removeTechSpec(index)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors p-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-1">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                      </div>
                      <div className="flex-1 space-y-4">
                        <input 
                          type="text" 
                          placeholder="Título de la característica..."
                          value={spec.title}
                          onChange={(e) => updateTechSpec(index, 'title', e.target.value)}
                          className="w-full text-lg font-black text-slate-900 placeholder-slate-300 focus:outline-none bg-transparent leading-none"
                        />
                        <textarea 
                          placeholder="Descripción detallada de la tecnología o capacidad..."
                          value={spec.description}
                          onChange={(e) => updateTechSpec(index, 'description', e.target.value)}
                          className="w-full text-sm font-medium text-slate-500 placeholder-slate-300 focus:outline-none bg-transparent resize-none h-20 leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {techSpecs.length === 0 && (
                  <div className="md:col-span-2 py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-300 italic">
                    <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <p className="text-xs font-black uppercase tracking-widest">No hay especificaciones técnicas añadidas.</p>
                    <button onClick={addTechSpec} className="mt-4 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">Añadir la primera</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-16 text-left">
              <section>
                <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">1. Variantes y Precios</h3>
                  <button onClick={() => addRow('pricing')} className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-colors">+ Añadir Variante</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {productData.pricing?.map((p, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50/30 p-5 rounded-2xl border border-slate-100">
                      <div className="flex-1"><Input label="Nombre Variante" value={p.variant} onChange={(e:any) => updateRow('pricing', i, 'variant', e.target.value)} /></div>
                      <div className="w-40"><Input label="Precio (€)" type="number" value={p.price} onChange={(e:any) => updateRow('pricing', i, 'price', parseFloat(e.target.value))} /></div>
                      <button onClick={() => removeRow('pricing', i)} className="mb-4 p-2 text-red-400 hover:bg-red-50 rounded-lg">×</button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">2. Kits de Instalación</h3>
                  <button onClick={() => addRow('installation_kits')} className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-colors">+ Añadir Kit</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {productData.installation_kits?.map((p, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50/30 p-5 rounded-2xl border border-slate-100">
                      <div className="flex-1"><Input label="Descripción del Kit" value={p.name} onChange={(e:any) => updateRow('installation_kits', i, 'name', e.target.value)} /></div>
                      <div className="w-40"><Input label="Coste (€)" type="number" value={p.price} onChange={(e:any) => updateRow('installation_kits', i, 'price', parseFloat(e.target.value))} /></div>
                      <button onClick={() => removeRow('installation_kits', i)} className="mb-4 p-2 text-red-400 hover:bg-red-50 rounded-lg">×</button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">3. Materiales Extras</h3>
                  <button onClick={() => addRow('extras')} className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-colors">+ Añadir Extra</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {productData.extras?.map((p, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50/30 p-5 rounded-2xl border border-slate-100">
                      <div className="flex-1"><Input label="Concepto Extra" value={p.name} onChange={(e:any) => updateRow('extras', i, 'name', e.target.value)} /></div>
                      <div className="w-40"><Input label="PVP (€)" type="number" value={p.price} onChange={(e:any) => updateRow('extras', i, 'price', parseFloat(e.target.value))} /></div>
                      <button onClick={() => removeRow('extras', i)} className="mb-4 p-2 text-red-400 hover:bg-red-50 rounded-lg">×</button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-sm text-left">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic mb-8">Control de Existencias</h3>
              <Input label="Unidades Disponibles" type="number" value={productData.stock || 0} onChange={(e:any) => setProductData({...productData, stock: parseInt(e.target.value)})} />
            </div>
          )}

          {activeTab === 'multimedia' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-12 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-4">Imagen del Producto</h4>
                  <div className="relative group overflow-hidden rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all aspect-video flex flex-col items-center justify-center">
                    {previews.product ? (
                      <img src={previews.product} className="w-full h-full object-contain p-4" alt="Vista previa producto" />
                    ) : (
                      <div className="text-center p-8">
                        <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sube la foto del producto</p>
                      </div>
                    )}
                    <input type="file" onChange={(e) => handleFileUpload(e, 'product')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-4">Logotipo de la Marca</h4>
                  <div className="relative group overflow-hidden rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all aspect-video flex flex-col items-center justify-center">
                    {previews.logo ? (
                      <img src={previews.logo} className="w-full h-full object-contain p-8" alt="Logo preview" />
                    ) : (
                      <div className="text-center p-8">
                        <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Logo del fabricante</p>
                      </div>
                    )}
                    <input type="file" onChange={(e) => handleFileUpload(e, 'logo')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-slate-50">
                <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-6">Ficha Técnica Oficial (PDF)</h4>
                <div className="flex flex-col md:flex-row items-center gap-6 p-8 bg-slate-50/50 rounded-3xl border border-slate-100">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <p className="text-sm font-black text-slate-800 uppercase italic mb-1 truncate">{pdfFile ? pdfFile.name : (productData.pdf_url ? 'Ficha técnica activa' : 'Sin documento adjunto')}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Carga el PDF para que el cliente pueda consultarlo en la web</p>
                  </div>
                  <input type="file" id="pdf-upload" onChange={(e) => handleFileUpload(e, 'pdf')} className="hidden" accept="application/pdf" />
                  <label htmlFor="pdf-upload" className="w-full md:w-auto px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors shadow-sm text-center">Seleccionar Archivo</label>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
