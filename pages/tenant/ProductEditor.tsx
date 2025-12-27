
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../i18n';

const TYPES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Caldera' },
  { id: 'termo_electrico', label: 'Termo Eléctrico' }
];

const STATUSES = [
  { id: 'draft', label: 'Borrador', color: 'bg-amber-500' },
  { id: 'active', label: 'Activo', color: 'bg-green-500' },
  { id: 'inactive', label: 'Inactivo', color: 'bg-slate-400' }
];

type TabId = 'general' | 'technical' | 'pricing' | 'stock' | 'multimedia';

export const ProductEditor = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { language } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // States for images
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

  const uploadFile = async (file: File, folder: string) => {
    const fileName = `${Date.now()}_${file.name}`;
    const path = `${tenant.id}/${fileName}`;
    const { data, error } = await supabase.storage.from('products').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!productData.brand || !productData.model) {
      alert("Marca y Modelo son obligatorios");
      setActiveTab('general');
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = productData.image_url;
      let finalLogoUrl = productData.brand_logo_url;
      let finalPdfUrl = productData.pdf_url;

      if (productFile) finalImageUrl = await uploadFile(productFile, 'images');
      if (logoFile) finalLogoUrl = await uploadFile(logoFile, 'logos');
      if (pdfFile) finalPdfUrl = await uploadFile(pdfFile, 'docs');

      const payload = {
        ...productData,
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
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addRow = (list: 'pricing' | 'installation_kits' | 'extras') => {
    setProductData(prev => ({
      ...prev,
      [list]: [...(prev[list] || []), { name: '', variant: '', price: 0 }]
    }));
  };

  const removeRow = (list: 'pricing' | 'installation_kits' | 'extras', index: number) => {
    setProductData(prev => {
      const newList = [...(prev[list] || [])];
      newList.splice(index, 1);
      return { ...prev, [list]: newList };
    });
  };

  const updateRow = (list: 'pricing' | 'installation_kits' | 'extras', index: number, field: string, value: any) => {
    setProductData(prev => {
      const newList = [...(prev[list] || [])];
      newList[index] = { ...newList[index], [field]: value };
      return { ...prev, [list]: newList };
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[#fcfcfc] animate-in fade-in duration-500 pb-20">
      <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 md:px-12 py-5 z-[60] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter italic uppercase leading-none">Editor de Producto</h1>
            <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest mt-1">ID: {id === 'new' ? 'NUEVO' : id?.slice(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
            {saving ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* TAB NAVIGATION */}
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

        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px]">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-8 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Marca *" value={productData.brand} onChange={(e:any) => setProductData({...productData, brand: e.target.value})} />
                <Input label="Modelo *" value={productData.model} onChange={(e:any) => setProductData({...productData, model: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Tipo de Equipo</label>
                  <select value={productData.type} onChange={(e) => setProductData({...productData, type: e.target.value})} className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Estado del Producto</label>
                  <select value={productData.status} onChange={(e:any) => setProductData({...productData, status: e.target.value})} className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL */}
          {activeTab === 'technical' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Especificaciones Técnicas</label>
              <textarea 
                value={productData.features || ''} 
                onChange={(e) => setProductData({...productData, features: e.target.value})}
                placeholder="Escribe aquí las características técnicas principales..."
                className="w-full h-64 p-6 border border-gray-100 rounded-[2rem] bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          )}

          {/* TAB 3: PRICING (DYNAMIC LISTS) */}
          {activeTab === 'pricing' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-12">
              <section>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Variantes de Producto</h3>
                  <button onClick={() => addRow('pricing')} className="text-blue-600 font-bold text-[10px] uppercase">+ Añadir Variante</button>
                </div>
                <div className="space-y-3">
                  {productData.pricing?.map((p, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                      <div className="flex-1"><Input label="Nombre Variante" value={p.variant} onChange={(e:any) => updateRow('pricing', i, 'variant', e.target.value)} /></div>
                      <div className="w-32"><Input label="Precio (€)" type="number" value={p.price} onChange={(e:any) => updateRow('pricing', i, 'price', parseFloat(e.target.value))} /></div>
                      <button onClick={() => removeRow('pricing', i)} className="mb-4 p-2 text-red-400">×</button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Kits de Instalación</h3>
                  <button onClick={() => addRow('installation_kits')} className="text-blue-600 font-bold text-[10px] uppercase">+ Añadir Kit</button>
                </div>
                <div className="space-y-3">
                  {productData.installation_kits?.map((p, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                      <div className="flex-1"><Input label="Nombre Kit" value={p.name} onChange={(e:any) => updateRow('installation_kits', i, 'name', e.target.value)} /></div>
                      <div className="w-32"><Input label="Precio (€)" type="number" value={p.price} onChange={(e:any) => updateRow('installation_kits', i, 'price', parseFloat(e.target.value))} /></div>
                      <button onClick={() => removeRow('installation_kits', i)} className="mb-4 p-2 text-red-400">×</button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Extras y Adicionales</h3>
                  <button onClick={() => addRow('extras')} className="text-blue-600 font-bold text-[10px] uppercase">+ Añadir Extra</button>
                </div>
                <div className="space-y-3">
                  {productData.extras?.map((p, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                      <div className="flex-1"><Input label="Descripción Extra" value={p.name} onChange={(e:any) => updateRow('extras', i, 'name', e.target.value)} /></div>
                      <div className="w-32"><Input label="Precio (€)" type="number" value={p.price} onChange={(e:any) => updateRow('extras', i, 'price', parseFloat(e.target.value))} /></div>
                      <button onClick={() => removeRow('extras', i)} className="mb-4 p-2 text-red-400">×</button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: STOCK */}
          {activeTab === 'stock' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-xs">
              <Input label="Unidades Disponibles" type="number" value={productData.stock || 0} onChange={(e:any) => setProductData({...productData, stock: parseInt(e.target.value)})} />
            </div>
          )}

          {/* TAB 5: MULTIMEDIA (UPLOADS) */}
          {activeTab === 'multimedia' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-4">Imagen del Producto</h4>
                  <div className="relative group">
                    <div className="w-full h-64 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:bg-slate-50">
                      {previews.product ? (
                        <img src={previews.product} className="w-full h-full object-contain" />
                      ) : (
                        <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      )}
                    </div>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'product')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-4">Logo de la Marca</h4>
                  <div className="relative group">
                    <div className="w-full h-64 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:bg-slate-50">
                      {previews.logo ? (
                        <img src={previews.logo} className="w-full h-full object-contain" />
                      ) : (
                        <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
                      )}
                    </div>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'logo')} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50">
                <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest mb-4">Ficha Técnica (PDF)</h4>
                <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700">{pdfFile ? pdfFile.name : (productData.pdf_url ? 'Ficha cargada' : 'No hay PDF seleccionado')}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Sube el documento técnico original para referencia</p>
                  </div>
                  <input type="file" id="pdf-upload" onChange={(e) => handleFileUpload(e, 'pdf')} className="hidden" accept="application/pdf" />
                  <label htmlFor="pdf-upload" className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase cursor-pointer hover:bg-slate-100 transition-colors">Seleccionar Archivo</label>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
