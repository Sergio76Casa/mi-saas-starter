
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, useParams, useSearchParams } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Quote, Customer, QuoteItem, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { formatCurrency, formatDate } from '../../i18n';
import { PDF_EXTRAS, FINANCING_COEFFICIENTS } from '../../data/pdfCatalog';
import { Input } from '../../components/common/Input';

export const QuoteEditor = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, language } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: custData } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
        if (custData) setCustomers(custData);

        const { data: prodData } = await supabase.from('products')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .or('is_deleted.eq.false,is_deleted.is.null');
        if (prodData) setProducts(prodData as Product[]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tenant.id]);

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
    return subtotal * coeff;
  }, [subtotal, formData.financing_months]);

  const updateItem = (id: string, field: keyof QuoteItem, val: any) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: val };
          if (field === 'quantity' || field === 'unit_price') {
            updated.total = (updated.quantity || 0) * (updated.unit_price || 0);
          }
          return updated;
        }
        return item;
      })
    }));
  };

  const removeItem = (id: string) => {
    setFormData(prev => ({ ...prev, items: (prev.items || []).filter(item => item.id !== id) }));
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
    } else {
      setFormData(prev => ({
        ...prev,
        customer_id: undefined,
        client_name: '',
        client_email: '',
        client_phone: '',
        client_dni: '',
        client_address: '',
        client_population: ''
      }));
    }
  };

  const syncCustomer = async () => {
    if (!formData.client_email) return null;

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('email', formData.client_email)
      .single();

    const customerPayload = {
      tenant_id: tenant.id,
      name: formData.client_name,
      email: formData.client_email,
      phone: formData.client_phone,
      address: formData.client_address,
      dni: formData.client_dni,
      population: formData.client_population
    };

    if (existingCustomer) {
      const { data } = await supabase.from('customers').update(customerPayload).eq('id', existingCustomer.id).select().single();
      return data?.id;
    } else {
      const { data } = await supabase.from('customers').insert([customerPayload]).select().single();
      return data?.id;
    }
  };

  const handleSave = async () => {
    if (!formData.client_name || !formData.client_email) {
      alert("Por favor, completa al menos el nombre y email del cliente.");
      return;
    }

    setLoading(true);
    try {
      const customerId = await syncCustomer();
      const isNew = id === 'new';

      const quotePayload = {
        tenant_id: tenant.id,
        customer_id: customerId,
        quote_no: formData.quote_no || `MAN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        client_dni: formData.client_dni,
        client_address: formData.client_address,
        client_population: formData.client_population,
        total_amount: subtotal,
        status: formData.status || 'draft',
        valid_until: formData.valid_until,
        financing_months: formData.financing_months,
        financing_fee: monthlyFee,
        maintenance_no: formData.maintenance_no,
        is_technician: false
      };

      let quoteData;
      if (isNew) {
        const { data, error } = await supabase.from('quotes').insert([quotePayload]).select().single();
        if (error) throw error;
        quoteData = data;
      } else {
        const { data, error } = await supabase.from('quotes').update(quotePayload).eq('id', id).select().single();
        if (error) throw error;
        quoteData = data;
      }

      if (quoteData) {
        if (!isNew) {
          await supabase.from('quote_items').delete().eq('quote_id', quoteData.id);
        }

        const itemsToSave = (formData.items || []).map(item => ({
          quote_id: quoteData.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        }));

        if (itemsToSave.length > 0) {
          const { error: itemsError } = await supabase.from('quote_items').insert(itemsToSave);
          if (itemsError) throw itemsError;
        }
      }

      navigate(`/t/${tenant.slug}/quotes`);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-700 pb-32 px-4 md:px-0 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h3 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase italic">{t('new_quote')}</h3>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mt-2">Ref: {formData.quote_no || 'MANIONAL-XXXX'}</p>
        </div>
        <div className="flex w-full md:w-auto gap-4">
          <button onClick={() => navigate(-1)} className="flex-1 md:flex-none px-6 py-4 text-gray-400 text-[10px] font-black uppercase border border-gray-100 rounded-2xl">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="flex-2 md:flex-none px-12 py-4 bg-brand-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:bg-brand-700 transition-all">
            {loading ? '...' : 'Finalizar Presupuesto'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">
          {/* Datos del Cliente */}
          <section className="bg-white p-6 md:p-10 rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span> Datos del Cliente
            </h4>

            <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100/50">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Buscar Cliente Existente</label>
              <select
                onChange={(e) => handleCustomerSelect(e.target.value)}
                value={formData.customer_id || ''}
                className="w-full px-5 py-4 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-brand-500 outline-none font-bold italic"
              >
                <option value="">-- CLIENTE NUEVO (Rellenar manualmente) --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <Input label="Nombre del Cliente" value={formData.client_name} onChange={(e: any) => setFormData({ ...formData, client_name: e.target.value })} />
              <Input label="Email" type="email" value={formData.client_email} onChange={(e: any) => setFormData({ ...formData, client_email: e.target.value })} />
              <Input label="Teléfono" value={formData.client_phone} onChange={(e: any) => setFormData({ ...formData, client_phone: e.target.value })} />
              <Input label={t('dni')} value={formData.client_dni} onChange={(e: any) => setFormData({ ...formData, client_dni: e.target.value })} />
              <div className="md:col-span-2">
                <Input label={t('address')} value={formData.client_address} onChange={(e: any) => setFormData({ ...formData, client_address: e.target.value })} />
              </div>
              <Input label={t('population')} value={formData.client_population} onChange={(e: any) => setFormData({ ...formData, client_population: e.target.value })} />
              <Input label="Número de Orden (WO#)" value={formData.maintenance_no} onChange={(e: any) => setFormData({ ...formData, maintenance_no: e.target.value })} />
            </div>
          </section>

          {/* Selección de Equipos */}
          <section className="bg-white p-6 md:p-10 rounded-[2.8rem] border border-gray-100 shadow-sm relative z-30">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span> Selección de Equipos e Instalación
            </h4>

            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Buscar por marca o modelo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-6 pr-10 py-4 text-sm border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50 font-bold"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border ${activeCategory === cat ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}
                    >
                      {cat === 'all' ? 'Todos' : cat.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredProducts.map(p => (
                  <div key={p.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center p-3 shrink-0">
                        {p.image_url ? <img src={p.image_url} className="w-full h-full object-contain" alt="" /> : <span className="text-[10px] font-black text-gray-200 uppercase">IMG</span>}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[9px] font-black uppercase text-brand-500 tracking-widest">{p.brand}</span>
                        <h5 className="text-lg font-black text-gray-900 uppercase italic tracking-tighter leading-none truncate">{p.model}</h5>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[9px] font-black uppercase text-gray-300 tracking-widest block pl-1">Variantes y Precios</span>
                      <div className="grid grid-cols-1 gap-2">
                        {(p.pricing || []).map((v: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => addItem(`${p.brand} ${p.model} - ${v.name?.[language] || v.name?.es || v.variant || 'Standard'}`, v.price)}
                            className="w-full flex justify-between items-center p-3 bg-gray-50/50 hover:bg-brand-50 border border-gray-100/50 rounded-xl group transition-all"
                          >
                            <span className="text-[10px] font-bold text-gray-600 truncate mr-2">{v.name?.[language] || v.name?.es || v.variant || 'Modelo Base'}</span>
                            <span className="text-[11px] font-black text-brand-600 shrink-0">{formatCurrency(v.price, language)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 mt-auto border-t border-gray-50 flex justify-between items-center">
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="text-[9px] font-black uppercase text-gray-400 hover:text-brand-600 transition-colors"
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
                        <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center p-4 shadow-sm border border-gray-100">
                          {selectedProduct.image_url && <img src={selectedProduct.image_url} className="w-full h-full object-contain" alt="" />}
                        </div>
                        <div>
                          <span className="text-[11px] font-black uppercase text-brand-500 tracking-widest">{selectedProduct.brand}</span>
                          <h5 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">{selectedProduct.model}</h5>
                        </div>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="w-12 h-12 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all text-2xl font-black shadow-sm">×</button>
                    </div>

                    <div className="space-y-10">
                      {/* Kits */}
                      {((selectedProduct as any).installation_kits || []).length > 0 && (
                        <div>
                          <h6 className="text-[10px] font-black uppercase text-gray-400 mb-5 pl-1 tracking-widest border-b border-gray-100 pb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Kits de Instalación Recomendados
                          </h6>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {((selectedProduct as any).installation_kits || []).map((k: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => { addItem(`INSTALACIÓN: ${k.name}`, k.price); setSelectedProduct(null); }}
                                className="p-5 bg-gray-50/50 border border-gray-100 rounded-2xl text-left hover:border-brand-600 hover:bg-brand-50 transition-all flex justify-between items-center group shadow-sm"
                              >
                                <span className="text-[11px] font-bold text-gray-700">{k.name}</span>
                                <span className="text-[13px] font-black text-brand-600 bg-white px-3 py-1 rounded-lg border border-brand-100/50">{formatCurrency(k.price, language)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extras */}
                      {((selectedProduct as any).extras || []).length > 0 && (
                        <div>
                          <h6 className="text-[10px] font-black uppercase text-gray-400 mb-5 pl-1 tracking-widest border-b border-gray-100 pb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Complementos y Extras
                          </h6>
                          <div className="flex flex-wrap gap-2">
                            {((selectedProduct as any).extras || []).map((e: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => { addItem(e.name, e.unit_price || e.price); setSelectedProduct(null); }}
                                className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-[11px] font-black text-gray-600 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-all shadow-sm"
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
                  className="w-full py-5 border-2 border-dashed border-gray-100 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">+</span> Añadir Línea Personalizada
                </button>
              </div>
            </div>
          </section>

          {/* Tabla de Items */}
          <section className="bg-white p-6 md:p-10 rounded-[2.8rem] border border-gray-100 shadow-sm min-h-[400px]">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span> Presupuesto Detallado
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="text-[9px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-50">
                  <tr>
                    <th className="py-4">Vincular Concepto</th>
                    <th className="py-4 text-center">Cant.</th>
                    <th className="py-4 text-right">Precio Unitario</th>
                    <th className="py-4 text-right">Subtotal</th>
                    <th className="py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/50">
                  {(formData.items || []).map(item => (
                    <tr key={item.id} className="text-sm group">
                      <td className="py-6">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-black text-gray-800 placeholder:text-gray-200 uppercase italic text-sm"
                          placeholder="Nombre del concepto o servicio..."
                        />
                      </td>
                      <td className="py-6">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-16 mx-auto block bg-gray-50 border border-gray-100 rounded-xl py-2 px-1 text-center font-black"
                        />
                      </td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-24 bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-right font-black text-brand-600"
                          />
                          <span className="text-[10px] font-black text-gray-300">€</span>
                        </div>
                      </td>
                      <td className="py-6 text-right font-black text-gray-900 tabular-nums">{formatCurrency(item.total, language)}</td>
                      <td className="py-6 text-right">
                        <button onClick={() => removeItem(item.id)} className="w-10 h-10 flex items-center justify-center text-red-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all text-2xl">×</button>
                      </td>
                    </tr>
                  ))}
                  {(!formData.items || formData.items.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-gray-200 uppercase font-black tracking-widest text-[10px]">El presupuesto está vacío</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sidebar Sticky */}
        <aside className="lg:col-span-4 space-y-8 h-full">
          <div className="sticky top-6 z-40 transition-all space-y-6">
            {/* Calculadora Total */}
            <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500/20 blur-[100px] rounded-full"></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-400 mb-10">Resumen de Inversión</h4>

              <div className="space-y-6 mb-12">
                <div className="flex justify-between items-center text-sm opacity-50 font-black uppercase tracking-widest">
                  <span>Suma Conceptos</span>
                  <span className="tabular-nums">{formatCurrency(subtotal, language)}</span>
                </div>
                <div className="flex flex-col gap-2 pt-8 border-t border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Total IVA Incluído</span>
                  <div className="text-4xl md:text-5xl font-black italic tracking-tighter text-white tabular-nums drop-shadow-xl">{formatCurrency(subtotal, language)}</div>
                </div>
              </div>

              <div className="pt-10 border-t border-white/10 space-y-8">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-400 block mb-5">Plan de Financiación</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[12, 24, 36, 48, 60].map(m => (
                      <button
                        key={m}
                        onClick={() => setFormData({ ...formData, financing_months: m })}
                        className={`py-3 rounded-2xl text-[11px] font-black border transition-all ${formData.financing_months === m ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                      >
                        {m}M
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                  <div className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Cuota Mensual Estimada</div>
                  <div className="text-3xl font-black text-brand-400 tabular-nums italic">{formatCurrency(monthlyFee, language)}</div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 text-[9px] text-slate-500 text-center uppercase font-black tracking-widest">
                Validez de oferta hasta el {formatDate(formData.valid_until || '', language)}
              </div>
            </div>

            {/* Extras Rápidos */}
            <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl max-h-[500px] overflow-auto custom-scrollbar">
              <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-8 border-b border-gray-50 pb-5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Extras y Materiales
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {PDF_EXTRAS.map(e => (
                  <button
                    key={e.name}
                    onClick={() => addItem(e.name, e.price)}
                    className="w-full text-left p-5 hover:bg-brand-50 rounded-2xl border border-transparent hover:border-brand-100 transition-all group flex justify-between items-center bg-gray-50/50 active:scale-[0.98]"
                  >
                    <span className="text-[11px] font-black text-gray-600 group-hover:text-brand-700 uppercase leading-tight pr-4">{e.name}</span>
                    <span className="text-[12px] font-black text-brand-600 bg-white px-3 py-1 rounded-lg shrink-0 shadow-sm">{e.price}€</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Floating Action Button (Mobile Only) */}
      <div className="lg:hidden fixed bottom-6 left-4 right-4 z-[60] bg-slate-900 p-6 rounded-[2.5rem] shadow-3xl flex justify-between items-center text-white border border-white/10 border-b-4 border-b-brand-600 animate-in slide-in-from-bottom-10">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase text-brand-400 tracking-widest">Total Inversión</span>
          <span className="text-2xl font-black italic tabular-nums">{formatCurrency(subtotal, language)}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-10 py-4 bg-brand-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
        >
          {loading ? '...' : 'FINALIZAR'}
        </button>
      </div>
    </div>
  );
};
