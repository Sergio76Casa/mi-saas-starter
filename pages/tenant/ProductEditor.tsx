import React, { useState, useEffect, useRef } from 'react';
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
  const { language } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isProcessingIA, setIsProcessingIA] = useState(false);
  const [iaStatus, setIaStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ type: 'idle' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productData, setProductData] = useState({
    brand: '',
    type: 'aire_acondicionado',
    model: '',
    pdfUrl: '',
    imageUrl: '',
    brandLogoUrl: '',
    pricing: [{ variant: '', price: 0 }],
    // Campos extendidos para persistencia completa
    features: [] as any,
    installationKits: [] as any,
    extras: [] as any,
    financing: [] as any
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
          pricing: Array.isArray(p.pricing) ? p.pricing : (p.pricing ? [p.pricing] : [{ variant: '', price: 0 }]),
          features: p.features || [],
          installationKits: p.installationKits || [],
          extras: p.extras || [],
          financing: p.financing || []
        });
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  const handleProcessIA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIaStatus({ type: 'loading', message: 'Analizando documento...' });
    setIsProcessingIA(true);

    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('defaultCategory', productData.type);

      const { data, error } = await supabase.functions.invoke('extract_products_from_file', {
        body: formData,
      });

      if (error) throw error;

      if (data && data.products && data.products.length > 0) {
        const extracted = data.products[0];
        
        // Mapeo inteligente sin destruir datos existentes si no vienen en la IA
        setProductData(prev => ({
          ...prev,
          brand: extracted.brand || prev.brand,
          model: extracted.model || prev.model,
          type: extracted.category || prev.type,
          pricing: extracted.price ? [{ variant: extracted.variant || 'Estándar', price: extracted.price }] : prev.pricing,
          features: extracted.features || prev.features,
          installationKits: extracted.installationKits || prev.installationKits,
          extras: extracted.extras || prev.extras,
          financing: extracted.financing || prev.financing
        }));

        setIaStatus({ type: 'success', message: '¡Datos extraídos con éxito!' });
      } else {
        setIaStatus({ type: 'error', message: data.error || 'No se detectaron productos en el archivo.' });
      }
    } catch (err: any) {
      console.error("IA Error:", err);
      setIaStatus({ type: 'error', message: 'Error al procesar IA. Verifica el archivo.' });
    } finally {
      setIsProcessingIA(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const cleanedPricing = productData.pricing.filter(v => v.variant.trim() !== '');

    const payload = {
      brand: productData.brand.trim(),
      model: productData.model.trim(),
      type: productData.type,
      pricing: cleanedPricing,
      pdfUrl: productData.pdfUrl,
      imageUrl: productData.imageUrl,
      brandLogoUrl: productData.brandLogoUrl,
      features: productData.features,
      installationKits: productData.installationKits,
      extras: productData.extras,
      financing: productData.financing,
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

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* BLOQUE IMPORTACIÓN AUTOMÁTICA IA */}
        <section className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[1.8rem] p-8 md:p-10 shadow-xl shadow-blue-600/20 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-md">
              <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter mb-2">Importación automática (IA)</h2>
              <p className="text-blue-100 text-sm font-medium italic opacity-80">Sube un catálogo PDF o fotos de la ficha técnica y nosotros rellenamos el formulario por ti.</p>
            </div>
            <div className="flex flex-col items-center gap-4 w-full md:w-auto">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleProcessIA} 
                className="hidden" 
                accept="application/pdf,image/*" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingIA}
                className="w-full md:w-auto px-10 py-4 bg-white text-blue-600 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isProcessingIA ? (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    Subir PDF o Imágenes
                  </>
                )}
              </button>
              
              {iaStatus.type !== 'idle' && (
                <div className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border ${
                  iaStatus.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-200' : 
                  iaStatus.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-200' : 
                  'bg-white/10 border-white/20 text-blue-100'
                }`}>
                  {iaStatus.message}
                </div>
              )}
            </div>
          </div>
        </section>

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