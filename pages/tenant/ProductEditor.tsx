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
  { id: 'termo_electrico', label: 'Termo Eléctrico' }
];

export const ProductEditor = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { language, t } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [productData, setProductData] = useState({
    brand: '',
    type: 'aire_acondicionado',
    model: '',
    pdfUrl: '',
    imageUrl: '',
    brandLogoUrl: '',
    pricing: [{ variant: '', price: 0 }]
  });

  useEffect(() => {
    const fetchProduct = async () => {
      if (id === 'new') {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (data && !error) {
        const p = data as Product;
        setProductData({
          brand: p.brand || '',
          type: p.type || 'aire_acondicionado',
          model: p.model || '',
          pdfUrl: p.pdfUrl || '',
          imageUrl: p.imageUrl || '',
          brandLogoUrl: p.brandLogoUrl || '',
          pricing: Array.isArray(p.pricing) ? p.pricing : (p.pricing ? [p.pricing] : [{ variant: '', price: 0 }])
        });
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    
    // Validate pricing data
    const cleanedPricing = productData.pricing.filter(v => v.variant.trim() !== '');

    const payload = {
      brand: productData.brand.trim(),
      model: productData.model.trim(),
      type: productData.type,
      pricing: cleanedPricing,
      pdfUrl: productData.pdfUrl,
      imageUrl: productData.imageUrl,
      brandLogoUrl: productData.brandLogoUrl,
      company_id: tenant.id,
      is_deleted: false
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

  const addVariant = () => {
    setProductData({ ...productData, pricing: [...productData.pricing, { variant: '', price: 0 }] });
  };

  const removeVariant = (index: number) => {
    const newPricing = [...productData.pricing];
    newPricing.splice(index, 1);
    setProductData({ ...productData, pricing: newPricing });
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const newPricing = [...productData.pricing];
    newPricing[index] = { ...newPricing[index], [field]: value };
    setProductData({ ...productData, pricing: newPricing });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[#fcfcfc] animate-in fade-in duration-500 pb-20">
      <header className="sticky top-0 bg-white border-b border-slate-100 px-6 md:px-12 py-5 z-[60] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">Editar Familia</h1>
            <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest mt-1">ID: {id === 'new' ? 'NUEVO' : id?.slice(0, 8)}</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
              <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-8">Datos Principales</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Marca (Ej: LG, DAIKIN)" value={productData.brand} onChange={(e: any) => setProductData({ ...productData, brand: e.target.value })} />
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Tipo de Equipo</label>
                  <select 
                    value={productData.type} 
                    onChange={(e) => setProductData({ ...productData, type: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50/50 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Input label="Modelo / Serie (Ej: LIBERO SMART, SENSIRA)" value={productData.model} onChange={(e: any) => setProductData({ ...productData, model: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
              <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-8">Media y Enlaces</h2>
              <div className="space-y-4">
                <Input label="URL Imagen Producto" value={productData.imageUrl} onChange={(e: any) => setProductData({ ...productData, imageUrl: e.target.value })} />
                <Input label="URL Logo Marca" value={productData.brandLogoUrl} onChange={(e: any) => setProductData({ ...productData, brandLogoUrl: e.target.value })} />
                <Input label="URL Ficha Técnica (PDF)" value={productData.pdfUrl} onChange={(e: any) => setProductData({ ...productData, pdfUrl: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-[1.8rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Variantes y Precios</h2>
                <button onClick={addVariant} className="text-[10px] font-black uppercase text-blue-600 hover:underline">+ Añadir Variante</button>
              </div>
              <div className="space-y-4">
                {productData.pricing.map((v, index) => (
                  <div key={index} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-50">
                    <div className="flex-1">
                      <Input 
                        label="Nombre Variante (Ej: 2.5kW)" 
                        value={v.variant} 
                        onChange={(e: any) => updateVariant(index, 'variant', e.target.value)} 
                      />
                    </div>
                    <div className="w-32">
                      <Input 
                        label="Precio (€)" 
                        type="number" 
                        step="0.01" 
                        value={v.price} 
                        onChange={(e: any) => updateVariant(index, 'price', parseFloat(e.target.value))} 
                      />
                    </div>
                    <button 
                      onClick={() => removeVariant(index)}
                      className="mb-4 p-2 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
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
