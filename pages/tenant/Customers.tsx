
import React, { useState, useEffect } from 'react';
// Import routing hooks from react-router to avoid export issues in react-router-dom
import { useOutletContext, useNavigate } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Customer, Quote } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';

interface CustomerWithQuoteCount extends Customer {
  quote_count?: number;
}

export const Customers = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerWithQuoteCount[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', dni: '', address: '', population: '' });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithQuoteCount | null>(null);
  const [customerQuotes, setCustomerQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);


  const fetchCustomers = async () => {
    // Validate tenant ID is a proper UUID before querying
    if (!tenant || !tenant.id || tenant.id.length < 30) {
      console.error('Invalid tenant ID:', tenant?.id);
      return;
    }

    console.log('[DEBUG] Fetching customers for tenant:', tenant.id);

    // Fetch customers first
    const { data: customersData, error } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name');

    if (error) {
      console.error('Error fetching customers:', error);
      return;
    }

    console.log('[DEBUG] Customers fetched:', customersData?.length || 0);

    if (customersData && customersData.length > 0) {
      // Fetch quote counts for each customer using a simpler approach
      const customersWithCount = await Promise.all(
        customersData.map(async (customer) => {
          const { data: quotesData, error: quotesError } = await supabase
            .from('quotes')
            .select('id')
            .eq('customer_id', customer.id)
            .eq('tenant_id', tenant.id);

          if (quotesError) {
            console.error('Error fetching quotes for customer:', customer.id, quotesError);
          }

          return {
            ...customer,
            quote_count: quotesData?.length || 0
          };
        })
      );

      setCustomers(customersWithCount);
    } else {
      setCustomers([]);
    }
  };


  useEffect(() => {
    if (tenant?.id) {
      fetchCustomers();
    }
  }, [tenant?.id]);

  const handleCreate = async () => {
    console.log('[DEBUG] Creating customer...', newCust);


    const customerData = {
      ...newCust,
      tenant_id: tenant.id
    };

    console.log('[DEBUG] Customer data to insert:', customerData);

    const { data, error } = await supabase.from('customers').insert([customerData]).select();

    if (error) {
      console.error('[ERROR] Failed to create customer:', error);
      alert(`Error: ${error.message}\n\nDetails: ${JSON.stringify(error, null, 2)}`);
    } else {
      console.log('[DEBUG] Customer created successfully:', data);
      setIsCreating(false);
      setNewCust({ name: '', email: '', phone: '', dni: '', address: '', population: '' });
      fetchCustomers();
    }
  };


  const handleCustomerClick = async (customer: CustomerWithQuoteCount) => {
    setSelectedCustomer(customer);
    setLoadingQuotes(true);

    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (data) setCustomerQuotes(data);
    setLoadingQuotes(false);
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    setCustomerQuotes([]);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      sent: 'bg-blue-100 text-blue-600',
      viewed: 'bg-purple-100 text-purple-600',
      accepted: 'bg-green-100 text-green-600',
      rejected: 'bg-red-100 text-red-600',
      expired: 'bg-orange-100 text-orange-600'
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{t('customers')}</h3>
        <button onClick={() => setIsCreating(true)} className="w-full md:w-auto px-8 py-3.5 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-brand-700 transition-all">+ Nuevo Cliente</button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-left">
            <Input label="Nombre" value={newCust.name} onChange={(e: any) => setNewCust({ ...newCust, name: e.target.value })} />
            <Input label="Email" value={newCust.email} onChange={(e: any) => setNewCust({ ...newCust, email: e.target.value })} />
            <Input label="Teléfono" value={newCust.phone} onChange={(e: any) => setNewCust({ ...newCust, phone: e.target.value })} />
            <Input label={t('dni')} value={newCust.dni} onChange={(e: any) => setNewCust({ ...newCust, dni: e.target.value })} />
            <Input label={t('address')} value={newCust.address} onChange={(e: any) => setNewCust({ ...newCust, address: e.target.value })} />
            <Input label={t('population')} value={newCust.population} onChange={(e: any) => setNewCust({ ...newCust, population: e.target.value })} />
          </div>
          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <button onClick={handleCreate} className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl tracking-widest">Guardar</button>
            <button onClick={() => setIsCreating(false)} className="w-full md:w-auto px-8 py-3 text-gray-400 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-[1.5rem] md:rounded-[2.8rem] overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Cliente</th>
              <th className="px-10 py-6">Teléfono</th>
              <th className="px-10 py-6">Email</th>
              <th className="px-10 py-6">Dirección</th>
              <th className="px-10 py-6 text-center"># Presupuestos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map(c => (
              <tr
                key={c.id}
                onClick={() => handleCustomerClick(c)}
                className="hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <td className="px-10 py-6 text-left">
                  <div className="font-black text-gray-900">{c.name}</div>
                  <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{c.dni || 'Sin DNI'}</div>
                </td>
                <td className="px-10 py-6 text-sm text-gray-500 text-left">
                  <span className="text-[10px] font-bold text-gray-400">{c.phone || '-'}</span>
                </td>
                <td className="px-10 py-6 text-sm text-gray-500 text-left">{c.email || '-'}</td>
                <td className="px-10 py-6 text-sm text-gray-500 text-left">
                  {c.address ? (
                    <div>
                      <div className="text-[10px] font-bold">{c.address}</div>
                      {c.population && <div className="text-[8px] text-gray-400">{c.population}</div>}
                    </div>
                  ) : '-'}
                </td>
                <td className="px-10 py-6 text-center">
                  <span className="inline-block px-3 py-1 bg-brand-50 text-brand-600 font-black text-[10px] rounded-full">
                    {c.quote_count || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Presupuestos */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-[2rem] max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-10 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Presupuestos de {selectedCustomer.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">{selectedCustomer.email}</p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 md:p-10 overflow-y-auto max-h-[calc(80vh-200px)]">
              {loadingQuotes ? (
                <div className="text-center py-10 text-gray-400">Cargando presupuestos...</div>
              ) : customerQuotes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No hay presupuestos para este cliente</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Nº Presupuesto</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Total</th>
                        <th className="px-6 py-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customerQuotes.map(quote => (
                        <tr key={quote.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(quote.created_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-gray-900">{quote.quote_no}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase ${getStatusBadge(quote.status)}`}>
                              {quote.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-900">
                            {quote.total_amount.toFixed(2)} €
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => navigate(`/t/${tenant.slug}/quotes/${quote.id}`)}
                              className="px-4 py-2 bg-brand-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-brand-700 transition-all"
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
