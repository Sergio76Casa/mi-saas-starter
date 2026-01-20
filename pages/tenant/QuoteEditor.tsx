
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, useParams, useSearchParams } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Quote, Customer, QuoteItem, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { formatCurrency, formatDate } from '../../i18n';
import { PDF_PRODUCTS, PDF_KITS, PDF_EXTRAS, FINANCING_COEFFICIENTS } from '../../data/pdfCatalog';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const QuoteEditor = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, language } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [formData, setFormData] = useState<Partial<Quote & { product_image_url?: string; brand_logo_url?: string }>>({
    status: 'draft',
    client_name: '',
    client_dni: '',
    client_address: '',
    client_population: '',
    client_email: '',
    client_phone: '',
    maintenance_no: '',
    total_amount: 0,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [],
    financing_months: 12,
    product_image_url: '',
    brand_logo_url: ''
  });

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Cargar clientes
        const { data: custData } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('name');
        if (custData) setCustomers(custData);

        // 2. Cargar productos (Local restore)
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .or('is_deleted.eq.false,is_deleted.is.null');
        if (prodData) setProducts(prodData as Product[]);

        // 3. Si es edición, cargar el presupuesto
        if (id && id !== 'new') {
          const { data: q, error: qError } = await supabase
            .from('quotes')
            .select('*, items:quote_items(*)')
            .eq('id', id)
            .single();

          if (!qError && q) {
            setFormData({
              ...q,
              items: q.items || []
            });
          }
        } else {
          // Si es nuevo y viene de un producto específico (URL param)
          const productId = searchParams.get('productId');
          if (productId) {
            // Primero buscar en PDF_PRODUCTS (AI Studio)
            const pdfProd = PDF_PRODUCTS.find(p => p.id === productId);
            if (pdfProd) {
              addItem(pdfProd.name, pdfProd.price);
            } else {
              // Luego buscar en DB products
              const dbProd = prodData?.find(p => p.id === productId);
              if (dbProd) {
                // Si tiene variantes, podrías añadir la primera, pero por ahora lo dejamos así
                addItem(`${dbProd.brand} ${dbProd.model}`, (dbProd.pricing as any)?.[0]?.price || 0);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tenant.id, id]);

  const subtotal = useMemo(() => {
    return (formData.items || []).reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  }, [formData.items]);

  const categories = useMemo(() => {
    const types = new Set(products.map(p => p.type).filter(Boolean));
    return ['all', ...Array.from(types)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchTerm || (p.brand + ' ' + p.model).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || p.type === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  const monthlyFee = useMemo(() => {
    if (!formData.financing_months) return 0;
    const coeff = FINANCING_COEFFICIENTS[formData.financing_months];
    return subtotal * (coeff || 0);
  }, [subtotal, formData.financing_months]);

  const addItem = (description: string, price: number, imageUrl?: string, brandLogoUrl?: string) => {
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      description,
      quantity: 1,
      unit_price: price,
      total: price
    } as any;
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem],
      product_image_url: imageUrl || prev.product_image_url,
      brand_logo_url: brandLogoUrl || prev.brand_logo_url
    }));
  };

  const updateItem = (itemId: string, field: keyof QuoteItem, val: any) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(item => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: val };
          if (field === 'quantity' || field === 'unit_price') {
            updated.total = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0);
          }
          return updated;
        }
        return item;
      })
    }));
  };

  const removeItem = (itemId: string) => {
    setFormData(prev => ({ ...prev, items: (prev.items || []).filter(item => item.id !== itemId) }));
  };

  const handleCustomerSelect = (custId: string) => {
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setFormData(prev => ({
        ...prev,
        customer_id: custId,
        client_name: cust.name,
        client_email: cust.email,
        client_phone: cust.phone || '',
        client_dni: cust.dni || '',
        client_address: cust.address || '',
        client_population: cust.population || ''
      }));
    }
  };

  const handleSave = async () => {
    if (!formData.client_name) return alert("El nombre del cliente es obligatorio.");
    if (!formData.items || formData.items.length === 0) return alert("Añada al menos un concepto.");

    setIsSaving(true);
    try {
      const quotePayload = {
        tenant_id: tenant.id,
        customer_id: formData.customer_id,
        client_name: formData.client_name,
        client_dni: formData.client_dni,
        client_address: formData.client_address,
        client_population: formData.client_population,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        maintenance_no: formData.maintenance_no,
        total_amount: subtotal,
        status: formData.status || 'draft',
        valid_until: formData.valid_until,
        financing_months: formData.financing_months,
        financing_fee: monthlyFee,
        quote_no: formData.quote_no || `PRE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        product_image_url: formData.product_image_url,
        brand_logo_url: formData.brand_logo_url
      };

      let quoteId = id;

      if (id === 'new') {
        const { data, error: iError } = await supabase.from('quotes').insert([quotePayload]).select().single();
        if (iError) throw iError;
        quoteId = data.id;
      } else {
        const { error: uError } = await supabase.from('quotes').update(quotePayload).eq('id', id);
        if (uError) throw uError;
        // Limpiar items antiguos para re-insertar
        await supabase.from('quote_items').delete().eq('quote_id', id);
      }

      // Insertar items
      const itemsPayload = (formData.items || []).map(item => ({
        quote_id: quoteId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }));

      const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload);
      if (itemsError) throw itemsError;

      alert("Presupuesto guardado correctamente.");
      navigate(`/t/${tenant.slug}/quotes`);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getShareLink = () => {
    return `${window.location.origin}/#/presupuestos/${id}/aceptar`;
  };

  const handleWhatsAppShare = () => {
    const link = getShareLink();
    const msg = `Hola ${formData.client_name}, aquí tienes el presupuesto para tu revisión y firma: ${link}`;
    window.open(`https://wa.me/${formData.client_phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getShareLink());
    setShowToast("Enlace copiado");
    setTimeout(() => setShowToast(null), 2000);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700 pb-24 px-4 md:px-10 text-left relative bg-slate-50 min-h-screen">
      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-8 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl animate-bounce">
          {showToast}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-10 mb-8 gap-6 border-b border-slate-200/50">
        <div>
          <h3 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase italic bg-gradient-to-r from-slate-900 to-slate-500 bg-clip-text text-transparent">
            {id === 'new' ? t('new_quote') : 'Editar Presupuesto'}
          </h3>
          <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Ref: {formData.quote_no || 'Temporal'}
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-4">
          <button onClick={() => navigate(-1)} className="flex-1 md:flex-none px-8 py-4 text-slate-400 text-[10px] font-black uppercase border border-slate-200 rounded-2xl hover:bg-white hover:text-slate-900 transition-all">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-2 md:flex-none px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-slate-900/20 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'GUARDANDO...' : 'Guardar presupuesto'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">

          {/* SECCIÓN COMPARTIR (AI Studio feature) */}
          {id !== 'new' && (
            <section className="bg-blue-600 p-8 md:p-12 rounded-[3.5rem] text-white shadow-2xl shadow-blue-600/30 flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-top-6 duration-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
              <div className="relative">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2 italic">Presupuesto Generado</h4>
                <p className="text-2xl font-black italic tracking-tight leading-none uppercase max-w-md">Enviar enlace de revisión digital al cliente</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto relative">
                <button
                  onClick={handleWhatsAppShare}
                  className="flex-1 md:flex-none px-8 py-4 bg-white text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412s-1.239 6.167-3.488 8.413c-2.248 2.244-5.231 3.484-8.411 3.484h-.001c-2.008 0-3.975-.521-5.714-1.506l-6.276 1.649zm6.151-3.692l.332.197c1.472.873 3.136 1.335 4.845 1.335h.001c5.446 0 9.876-4.43 9.878-9.876.001-2.64-1.029-5.12-2.899-6.992s-4.353-2.901-6.993-2.902c-5.448 0-9.879 4.432-9.881 9.879 0 1.83.509 3.618 1.474 5.176l.216.35-.97 3.541 3.633-.953z" /></svg>
                  WhatsApp
                </button>
                <button
                  onClick={copyLink}
                  className="flex-1 md:flex-none px-8 py-4 bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-800 transition-all shadow-xl"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  Copiar Link
                </button>
              </div>
            </section>
          )}

          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200/50 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 duration-500">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              Datos del Cliente
            </h4>

            <div className="mb-10 p-8 bg-slate-50 rounded-3xl border border-slate-200/30 flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:w-1/3">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1 italic">Buscar existente</label>
                <select
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  value={formData.customer_id || ''}
                  className="w-full px-6 py-4 border border-slate-200 rounded-2xl bg-white text-sm font-bold italic focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                >
                  <option value="">-- Nuevo Cliente --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
              </div>
              <div className="w-full md:w-2/3 pt-6 md:pt-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Tip: Si seleccionas un cliente existente, sus datos se cargarán automáticamente. Si no, rellena los campos para crear uno nuevo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              <Input label="Nombre completo / Razón Social" value={formData.client_name} onChange={(e: any) => setFormData({ ...formData, client_name: e.target.value })} />
              <Input label={t('dni')} value={formData.client_dni} onChange={(e: any) => setFormData({ ...formData, client_dni: e.target.value })} />
              <div className="md:col-span-2">
                <Input label={t('address')} value={formData.client_address} onChange={(e: any) => setFormData({ ...formData, client_address: e.target.value })} />
              </div>
              <Input label={t('population')} value={formData.client_population} onChange={(e: any) => setFormData({ ...formData, client_population: e.target.value })} />
              <Input label={t('maintenance_no')} value={formData.maintenance_no} onChange={(e: any) => setFormData({ ...formData, maintenance_no: e.target.value })} />
              <Input label="Correo electrónico" type="email" value={formData.client_email} onChange={(e: any) => setFormData({ ...formData, client_email: e.target.value })} />
              <Input label="Teléfono de contacto" value={formData.client_phone} onChange={(e: any) => setFormData({ ...formData, client_phone: e.target.value })} />
            </div>
          </section>

          {/* SECCIÓN DE PRODUCTOS (Rediseñado) */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200/50 shadow-sm relative z-30 transition-all hover:shadow-xl hover:shadow-slate-200/40 duration-500">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              Selección de Equipos e Instalación
            </h4>

            <div className="space-y-10">
              <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-200/30">
                <div className="flex-1 relative group">
                  <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por marca o modelo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-16 pr-8 py-5 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-white font-bold italic transition-all shadow-sm"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-900/20' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50 hover:text-slate-600'}`}
                    >
                      {cat === 'all' ? 'Ver Todos' : cat.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                {filteredProducts.map(p => (
                  <div key={p.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 flex flex-col gap-8 group">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center p-5 shrink-0 border border-slate-100 group-hover:bg-white group-hover:shadow-inner transition-all duration-500">
                        {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain drop-shadow-lg" alt="" /> : <span className="text-[10px] font-black text-slate-200 uppercase">IMG</span>}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[11px] font-black uppercase text-blue-500 tracking-[0.2em] italic block mb-1">{p.brand}</span>
                        <h5 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-none truncate group-hover:text-blue-600 transition-colors">{p.model}</h5>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] block pl-1 italic">Variantes y Precios</span>
                      <div className="grid grid-cols-1 gap-3">
                        {(p.pricing || []).map((v: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => addItem(`${p.brand} ${p.model} - ${v.name?.[language] || v.name?.es || v.variant || 'Standard'}`, v.price, p.image_url, p.brand_logo_url)}
                            className="w-full flex justify-between items-center p-5 bg-slate-50/50 hover:bg-blue-600 hover:text-white border border-slate-100/50 rounded-2xl group/variant transition-all duration-300 shadow-sm"
                          >
                            <span className="text-[11px] font-black uppercase italic truncate mr-4 group-hover/variant:translate-x-1 transition-transform">{v.name?.[language] || v.name?.es || v.variant || 'Modelo Base'}</span>
                            <span className="text-sm font-black tabular-nums">{formatCurrency(v.price, language)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 mt-auto border-t border-slate-50 flex justify-between items-center">
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-all flex items-center gap-2"
                      >
                        Especificaciones y Kits
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-500">
                  <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden p-10 md:p-20 animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto relative border border-white/20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row justify-between items-start mb-16 gap-10 relative">
                      <div className="flex items-center gap-10">
                        <div className="w-40 h-40 bg-slate-50 rounded-[3rem] flex items-center justify-center p-8 shadow-inner border border-slate-100">
                          {selectedProduct.image_url && <img src={selectedProduct.image_url} className="w-full h-full object-contain drop-shadow-2xl" alt="" />}
                        </div>
                        <div>
                          <span className="text-sm font-black uppercase text-blue-500 tracking-[0.3em] italic mb-2 block">{selectedProduct.brand}</span>
                          <h5 className="text-4xl md:text-6xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedProduct.model}</h5>
                          <div className="h-1.5 w-24 bg-blue-600 rounded-full mt-6"></div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="w-16 h-16 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.5rem] hover:bg-red-50 hover:text-red-500 transition-all shadow-sm border border-slate-100 group"
                      >
                        <span className="text-4xl font-light group-hover:rotate-90 transition-transform">×</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 text-left relative">
                      {/* Kits */}
                      <div>
                        <h6 className="text-[12px] font-black uppercase text-slate-900 mb-8 pl-1 tracking-[0.3em] flex items-center gap-3 italic">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 italic"></div> Kits de Instalación
                        </h6>
                        <div className="space-y-4">
                          {((selectedProduct as any).installation_kits || []).length > 0 ? (
                            ((selectedProduct as any).installation_kits || []).map((k: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => { addItem(`INSTALACIÓN: ${k.name}`, k.price, selectedProduct.image_url, selectedProduct.brand_logo_url); setSelectedProduct(null); }}
                                className="w-full p-8 bg-slate-50/50 border border-slate-100 rounded-[2rem] text-left hover:border-blue-600 hover:bg-blue-50 transition-all flex justify-between items-center group shadow-sm"
                              >
                                <span className="text-[13px] font-black text-slate-700 uppercase italic">{k.name}</span>
                                <span className="text-lg font-black text-blue-600 bg-white px-5 py-2 rounded-2xl border border-blue-100 shadow-sm">{formatCurrency(k.price, language)}</span>
                              </button>
                            ))
                          ) : (
                            <p className="text-[11px] font-bold text-slate-300 uppercase italic p-8 text-center bg-slate-50 rounded-3xl">No hay kits configurados</p>
                          )}
                        </div>
                      </div>

                      {/* Extras */}
                      <div>
                        <h6 className="text-[12px] font-black uppercase text-slate-900 mb-8 pl-1 tracking-[0.3em] flex items-center gap-3 italic">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Accesorios y Extras
                        </h6>
                        <div className="flex flex-wrap gap-4">
                          {((selectedProduct as any).extras || []).length > 0 ? (
                            ((selectedProduct as any).extras || []).map((e: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => { addItem(e.name, e.unit_price || e.price, selectedProduct.image_url, selectedProduct.brand_logo_url); setSelectedProduct(null); }}
                                className="px-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-[11px] font-black text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-md group"
                              >
                                + {e.name.toUpperCase()} <span className="ml-2 text-blue-500 group-hover:text-blue-300">({e.unit_price || e.price}€)</span>
                              </button>
                            ))
                          ) : (
                            <p className="text-[11px] font-bold text-slate-300 uppercase italic w-full p-8 text-center bg-slate-50 rounded-3xl">No hay extras configurados</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-6">
                <button
                  onClick={() => addItem('', 0)}
                  className="w-full py-8 border-[3px] border-dashed border-slate-100 rounded-[2.5rem] text-[12px] font-black text-slate-300 uppercase tracking-[0.4em] hover:border-blue-500/30 hover:text-blue-600 hover:bg-blue-50/20 transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <span className="text-3xl font-light">+</span>
                  </div>
                  Añadir Concepto Manual
                </button>
              </div>
            </div>
          </section>

          {/* PRESUPUESTO DETALLADO (Rediseñado) */}
          <section className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200/50 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 duration-500">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              Presupuesto Detallado
            </h4>

            <div className="space-y-6">
              {(formData.items || []).map((item) => (
                <div key={item.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all animate-in slide-in-from-left-4 duration-500 group">
                  <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 italic">Concepto / Descripción</label>
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="w-full bg-white border border-slate-100 px-6 py-4 rounded-2xl text-sm font-bold uppercase truncate focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        placeholder="Ej: Instalación de equipo..."
                      />
                    </div>
                    <div className="w-full md:w-28 space-y-2 text-center">
                      <label className="text-[10px] font-black uppercase text-slate-400 italic">Cant.</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-100 px-4 py-4 rounded-2xl text-center text-sm font-black tabular-nums focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="w-full md:w-40 space-y-2 text-right">
                      <label className="text-[10px] font-black uppercase text-slate-400 pr-1 italic">Precio Ud.</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-100 pr-10 pl-6 py-4 rounded-2xl text-right text-sm font-black tabular-nums focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">€</span>
                      </div>
                    </div>
                    <div className="w-full md:w-48 pt-6 md:pt-6 text-right">
                      <p className="text-[9px] font-black uppercase text-slate-300 tracking-[0.2em] mb-1 italic pr-1">Total concepto</p>
                      <p className="text-2xl font-black text-slate-900 tabular-nums italic">{formatCurrency(item.total, language)}</p>
                    </div>
                    <div className="pt-6">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-12 h-12 flex items-center justify-center bg-white text-slate-300 rounded-2xl border border-slate-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all shadow-sm"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {(!formData.items || formData.items.length === 0) && (
                <div className="p-20 text-center border-4 border-dashed border-slate-50 rounded-[3rem] animate-pulse">
                  <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em] italic">No hay conceptos añadidos todavía</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA: RESUMEN (Rediseñado) */}
        <aside className="lg:col-span-4 sticky top-6 self-start space-y-8 z-[60] h-fit">
          <section className="bg-slate-900 p-10 md:p-12 rounded-[3.5rem] text-white shadow-2xl shadow-slate-900/40 relative overflow-hidden group/aside">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none transition-all group-hover/aside:scale-125 duration-1000"></div>

            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-400 mb-12 flex items-center gap-3 italic">
              <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
              Resumen Final
            </h4>

            <div className="space-y-8 relative">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">Base Imponible</span>
                  <span className="text-lg font-bold tabular-nums italic text-white/50">{formatCurrency(subtotal / 1.21, language)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">IVA (21%)</span>
                  <span className="text-lg font-bold tabular-nums italic text-white/50">{formatCurrency(subtotal - (subtotal / 1.21), language)}</span>
                </div>
                <div className="pt-6 border-t border-white/10">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em] mb-2 italic">Total a pagar</p>
                      <p className="text-6xl font-black text-white tracking-tighter tabular-nums italic drop-shadow-2xl">
                        {formatCurrency(subtotal, language).split(',')[0]}
                        <span className="text-2xl opacity-50">,{formatCurrency(subtotal, language).split(',')[1]}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financiación */}
              <div className="pt-10 border-t border-white/10 space-y-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 italic">Periodo de Financiación</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[12, 24, 36, 48, 60, 72].map((m) => (
                      <button
                        key={m}
                        onClick={() => setFormData({ ...formData, financing_months: m })}
                        className={`py-4 rounded-2xl text-[11px] font-black uppercase transition-all border ${formData.financing_months === m ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/30 -translate-y-1' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center justify-between group/fee hover:bg-white/10 transition-colors duration-500">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1 italic">Cuota Mensual</p>
                    <p className="text-3xl font-black text-white italic tracking-tighter tabular-nums group-hover/fee:scale-110 transition-transform origin-left">{formatCurrency(monthlyFee, language)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">TIN/TAE 0%*</p>
                  </div>
                </div>
              </div>

              <div className="pt-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1 italic">Validez de la oferta</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 px-6 py-4 rounded-2xl text-white text-sm font-black italic focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all uppercase"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-8 bg-blue-600 text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] shadow-2xl shadow-blue-600/30 hover:bg-blue-500 hover:scale-[1.03] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 group/save"
              >
                {isSaving ? (
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <>
                    CONFIRMAR Y GUARDAR
                    <svg className="w-6 h-6 group-hover/save:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Estado del presupuesto */}
          <section className="bg-white p-10 border border-slate-200/50 rounded-[3rem] shadow-sm">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 italic ml-1">Estado Operativo</label>
            <div className="flex flex-wrap gap-3">
              {['draft', 'sent', 'accepted', 'rejected'].map(stat => (
                <button
                  key={stat}
                  onClick={() => setFormData({ ...formData, status: stat as any })}
                  className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${formData.status === stat ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}
                >
                  {stat}
                </button>
              ))}
            </div>
          </section>

          {/* Quick Extras */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-8 italic">Materiales y Extras Rápidos</h4>
            <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
              {PDF_EXTRAS.map(e => (
                <button
                  key={e.name}
                  onClick={() => addItem(e.name, e.price)}
                  className="w-full text-left p-5 hover:bg-blue-50 rounded-2xl border border-transparent hover:border-blue-100 transition-all group flex justify-between items-center bg-slate-50/50"
                >
                  <span className="text-[11px] font-black text-slate-500 group-hover:text-slate-900 leading-tight pr-4 uppercase italic">{e.name}</span>
                  <span className="text-[11px] font-black text-blue-600 bg-white px-3 py-1 rounded-lg border border-blue-100/30 shadow-sm shrink-0">{e.price}€</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
