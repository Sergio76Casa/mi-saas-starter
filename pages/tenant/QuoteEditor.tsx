
import React, { useState, useEffect, useMemo } from 'react';
// Import routing hooks from react-router to avoid export issues in react-router-dom
import { useOutletContext, useNavigate, useParams, useSearchParams } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Quote, Customer, QuoteItem } from '../../types';
import { useApp } from '../../AppProvider';
import { formatCurrency, formatDate } from '../../i18n';
import { PDF_PRODUCTS, PDF_KITS, PDF_EXTRAS, FINANCING_COEFFICIENTS } from '../../data/pdfCatalog';
import { Input } from '../../components/common/Input';

export const QuoteEditor = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, language } = useApp();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
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
    const fetchCustomers = async () => {
      const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
      if (data) setCustomers(data);
    };
    fetchCustomers();
    
    const productId = searchParams.get('productId');
    if (productId && id === 'new') {
      const product = PDF_PRODUCTS.find(p => p.id === productId);
      if (product) {
        addItem(product.name, product.price);
      }
    }
  }, [tenant.id, id, searchParams]);

  const subtotal = useMemo(() => {
    return (formData.items || []).reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  }, [formData.items]);

  const monthlyFee = useMemo(() => {
    if (!formData.financing_months) return 0;
    const coeff = FINANCING_COEFFICIENTS[formData.financing_months];
    return subtotal * coeff;
  }, [subtotal, formData.financing_months]);

  const updateItemQty = (id: string, qty: number) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(item => item.id === id ? { ...item, quantity: qty, total: qty * item.unit_price } : item)
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
    }
  };

  const handleSave = async () => {
    setLoading(true);
    console.log("Saving Quote:", { ...formData, total_amount: subtotal, financing_fee: monthlyFee });
    setTimeout(() => {
      setLoading(false);
      navigate(`/t/${tenant.slug}/quotes`);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-700 pb-24 px-4 md:px-0 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h3 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter uppercase italic">{t('new_quote')}</h3>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mt-2">Ref: {new Date().getFullYear()}-XXXX</p>
        </div>
        <div className="flex w-full md:w-auto gap-4">
          <button onClick={() => navigate(-1)} className="flex-1 md:flex-none px-6 py-3 text-gray-400 text-[10px] font-black uppercase border border-gray-100 rounded-xl">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="flex-2 md:flex-none px-10 py-4 bg-brand-600 text-white rounded-xl md:rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">
            {loading ? '...' : 'Finalizar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span> Datos del Cliente
            </h4>
            
            <div className="mb-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Seleccionar de Base de Datos</label>
              <select 
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">-- Nuevo Cliente --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <Input label="Nombre" value={formData.client_name} onChange={(e:any) => setFormData({...formData, client_name: e.target.value})} />
              <Input label={t('dni')} value={formData.client_dni} onChange={(e:any) => setFormData({...formData, client_dni: e.target.value})} />
              <div className="md:col-span-2">
                <Input label={t('address')} value={formData.client_address} onChange={(e:any) => setFormData({...formData, client_address: e.target.value})} />
              </div>
              <Input label={t('population')} value={formData.client_population} onChange={(e:any) => setFormData({...formData, client_population: e.target.value})} />
              <Input label={t('maintenance_no')} value={formData.maintenance_no} onChange={(e:any) => setFormData({...formData, client_name: e.target.value})} />
            </div>
          </section>

          <section className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span> Conceptos del Presupuesto
            </h4>
            
            <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 mb-8">
              <table className="w-full text-left min-w-[500px]">
                <thead className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50">
                  <tr>
                    <th className="py-4">Descripción</th>
                    <th className="py-4 text-center">Cant.</th>
                    <th className="py-4 text-right">Precio</th>
                    <th className="py-4 text-right">Total</th>
                    <th className="py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(formData.items || []).map(item => (
                    <tr key={item.id} className="text-sm">
                      <td className="py-4 font-bold text-gray-700">{item.description}</td>
                      <td className="py-4">
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => updateItemQty(item.id, parseInt(e.target.value))}
                          className="w-16 mx-auto block bg-gray-50 border border-gray-100 rounded-lg py-1 px-2 text-center"
                        />
                      </td>
                      <td className="py-4 text-right text-gray-400">{formatCurrency(item.unit_price, language)}</td>
                      <td className="py-4 text-right font-black text-gray-900">{formatCurrency(item.total, language)}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 px-2 text-xl">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-3">Modelos Comfee (PDF)</span>
                <div className="flex flex-wrap gap-2">
                  {PDF_PRODUCTS.map(p => (
                    <button key={p.name} onClick={() => addItem(p.name, p.price)} className="px-3 py-2 md:px-4 md:py-2 bg-gray-50 hover:bg-brand-50 hover:text-brand-600 border border-gray-100 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all">{p.name}</button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-3">Kits de Instalación</span>
                <div className="flex flex-wrap gap-2">
                  {PDF_KITS.map(k => (
                    <button key={k.name} onClick={() => addItem(k.name, k.price)} className="px-3 py-2 md:px-4 md:py-2 bg-gray-50 hover:bg-brand-50 hover:text-brand-600 border border-gray-100 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all">{k.name}</button>
                  ))}
                </div>
              </div>

              <div>
                <button 
                  onClick={() => addItem('Concepto Manual', 0)}
                  className="w-full py-4 border-2 border-dashed border-gray-100 rounded-xl md:rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-brand-500 hover:text-brand-600 transition-all"
                >
                  + Añadir Concepto Personalizado
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <div className="bg-slate-900 text-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] shadow-2xl relative overflow-hidden lg:sticky lg:top-32">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500/20 blur-[80px] rounded-full"></div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 mb-8">Resumen Total (IVA incl.)</h4>
            
            <div className="space-y-4 mb-10">
              <div className="flex justify-between text-sm opacity-60">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, language)}</span>
              </div>
              <div className="flex justify-between text-3xl md:text-4xl font-black pt-4 border-t border-white/10">
                <span>TOTAL</span>
                <span>{formatCurrency(subtotal, language)}</span>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10">
              <label className="text-[9px] font-black uppercase tracking-widest text-brand-400 block mb-4">Financiación</label>
              <div className="grid grid-cols-5 gap-1 mb-6">
                {[12, 24, 36, 48, 60].map(m => (
                  <button 
                    key={m} 
                    onClick={() => setFormData({...formData, financing_months: m})}
                    className={`py-2 rounded-lg text-[10px] font-black border transition-all ${formData.financing_months === m ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <div className="bg-white/5 p-4 md:p-6 rounded-2xl text-center">
                 <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Cuota Mensual Est.</div>
                 <div className="text-xl md:text-2xl font-black text-brand-500">{formatCurrency(monthlyFee, language)}</div>
              </div>
            </div>

            <div className="mt-8 text-[9px] text-slate-500 text-center uppercase font-black leading-relaxed">
              Hasta {formatDate(formData.valid_until || '', language)}
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 max-h-[400px] overflow-auto shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6">Materiales Extras</h4>
            <div className="space-y-2">
              {PDF_EXTRAS.map(e => (
                <button 
                  key={e.name} 
                  onClick={() => addItem(e.name, e.price)}
                  className="w-full text-left p-3 md:p-4 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all group flex justify-between items-center"
                >
                  <span className="text-[10px] md:text-[11px] font-bold text-gray-600 group-hover:text-gray-900 leading-tight pr-2">{e.name}</span>
                  <span className="text-[10px] font-black text-brand-600 shrink-0">{e.price}€</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
