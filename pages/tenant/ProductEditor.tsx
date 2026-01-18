
import React, { useState, useEffect, useRef } from 'react';
// Import core routing hooks from react-router to avoid dom export issues
import { useParams, useNavigate, useOutletContext } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant } from '../../types';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { extractProductWithGemini } from '../../services/geminiExtract';
import { formatCurrency } from '../../i18n';
import { useApp } from '../../AppProvider';

export const ProductEditor = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { language } = useApp();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const brandLogoRef = useRef<HTMLInputElement>(null);
  const productImgRef = useRef<HTMLInputElement>(null);

  const [productData, setProductData] = useState<any>({
    brand: '',
    model: '',
    type: 'aire_acondicionado',
    status: 'active',
    description: { es: '', ca: '' },
    pricing: [],
    installation_kits: [],
    extras: [],
    stock: 0,
    image_url: '',
    brand_logo_url: '',
    pdf_url: ''
  });
  const [financing, setFinancing] = useState<any[]>([]);
  const [techSpecs, setTechSpecs] = useState<any[]>([]);

  // Función de utilidad para asegurar que el tipo siempre sea uno de los permitidos
  const normalizeType = (t: string) => {
    const low = (t || '').toLowerCase();
    if (low.includes('aire') || low.includes('split') || low.includes('acondicionado')) return 'aire_acondicionado';
    if (low.includes('caldera')) return 'caldera';
    if (low.includes('termo')) return 'termo_electrico';
    return 'aire_acondicionado';
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (id === 'new') {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .single();

      if (data && !error) {
        const safeParse = (val: any, fallback: any = []) => {
          if (!val) return fallback;
          if (typeof val === 'string') {
            try { return JSON.parse(val); } catch (e) { return fallback; }
          }
          return val;
        };

        const rawDesc = safeParse(data.description, { es: '', ca: '' });

        setProductData({
          ...data,
          description: {
            es: rawDesc.es || '',
            ca: rawDesc.ca || ''
          },
          pricing: safeParse(data.pricing, []),
          installation_kits: safeParse(data.installation_kits, []),
          extras: safeParse(data.extras, [])
        });

        try {
          if (data.techSpecs) {
            const parsed = typeof data.techSpecs === 'string' ? JSON.parse(data.techSpecs) : data.techSpecs;
            if (Array.isArray(parsed)) {
              setTechSpecs(parsed);
            } else if (parsed && typeof parsed === 'object') {
              if (parsed.techSpecs) setTechSpecs(parsed.techSpecs);
              if (parsed.financing) setFinancing(parsed.financing);
            }
          }
        } catch (e) { console.error("Error al parsear techSpecs:", e); }
      } else if (error) {
        navigate(`/t/${slug}/products`);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id, tenant.id, slug, navigate]);

  const uploadFile = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const path = `${tenant.id}/${folder}/${fileName}`;
    const { error } = await supabase.storage.from('products').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
    return publicUrl;
  };

  const handleAiExtract = async (file: File) => {
    setAiLoading(true);
    setAiStatus('Procesando con Gemini...');

    try {
      const folder = file.type.includes('pdf') ? 'fichas' : 'images';
      const uploadedUrl = await uploadFile(file, folder);
      const normalized = await extractProductWithGemini(file);

      setProductData((prev: any) => ({
        ...prev,
        brand: normalized.brand || prev.brand,
        model: normalized.model || prev.model,
        type: normalizeType(normalized.type || prev.type),
        status: normalized.status || prev.status,
        stock: normalized.stock || prev.stock,
        description: {
          es: normalized.description?.es || prev.description.es,
          ca: normalized.description?.ca || prev.description.ca
        },
        pricing: normalized.pricing || [],
        installation_kits: normalized.installation_kits || [],
        extras: normalized.extras || [],
        pdf_url: uploadedUrl
      }));

      if (Array.isArray(normalized.techSpecs)) setTechSpecs(normalized.techSpecs);
      if (Array.isArray(normalized.financing)) setFinancing(normalized.financing);

      setAiStatus('Extracción finalizada');
      setTimeout(() => setAiStatus(''), 2000);
    } catch (err: any) {
      alert("Error en la extracción IA: " + err.message);
      setAiStatus('Error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!productData.brand || !productData.model) {
      alert("Marca y Modelo son obligatorios para guardar.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        brand: productData.brand,
        model: productData.model,
        type: normalizeType(productData.type),
        status: productData.status || 'active',
        description: productData.description || { es: '', ca: '' },
        pricing: productData.pricing || [],
        installation_kits: productData.installation_kits || [],
        extras: productData.extras || [],
        stock: parseInt(productData.stock) || 0,
        image_url: productData.image_url || '',
        brand_logo_url: productData.brand_logo_url || '',
        pdf_url: productData.pdf_url || '',
        techSpecs: JSON.stringify({ techSpecs, financing }),
        is_deleted: false
      };

      const { error } = id === 'new'
        ? await supabase.from('products').insert([payload]).select()
        : await supabase.from('products').update(payload).eq('id', id).eq('tenant_id', tenant.id).select();

      if (error) throw error;
      navigate(`/t/${slug}/products`);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handlers para Kits
  const addKit = () => setProductData({ ...productData, installation_kits: [...(productData.installation_kits || []), { name: '', price: 0 }] });
  const updateKit = (idx: number, field: string, val: any) => {
    const kits = [...productData.installation_kits];
    kits[idx] = { ...kits[idx], [field]: val };
    setProductData({ ...productData, installation_kits: kits });
  };
  const removeKit = (idx: number) => setProductData({ ...productData, installation_kits: productData.installation_kits.filter((_: any, i: number) => i !== idx) });

  // Handlers para Extras
  const addExtra = () => setProductData({ ...productData, extras: [...(productData.extras || []), { name: '', qty: 1, unit_price: 0 }] });
  const updateExtra = (idx: number, field: string, val: any) => {
    const extras = [...productData.extras];
    extras[idx] = { ...extras[idx], [field]: val };
    setProductData({ ...productData, extras: extras });
  };
  const removeExtra = (idx: number) => setProductData({ ...productData, extras: productData.extras.filter((_: any, i: number) => i !== idx) });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-10 text-left max-w-6xl mx-auto pb-32">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Editor de Producto</h1>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Empresa Actual: {tenant.name}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 font-bold uppercase text-[10px] hover:text-slate-900 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50">
            {saving ? 'PROCESANDO...' : 'GUARDAR EN EMPRESA'}
          </button>
        </div>
      </header>

      <div className={`bg-slate-50 p-6 rounded-[2.5rem] border-2 border-dashed transition-all group ${aiLoading ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'} mb-10`}>
        <label className="flex items-center justify-center gap-6 cursor-pointer relative py-4">
          {aiLoading ? (
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[11px] font-black uppercase tracking-widest text-blue-600">{aiStatus}</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="text-left">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 block">Sincronizar con IA Gemini</span>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight italic">Extraer datos para {tenant.name}</p>
              </div>
            </>
          )}
          <input type="file" className="hidden" accept=".pdf,image/*" disabled={aiLoading} onChange={(e) => e.target.files?.[0] && handleAiExtract(e.target.files[0])} />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {/* INFORMACIÓN BÁSICA */}
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-8 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Información del Equipo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Logo Marca</label>
                <div onClick={() => brandLogoRef.current?.click()} className="h-32 rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50 flex items-center justify-center cursor-pointer group relative overflow-hidden transition-all hover:bg-slate-100">
                  {productData.brand_logo_url ? <img src={productData.brand_logo_url} className="w-full h-full object-contain p-4" alt="Brand Logo" /> : <div className="text-center opacity-30"><svg className="w-8 h-8 mx-auto mb-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-[8px] font-black uppercase">Subir Logo</span></div>}
                  <input type="file" ref={brandLogoRef} className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { const url = await uploadFile(e.target.files[0], 'brands'); setProductData({ ...productData, brand_logo_url: url }); } }} />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Foto Producto</label>
                <div onClick={() => productImgRef.current?.click()} className="h-32 rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50 flex items-center justify-center cursor-pointer group relative overflow-hidden transition-all hover:bg-slate-100">
                  {productData.image_url ? <img src={productData.image_url} className="w-full h-full object-contain p-2" alt="Product" /> : <div className="text-center opacity-30"><svg className="w-8 h-8 mx-auto mb-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span className="text-[8px] font-black uppercase">Subir Foto</span></div>}
                  <input type="file" ref={productImgRef} className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { const url = await uploadFile(e.target.files[0], 'products'); setProductData({ ...productData, image_url: url }); } }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Marca" value={productData.brand} onChange={(e: any) => setProductData({ ...productData, brand: e.target.value })} />
              <Input label="Modelo" value={productData.model} onChange={(e: any) => setProductData({ ...productData, model: e.target.value })} />
              <Input label="Stock Disponible" type="number" value={productData.stock} onChange={(e: any) => setProductData({ ...productData, stock: e.target.value })} />
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Estado</label>
                <select value={productData.status} onChange={(e) => setProductData({ ...productData, status: e.target.value })} className="w-full px-6 py-4 border border-slate-100 rounded-2xl bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none"><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="draft">Borrador</option></select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Categoría</label>
                <select value={productData.type} onChange={(e) => setProductData({ ...productData, type: e.target.value })} className="w-full px-6 py-4 border border-slate-100 rounded-2xl bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none"><option value="aire_acondicionado">Aire Acondicionado</option><option value="caldera">Caldera</option><option value="termo_electrico">Termo Eléctrico</option></select>
              </div>
            </div>
          </section>

          {/* PRECIOS DEL EQUIPO */}
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-8 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Variantes de Precio del Equipo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(productData.pricing || []).map((p: any, i: number) => (
                <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                  <button onClick={() => setProductData({ ...productData, pricing: productData.pricing.filter((_: any, idx: number) => idx !== i) })} className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center bg-white text-red-400 border border-slate-100 rounded-full text-sm font-black shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  <div className="space-y-4">
                    <div className="space-y-1"><span className="text-[8px] font-black text-slate-400 uppercase ml-1">Nombre Variante</span><input value={p.name?.es || ''} onChange={(e) => { const cp = [...productData.pricing]; cp[i].name = { es: e.target.value, ca: e.target.value }; setProductData({ ...productData, pricing: cp }); }} className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[11px] font-bold" /></div>
                    <div className="space-y-1"><span className="text-[8px] font-black text-slate-400 uppercase ml-1">Precio Venta</span><input type="number" value={p.price} onChange={(e) => { const cp = [...productData.pricing]; cp[i].price = parseFloat(e.target.value); setProductData({ ...productData, pricing: cp }); }} className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[13px] font-black text-blue-600" /></div>
                  </div>
                </div>
              ))}
              <button onClick={() => setProductData({ ...productData, pricing: [...(productData.pricing || []), { name: { es: 'Variante', ca: 'Variant' }, price: 0 }] })} className="h-full min-h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 hover:text-blue-500 hover:border-blue-200 transition-all group"><span className="text-2xl mb-1 group-hover:scale-125 transition-transform">+</span><span className="text-[9px] font-black uppercase tracking-widest">Añadir Variante</span></button>
            </div>
          </section>

          {/* KITS DE INSTALACIÓN */}
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span> Kits de Instalación
              </h4>
              <button onClick={addKit} className="text-[9px] font-black uppercase bg-orange-50 text-orange-600 px-4 py-2 rounded-full hover:bg-orange-100 transition-colors">+ Añadir Kit</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(productData.installation_kits || []).map((k: any, i: number) => (
                <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group animate-in slide-in-from-left-2 duration-300">
                  <button onClick={() => removeKit(i)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors px-1 font-black">×</button>
                  <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Nombre del Kit</label><input value={k.name} onChange={(e) => updateKit(i, 'name', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-orange-500" /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Precio Kit</label><input type="number" value={k.price} onChange={(e) => updateKit(i, 'price', parseFloat(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[13px] font-black text-orange-600 outline-none focus:ring-1 focus:ring-orange-500" /></div>
                  </div>
                </div>
              ))}
              {(!productData.installation_kits || productData.installation_kits.length === 0) && (
                <div className="md:col-span-2 py-10 border-2 border-dashed border-slate-100 rounded-[2rem] text-center"><p className="text-[10px] font-black uppercase text-slate-300 italic">No hay kits configurados</p></div>
              )}
            </div>
          </section>

          {/* MATERIALES Y EXTRAS */}
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span> Materiales y Extras de Instalación
              </h4>
              <button onClick={addExtra} className="text-[9px] font-black uppercase bg-blue-50 text-blue-600 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors">+ Añadir Extra</button>
            </div>
            <div className="space-y-3">
              {(productData.extras || []).map((extra: any, i: number) => (
                <div key={i} className="flex flex-col md:flex-row items-end gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 relative group animate-in slide-in-from-left-2 duration-300">
                  <button onClick={() => removeExtra(i)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  <div className="flex-1 w-full space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Concepto / Material</label><input value={extra.name} onChange={(e) => updateExtra(i, 'name', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="w-24 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1 text-center block">Cant.</label><input type="number" value={extra.qty} onChange={(e) => updateExtra(i, 'qty', parseFloat(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="w-32 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1 text-center block">Precio Ud.</label><input type="number" value={extra.unit_price} onChange={(e) => updateExtra(i, 'unit_price', parseFloat(e.target.value))} className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-black text-center text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="w-28 space-y-1 pb-3 text-right"><label className="text-[7px] font-black uppercase text-slate-300 mb-1 block">Total Línea</label><span className="text-xs font-black text-slate-900">{formatCurrency((extra.qty || 0) * (extra.unit_price || 0), language)}</span></div>
                </div>
              ))}
              {(!productData.extras || productData.extras.length === 0) && (
                <div className="py-12 border-2 border-dashed border-slate-100 rounded-[2rem] text-center"><p className="text-[10px] font-black uppercase text-slate-300 italic">No hay materiales extras configurados</p></div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          {/* DESCRIPCIÓN CATÁLOGO */}
          <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Descripción Catálogo</h4>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Español</label><textarea value={productData.description?.es || ''} onChange={(e) => setProductData({ ...productData, description: { ...productData.description, es: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium h-20 resize-none outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Catalán</label><textarea value={productData.description?.ca || ''} onChange={(e) => setProductData({ ...productData, description: { ...productData.description, ca: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium h-20 resize-none outline-none focus:ring-2 focus:ring-blue-500" /></div>
            </div>
          </section>

          {/* FINANCIACIÓN */}
          <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> Financiación
            </h4>
            <div className="space-y-4">
              {financing.map((f: any, i: number) => (
                <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <div className="flex justify-between items-center mb-3">
                    <input value={f.label?.es || ''} onChange={(e) => { const cf = [...financing]; cf[i] = { ...cf[i], label: { es: e.target.value, ca: e.target.value } }; setFinancing(cf); }} placeholder="Etiqueta" className="bg-transparent border-none p-0 text-[9px] font-black uppercase text-slate-800 outline-none w-full placeholder:text-slate-300" />
                    <button onClick={() => setFinancing(financing.filter((_: any, idx: number) => idx !== i))} className="text-slate-300 hover:text-red-500 transition-colors px-1">×</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center bg-white p-2 rounded-xl border border-slate-100"><span className="block text-[7px] font-black text-slate-400 uppercase mb-1">Meses</span><input type="number" value={f.months || 0} onChange={(e) => { const cf = [...financing]; cf[i] = { ...cf[i], months: parseInt(e.target.value) || 0 }; setFinancing(cf); }} className="w-full text-center text-[11px] font-bold outline-none border-none bg-transparent" /></div>
                    <div className="text-center bg-white p-2 rounded-xl border border-slate-100"><span className="block text-[7px] font-black text-slate-400 uppercase mb-1">Coef.</span><input type="number" step="0.000001" value={f.coefficient || 0} onChange={(e) => { const cf = [...financing]; cf[i] = { ...cf[i], months: f.months, coefficient: parseFloat(e.target.value) || 0 }; setFinancing(cf); }} className="w-full text-center text-[11px] font-bold outline-none border-none bg-transparent text-blue-600" /></div>
                  </div>
                </div>
              ))}
              <button onClick={() => setFinancing([...financing, { months: 12, coefficient: 0.087, label: { es: 'NUEVA FINANCIACIÓN', ca: 'NOU FINANÇAMENT' } }])} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[8px] font-black uppercase text-slate-300 hover:text-purple-500 transition-colors">+ Añadir Financiación</button>
            </div>
          </section>

          {/* FICHA TÉCNICA */}
          <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Ficha Técnica
            </h4>
            <div className="space-y-4">
              {productData.pdf_url && <div className="mb-4"><a href={productData.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-colors group"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span className="text-[10px] font-black uppercase tracking-widest">Ver PDF Original</span></a></div>}
              {techSpecs.map((s: any, i: number) => (
                <div key={i} className="group border-b border-slate-50 pb-3"><div className="flex justify-between items-start"><div className="space-y-0.5"><input value={s.title} onChange={(e) => { const cs = [...techSpecs]; cs[i].title = e.target.value; setTechSpecs(cs); }} className="bg-transparent border-none p-0 text-[9px] font-black uppercase text-slate-400 outline-none w-full" /><input value={s.value || s.description || ''} onChange={(e) => { const cs = [...techSpecs]; cs[i].value = e.target.value; cs[i].description = e.target.value; setTechSpecs(cs); }} className="bg-transparent border-none p-0 text-[11px] font-bold text-slate-800 outline-none w-full" /></div><button onClick={() => setTechSpecs(techSpecs.filter((_: any, idx: number) => idx !== i))} className="text-slate-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">×</button></div></div>
              ))}
              <button onClick={() => setTechSpecs([...techSpecs, { title: 'Dato', value: '-' }])} className="w-full py-3 border-2 border-dashed border-slate-100 rounded-2xl text-[8px] font-black uppercase text-slate-300 hover:text-blue-500 transition-colors">+ Añadir Especificación</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
