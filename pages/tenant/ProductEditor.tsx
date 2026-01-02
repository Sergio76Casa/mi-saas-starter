import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant } from '../../types';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { extractProductWithGemini } from '../../services/geminiExtract';

export const ProductEditor = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [productData, setProductData] = useState<any>({ 
    brand: '', 
    model: '', 
    type: 'aire_acondicionado',
    status: 'draft',
    pricing: [], 
    installation_kits: [], 
    extras: [],
    stock: 0
  });
  const [financing, setFinancing] = useState<any[]>([]);
  const [techSpecs, setTechSpecs] = useState<any[]>([]);

  useEffect(() => { 
    const fetchProduct = async () => {
      if (id === 'new') {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (data && !error) {
        setProductData(data);
        try {
          if (data.features) {
            const parsed = JSON.parse(data.features);
            if (parsed.techSpecs) setTechSpecs(parsed.techSpecs);
            if (parsed.financing) setFinancing(parsed.financing);
          }
        } catch (e) { console.error("Error parsing features", e); }
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const handleAiExtract = async (file: File) => {
    setAiLoading(true);
    console.log("--- START FRONTEND GEMINI v3 EXTRACTION ---");

    try {
      const normalized = await extractProductWithGemini(file);
      console.log("Gemini response version:", normalized.__version);

      setProductData((prev: any) => ({
        ...prev,
        brand: normalized.brand || prev.brand,
        model: normalized.model || prev.model,
        type: normalized.type || prev.type,
        pricing: normalized.pricing,
        // Mapeo crucial: installationKits (extraído) -> installation_kits (DB)
        installation_kits: normalized.installationKits,
        extras: normalized.extras,
        stock: prev.stock || 0
      }));

      if (Array.isArray(normalized.techSpecs)) {
        setTechSpecs(normalized.techSpecs);
      }

      if (Array.isArray(normalized.financing)) {
        setFinancing(normalized.financing);
      }

      alert("✨ Datos extraídos correctamente con Gemini v3.");
    } catch (err: any) {
      console.error("DIAGNOSTIC ERROR:", err);
      alert("Error en la extracción: " + err.message);
    } finally {
      setAiLoading(false);
      console.log("--- END FRONTEND GEMINI EXTRACTION ---");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        brand: productData.brand,
        model: productData.model,
        type: productData.type,
        status: productData.status || 'draft',
        pricing: productData.pricing,
        installation_kits: productData.installation_kits,
        extras: productData.extras,
        stock: productData.stock,
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-10 text-left max-w-5xl mx-auto pb-20">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Editor de Producto (IA Gemini)</h1>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Soporte bilingüe ES / CA integrado</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 font-bold uppercase text-[10px] hover:text-slate-900 transition-colors">Volver</button>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        </div>
      </header>

      <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 mb-10 hover:border-blue-300 transition-colors group">
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <div className="w-16 h-16 bg-blue-600/10 text-blue-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          </div>
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Analizar Ficha Técnica (PDF / JPG)</span>
            <p className="text-[9px] text-slate-400 italic">Gemini extraerá automáticamente marcas, modelos y datos técnicos.</p>
          </div>
          <div className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95">
            {aiLoading ? 'ANALIZANDO DOCUMENTO...' : 'EXTRAER DATOS CON IA'}
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept=".pdf,image/*" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleAiExtract(e.target.files[0]);
                e.currentTarget.value = ""; // Reset crucial para permitir re-selección
              }
            }} 
          />
        </label>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Información General
            </h4>
            <div className="space-y-4">
              <Input label="Marca" value={productData.brand} onChange={(e:any) => setProductData({...productData, brand: e.target.value})} />
              <Input label="Modelo" value={productData.model} onChange={(e:any) => setProductData({...productData, model: e.target.value})} />
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Tipo de Equipo</label>
                <select 
                  value={productData.type} 
                  onChange={(e) => setProductData({...productData, type: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                >
                  <option value="aire_acondicionado">Aire Acondicionado</option>
                  <option value="aerotermia">Aerotermia</option>
                  <option value="caldera">Caldera</option>
                  <option value="termo_electrico">Termo Eléctrico</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Precios y Costes (Bilingüe)
            </h4>
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {productData.pricing.map((p: any, i: number) => (
                <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-black text-slate-900 uppercase italic leading-none">{p.name?.es}</div>
                      <div className="text-[10px] font-bold text-slate-400 italic leading-none">{p.name?.ca}</div>
                    </div>
                    <button onClick={() => setProductData({...productData, pricing: productData.pricing.filter((_:any,idx:number)=>idx!==i)})} className="text-red-300 hover:text-red-500 text-[14px]">×</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-blue-600 font-black text-sm">{p.price} € <span className="text-[9px] uppercase block text-slate-400 font-bold">Venta</span></div>
                    <div className="text-slate-900 font-black text-sm">{p.cost} € <span className="text-[9px] uppercase block text-slate-400 font-bold">Coste</span></div>
                  </div>
                </div>
              ))}
              <button onClick={() => setProductData({...productData, pricing: [...productData.pricing, { name: {es:'',ca:''}, price: 0, cost: 0 }]})} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[9px] font-black uppercase text-slate-400 hover:text-blue-600">+ Añadir Variante</button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Características Técnicas
            </h4>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {techSpecs.length > 0 ? techSpecs.map((s: any, i: number) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-50 py-3 group">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">{s.title}</span>
                    <span className="text-[11px] font-bold text-slate-800 italic">{s.description}</span>
                  </div>
                  <button onClick={() => setTechSpecs(techSpecs.filter((_: any, idx: number) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-opacity">×</button>
                </div>
              )) : (
                <div className="py-10 text-center text-slate-300 text-[10px] font-black uppercase italic tracking-widest opacity-40">Sin datos técnicos extraídos</div>
              )}
              <button onClick={() => setTechSpecs([...techSpecs, { title: 'Nueva Propiedad', description: '-' }])} className="w-full py-2 border-t border-slate-50 text-[8px] font-black uppercase text-slate-300 hover:text-blue-500 mt-2">+ Añadir Campo</button>
            </div>
          </section>

          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Instalación y Kits
            </h4>
            <div className="space-y-3">
              {productData.installation_kits.map((k: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-800 leading-tight">{k.name?.es}</span>
                    <span className="text-[9px] font-bold text-slate-400 italic leading-tight">{k.name?.ca}</span>
                  </div>
                  <div className="font-black text-blue-600 text-sm">{k.price} €</div>
                </div>
              ))}
              {productData.installation_kits.length === 0 && (
                <p className="text-center py-4 text-[10px] text-slate-300 font-black uppercase italic tracking-widest">No se han definido kits</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};