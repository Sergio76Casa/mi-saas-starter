
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

  const [formData, setFormData] = useState<Partial<Quote>>({
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
    financing_months: 12
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

  const addItem = (description: string, price: number) => {
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      description,
      quantity: 1,
      unit_price: price,
      total: price
    } as any;
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
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
        quote_no: formData.quote_no || `PRE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
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
    <div className="max-w-7xl mx-auto animate-in fade-in duration-700 pb-24 px-4 md:px-0 text-left relative">
      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl animate-bounce">
          {showToast}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h3 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase italic">{id === 'new' ? t('new_quote') : 'Editar Presupuesto'}</h3>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-2">Ref: {formData.quote_no || 'Temporal'}</p>
        </div>
        <div className="flex w-full md:w-auto gap-4">
          <button onClick={() => navigate(-1)} className="flex-1 md:flex-none px-6 py-3 text-gray-400 text-[10px] font-black uppercase border border-gray-100 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-2 md:flex-none px-10 py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'GUARDANDO...' : 'Guardar borrador'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
        <div className="lg:col-span-8 space-y-8">

          {/* SECCIÓN COMPARTIR (AI Studio feature) */}
          {id !== 'new' && (
            <section className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-600/20 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Presupuesto listo</h4>
                <p className="text-xl font-black italic tracking-tight leading-none uppercase">Enviar enlace de firma al cliente</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={handleWhatsAppShare}
                  className="flex-1 md:flex-none px-6 py-3 bg-white text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412s-1.239 6.167-3.488 8.413c-2.248 2.244-5.231 3.484-8.411 3.484h-.001c-2.008 0-3.975-.521-5.714-1.506l-6.276 1.649zm6.151-3.692l.332.197c1.472.873 3.136 1.335 4.845 1.335h.001c5.446 0 9.876-4.43 9.878-9.876.001-2.64-1.029-5.12-2.899-6.992s-4.353-2.901-6.993-2.902c-5.448 0-9.879 4.432-9.881 9.879 0 1.83.509 3.618 1.474 5.176l.216.35-.97 3.541 3.633-.953z" /></svg>
                  WhatsApp
                </button>
                <button
                  onClick={copyLink}
                  className="flex-1 md:flex-none px-6 py-3 bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-800 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  Link
                </button>
              </div>
            </section>
          )}

          <section className="bg-white p-6 md:p-10 rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Datos del Cliente
            </h4>

            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100/50">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Seleccionar Cliente Existente</label>
              <select
                onChange={(e) => handleCustomerSelect(e.target.value)}
                value={formData.customer_id || ''}
                className="w-full px-5 py-4 border border-slate-200 rounded-xl bg-white text-sm font-bold italic focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">-- Nuevo Cliente --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <Input label="Nombre del cliente" value={formData.client_name} onChange={(e: any) => setFormData({ ...formData, client_name: e.target.value })} />
              <Input label={t('dni')} value={formData.client_dni} onChange={(e: any) => setFormData({ ...formData, client_dni: e.target.value })} />
              <div className="md:col-span-2">
                <Input label={t('address')} value={formData.client_address} onChange={(e: any) => setFormData({ ...formData, client_address: e.target.value })} />
              </div>
              <Input label={t('population')} value={formData.client_population} onChange={(e: any) => setFormData({ ...formData, client_population: e.target.value })} />
              <Input label={t('maintenance_no')} value={formData.maintenance_no} onChange={(e: any) => setFormData({ ...formData, maintenance_no: e.target.value })} />
              <Input label="Email" type="email" value={formData.client_email} onChange={(e: any) => setFormData({ ...formData, client_email: e.target.value })} />
              <Input label="Teléfono" value={formData.client_phone} onChange={(e: any) => setFormData({ ...formData, client_phone: e.target.value })} />
            </div>
          </section>

          {/* SECCIÓN DE PRODUCTOS (Local restore with categories) */}
          <section className="bg-white p-6 md:p-10 rounded-[2.8rem] border border-gray-100 shadow-sm relative z-30">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Selección de Equipos e Instalación
            </h4>

            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Buscar por marca o modelo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-6 pr-10 py-4 text-sm border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                    >
                      {cat === 'all' ? 'Todos' : cat.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredProducts.map(p => (
                  <div key={p.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center p-3 shrink-0">
                        {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain" alt="" /> : <span className="text-[10px] font-black text-slate-200 uppercase">IMG</span>}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">{p.brand}</span>
                        <h5 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter leading-none truncate">{p.model}</h5>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest block pl-1">Variantes y Precios</span>
                      <div className="grid grid-cols-1 gap-2">
                        {(p.pricing || []).map((v: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => addItem(`${p.brand} ${p.model} - ${v.name?.[language] || v.name?.es || v.variant || 'Standard'}`, v.price)}
                            className="w-full flex justify-between items-center p-3 bg-slate-50/50 hover:bg-blue-50 border border-slate-100/50 rounded-xl group transition-all"
                          >
                            <span className="text-[10px] font-bold text-slate-600 truncate mr-2">{v.name?.[language] || v.name?.es || v.variant || 'Modelo Base'}</span>
                            <span className="text-[11px] font-black text-blue-600 shrink-0">{formatCurrency(v.price, language)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 mt-auto border-t border-slate-50 flex justify-between items-center">
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        Ver Kits y Detalles →
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                  <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden p-8 md:p-12 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-start mb-10">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center p-4 shadow-sm border border-slate-100">
                          {selectedProduct.image_url && <img src={selectedProduct.image_url} className="w-full h-full object-contain" alt="" />}
                        </div>
                        <div>
                          <span className="text-[11px] font-black uppercase text-blue-500 tracking-widest">{selectedProduct.brand}</span>
                          <h5 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedProduct.model}</h5>
                        </div>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all text-2xl font-black shadow-sm">×</button>
                    </div>

                    <div className="space-y-10 text-left">
                      {/* Kits */}
                      {((selectedProduct as any).installation_kits || []).length > 0 && (
                        <div>
                          <h6 className="text-[10px] font-black uppercase text-slate-400 mb-5 pl-1 tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Kits de Instalación Recomendados
                          </h6>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {((selectedProduct as any).installation_kits || []).map((k: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => { addItem(`INSTALACIÓN: ${k.name}`, k.price); setSelectedProduct(null); }}
                                className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl text-left hover:border-blue-600 hover:bg-blue-50 transition-all flex justify-between items-center group shadow-sm"
                              >
                                <span className="text-[11px] font-bold text-slate-700">{k.name}</span>
                                <span className="text-[13px] font-black text-blue-600 bg-white px-3 py-1 rounded-lg border border-blue-100/50">{formatCurrency(k.price, language)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extras (Modal context) */}
                      {((selectedProduct as any).extras || []).length > 0 && (
                        <div>
                          <h6 className="text-[10px] font-black uppercase text-slate-400 mb-5 pl-1 tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Complementos y Extras
                          </h6>
                          <div className="flex flex-wrap gap-2">
                            {((selectedProduct as any).extras || []).map((e: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => { addItem(e.name, e.unit_price || e.price); setSelectedProduct(null); }}
                                className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                              >
                                + {e.name} ({e.unit_price || e.price}€)
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => addItem('', 0)}
                  className="w-full py-5 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">+</span> Añadir Concepto Manual
                </button>
              </div>
            </div>
          </section>

          {/* Tabla de Items */}
          <section className="bg-white p-6 md:p-10 rounded-[2.8rem] border border-gray-100 shadow-sm min-h-[400px]">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Presupuesto Detallado
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="text-[9px] font-black uppercase tracking-widest text-slate-300 border-b border-slate-50">
                  <tr>
                    <th className="py-4 px-2">Concepto</th>
                    <th className="py-4 text-center">Cant.</th>
                    <th className="py-4 text-right">Precio Unitario</th>
                    <th className="py-4 text-right">Total</th>
                    <th className="py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {(formData.items || []).map(item => (
                    <tr key={item.id} className="text-sm group hover:bg-slate-50 transition-colors">
                      <td className="py-6 px-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-black text-slate-800 placeholder:text-slate-200 uppercase italic text-sm"
                          placeholder="Descripción..."
                        />
                      </td>
                      <td className="py-6">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-16 mx-auto block bg-white border border-slate-100 rounded-xl py-2 px-1 text-center font-black"
                        />
                      </td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-24 bg-white border border-slate-100 rounded-xl py-2 px-3 text-right font-black text-blue-600"
                          />
                          <span className="text-[10px] font-black text-slate-300">€</span>
                        </div>
                      </td>
                      <td className="py-6 text-right font-black text-slate-900 tabular-nums">{formatCurrency(item.total, language)}</td>
                      <td className="py-6 text-right">
                        <button onClick={() => removeItem(item.id)} className="w-10 h-10 flex items-center justify-center text-red-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all text-2xl">×</button>
                      </td>
                    </tr>
                  ))}
                  {(!formData.items || formData.items.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-200 uppercase font-black tracking-widest text-[10px]">El presupuesto está vacío</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[3rem] shadow-2xl relative overflow-hidden lg:sticky lg:top-10">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 blur-[80px] rounded-full"></div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-8 italic">Resumen Presupuesto</h4>

            <div className="space-y-4 mb-10">
              <div className="flex justify-between text-sm opacity-60">
                <span>Subtotal base</span>
                <span>{formatCurrency(subtotal, language)}</span>
              </div>
              <div className="flex justify-between text-4xl font-black pt-6 border-t border-white/10 italic tracking-tighter">
                <span>TOTAL</span>
                <span>{formatCurrency(subtotal, language)}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase text-center mt-2">IVA e instalación incluidos</p>
            </div>

            <div className="pt-8 border-t border-white/10">
              <label className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-4 italic">Opciones de Financiación</label>
              <div className="grid grid-cols-5 gap-1.5 mb-6">
                {[12, 24, 36, 48, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => setFormData({ ...formData, financing_months: m })}
                    className={`py-3 rounded-xl text-[10px] font-black border transition-all ${formData.financing_months === m ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <div className="bg-white/5 p-6 rounded-2xl text-center border border-white/5">
                <div className="text-[9px] font-black uppercase text-slate-500 mb-2 tracking-widest">Cuota Mensual Estimada</div>
                <div className="text-3xl font-black text-blue-500 italic tracking-tighter">{formatCurrency(monthlyFee, language)}</div>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all disabled:opacity-50"
              >
                {isSaving ? 'GUARDANDO...' : 'Actualizar borrador'}
              </button>
              <p className="text-[8px] text-slate-500 text-center uppercase font-black italic">
                Válido hasta el {formatDate(formData.valid_until || '', language)}
              </p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6 italic">Materiales y Extras Rápidos</h4>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
              {PDF_EXTRAS.map(e => (
                <button
                  key={e.name}
                  onClick={() => addItem(e.name, e.price)}
                  className="w-full text-left p-4 hover:bg-blue-50 rounded-2xl border border-transparent hover:border-blue-100 transition-all group flex justify-between items-center bg-slate-50/50"
                >
                  <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-900 leading-tight pr-4">{e.name}</span>
                  <span className="text-[10px] font-black text-blue-600 shrink-0">{e.price}€</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
