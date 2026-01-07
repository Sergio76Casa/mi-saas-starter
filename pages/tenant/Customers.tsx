
import React, { useState, useEffect } from 'react';
// Use react-router-dom for all web hooks
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant, Customer } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';

export const Customers = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', dni: '', address: '', population: '' });

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    if (data) setCustomers(data);
  };

  useEffect(() => { fetchCustomers(); }, [tenant.id]);

  const handleCreate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const ref = sessionStorage.getItem(`atribucion_${tenant.slug}`);
    const { error } = await supabase.from('customers').insert([{ ...newCust, tenant_id: tenant.id, created_by: session?.user?.id, referred_by: ref || null }]);
    if (error) alert(error.message);
    else { setIsCreating(false); setNewCust({ name: '', email: '', phone: '', dni: '', address: '', population: '' }); fetchCustomers(); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{t('customers')}</h3>
        <button onClick={() => setIsCreating(true)} className="w-full md:w-auto px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Nuevo Cliente</button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
             <Input label="Nombre" value={newCust.name} onChange={(e:any) => setNewCust({...newCust, name: e.target.value})} />
             <Input label="Email" value={newCust.email} onChange={(e:any) => setNewCust({...newCust, email: e.target.value})} />
             <Input label="Teléfono" value={newCust.phone} onChange={(e:any) => setNewCust({...newCust, phone: e.target.value})} />
             <Input label={t('dni')} value={newCust.dni} onChange={(e:any) => setNewCust({...newCust, dni: e.target.value})} />
             <Input label={t('address')} value={newCust.address} onChange={(e:any) => setNewCust({...newCust, address: e.target.value})} />
             <Input label={t('population')} value={newCust.population} onChange={(e:any) => setNewCust({...newCust, population: e.target.value})} />
           </div>
           <div className="flex flex-col md:flex-row gap-4">
             <button onClick={handleCreate} className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl">Guardar</button>
             <button onClick={() => setIsCreating(false)} className="w-full md:w-auto px-8 py-3 text-gray-400 text-[10px] font-black uppercase">Cancelar</button>
           </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-[1.5rem] md:rounded-[2.8rem] overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr><th className="px-10 py-6">Cliente</th><th className="px-10 py-6">Contacto</th><th className="px-10 py-6 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-10 py-6">
                  <div className="font-black text-gray-900">{c.name}</div>
                  <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{c.dni || 'Sin DNI'}</div>
                </td>
                <td className="px-10 py-6 text-sm text-gray-500">{c.email} <br/> <span className="text-[10px] font-bold text-gray-400">{c.phone}</span></td>
                <td className="px-10 py-6 text-right"><button className="text-brand-600 font-black text-[9px] uppercase tracking-widest">Ver Ficha</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
