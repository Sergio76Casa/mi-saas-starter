import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const CATEGORIES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Caldera' },
  { id: 'termo_electrico', label: 'Termo Eléctrico' }
];

export const ProductEditor = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { language, t } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state mirroring the screenshot structure
  const [productData, setProductData] = useState({
    brand: '',
    category: 'aire_acondicionado',
    modelSeries: '',
    description: '',
    variants: [{ name: '', price: 0 }],
    kits: [{ name: '', price: 0 }],
    extras: [] as { name: string, price: number }[],
    features: [] as { title: string, desc: string }[],
    financing: [{ label: '12 meses', months: 12, coeff: 0.087 }]
  });

  useEffect(() => {
    const fetchProduct = async () => {
      if (id === 'new') {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (data && !error) {
        // Try to parse brand and series from name if not present
        const parts = data.name.split(' ');
        setProductData({
          brand: parts[0] || '',
          category: data.category || 'aire_acondicionado',
          modelSeries: parts.slice(1).join(' ') || '',
          description: data.description || '',
          variants: [{ name: data.name, price: data.price }], // Fallback mapping
          kits: [],
          extras: [],
          features: [],
          financing: [{ label: '12 meses', months: 12, coeff: 0.087 }]
        });
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    // Serialize state to existing DB columns
    // We combine Brand + Series + first Variant for the name for backwards compatibility
    const mainName = `${productData.brand} ${productData.modelSeries} ${productData.variants[0]?.name || ''}`.trim();
    const mainPrice = productData.variants[0]?.price || 0;

    const payload = {
      name: mainName,
      price: mainPrice,
      category: productData.category,
      description: productData.description,
      tenant_id: tenant.id
    };

    let error;
    if (id === 'new') {
      const { error: err } = await supabase.from('products').insert([payload]);
      error = err;
    } else {
      const { error: err } = await supabase.from('products').update(payload).eq('id', id);
      error = err;
    }

    if (!error) {
      navigate(`/t/${slug}/products`);
    } else {
      alert("Error al guardar: " + error.message);
    }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[#fcfcfc] animate-in fade-in duration-500 pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 bg-white border-b border-slate-100 px-6 md:px-12 py-5 z-[60] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">Editar Producto</h1>
            <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest mt-1">ID: {id?.slice(0, 8)}...</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-[11px] font-black uppercase text-slate-400 px-4">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Block */}
          <div className="space-y-8">
            {/* IA Import */}
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
              <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Importación Automática (IA)
              </h2>
              <div className="border-2 border-dashed border-slate-100 rounded-2xl py-12 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-blue-500 transition-all">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                </div>
                <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Subir PDF Técnico</span>
              </div>
            </div>

            {/* Main Data */}
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
              <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-8">Datos Principales</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Marca" value={productData.brand} onChange={(e: any) => setProductData({ ...productData, brand: e.target.value })} />
                <div className="mb-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Tipo</label>
                  <select 
                    value={productData.category} 
                    onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50/50 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Input label="Modelo (Serie)" value={productData.modelSeries} onChange={(e: any) => setProductData({ ...productData, modelSeries: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Block: Graphics */}
          <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm flex flex-col">
            <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-8">Recursos Gráficos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              <div className="flex flex-col space-y-4">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Portada</label>
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center min-h-[160px] overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=200&auto=format&fit=crop" className="opacity-50 grayscale" alt="Preview" />
                </div>
              </div>
              <div className="flex flex-col space-y-4">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Logo Marca</label>
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center min-h-[160px] p-8">
                  <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-2xl uppercase italic">LG</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Commercial Config Separator */}
        <div className="relative py-10">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#fcfcfc] px-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Configuración Comercial</span>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Bottom */}
          <div className="space-y-8">
            {/* Variants */}
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                  Variantes de Precio / Potencias <span className="px-2 py-0.5 bg-slate-50 rounded-md text-blue-600">{productData.variants.length}</span>
                </h2>
                <button onClick={() => setProductData({...productData, variants: [...productData.variants, { name: '', price: 0 }]})} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                </button>
              </div>
              <div className="space-y-4">
                {productData.variants.map((variant, idx) => (
                  <div key={idx} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 relative group">
                    <button className="absolute top-4 right-4 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                         <div className="flex justify-between mb-1.5 ml-1">
                           <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nombre Variante</label>
                           <div className="flex gap-2 text-[8px] font-black text-slate-300">
                             <span className="text-blue-500">ES</span> | <span>CA</span>
                           </div>
                         </div>
                         <input className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-white text-sm" value={variant.name} onChange={(e) => {
                           const newVar = [...productData.variants];
                           newVar[idx].name = e.target.value;
                           setProductData({...productData, variants: newVar});
                         }} />
                      </div>
                      <div className="md:col-span-1">
                        <Input label="Precio (€)" type="number" value={variant.price} onChange={(e: any) => {
                          const newVar = [...productData.variants];
                          newVar[idx].price = parseFloat(e.target.value);
                          setProductData({...productData, variants: newVar});
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
               <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-10">Características Técnicas</h2>
               <div className="space-y-4">
                  {productData.features.length === 0 && (
                    <div className="py-12 text-center text-[10px] font-black uppercase text-slate-300 italic tracking-widest border-2 border-dashed border-slate-50 rounded-2xl">
                      Sin especificaciones añadidas
                    </div>
                  )}
                  <button onClick={() => setProductData({...productData, features: [...productData.features, { title: '', desc: '' }]})} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[9px] font-black text-slate-300 hover:text-blue-600 hover:border-blue-100 transition-all uppercase tracking-widest">
                    + Añadir Especificación
                  </button>
               </div>
            </div>
          </div>

          {/* Right Bottom */}
          <div className="space-y-8">
            {/* Kits */}
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                  Kits de Instalación <span className="px-2 py-0.5 bg-slate-50 rounded-md text-blue-600">{productData.kits.length}</span>
                </h2>
                <button onClick={() => setProductData({...productData, kits: [...productData.kits, { name: '', price: 0 }]})} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                </button>
              </div>
              <div className="space-y-4">
                {productData.kits.map((kit, idx) => (
                   <div key={idx} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 relative group">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Input label="Nombre Kit" value={kit.name} onChange={(e: any) => {
                          const newKits = [...productData.kits];
                          newKits[idx].name = e.target.value;
                          setProductData({...productData, kits: newKits});
                        }} />
                      </div>
                      <Input label="Precio (€)" type="number" value={kit.price} onChange={(e: any) => {
                        const newKits = [...productData.kits];
                        newKits[idx].price = parseFloat(e.target.value);
                        setProductData({...productData, kits: newKits});
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Extras */}
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
               <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-10">Extras Opcionales</h2>
               <div className="py-20 text-center text-[10px] font-black uppercase text-slate-200 italic tracking-widest border-2 border-dashed border-slate-50 rounded-2xl">
                  No hay elementos adicionales configurados
               </div>
            </div>

            {/* Financing */}
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
               <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-10">Financiación</h2>
               <div className="space-y-4">
                  {productData.financing.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex-1 font-black text-[11px] text-slate-700 uppercase italic">{f.label}</div>
                      <div className="text-[11px] font-bold text-blue-600">{f.coeff} coeff</div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
