
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';

export const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'free' });
  const { dbHealthy } = useApp();

  const fetchTenants = async () => {
    if (!dbHealthy) return;
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) setTenants(data as any);
  };

  useEffect(() => { fetchTenants(); }, [dbHealthy]);

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug) return alert("Rellena nombre y slug");
    const { error } = await supabase.from('tenants').insert([newTenant]);
    if (!error) { setIsCreating(false); setNewTenant({ name: '', slug: '', plan: 'free' }); fetchTenants(); }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Directorio</h3>
        <button onClick={() => setIsCreating(true)} className="w-full sm:w-auto px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Empresa</button>
      </div>
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] w-full max-w-md shadow-2xl">
              <h4 className="text-xl font-black text-white mb-6">Nuevo Registro</h4>
              <div className="space-y-4">
                 <input placeholder="Nombre de Empresa" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} />
                 <input placeholder="url-personalizada" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm" value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} />
              </div>
              <div className="flex gap-4 mt-10"><button onClick={handleCreateTenant} className="flex-1 py-4 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase">Crear</button><button onClick={() => setIsCreating(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase">Cerrar</button></div>
           </div>
        </div>
      )}
      <div className="bg-white/5 border border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[500px]">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest"><tr><th className="px-10 py-6">Empresa</th><th className="px-10 py-6">Licencia</th><th className="px-10 py-6 text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-10 py-6"><div className="font-black text-white">{t.name}</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">/{t.slug}</div></td>
                <td className="px-10 py-6"><span className="px-4 py-1.5 text-[9px] font-black uppercase rounded-full bg-slate-800 text-slate-400 border border-white/5">{t.plan}</span></td>
                <td className="px-10 py-6 text-right flex gap-3 justify-end"><Link to={`/t/${t.slug}/dashboard`} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl border border-white/5">Panel →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
