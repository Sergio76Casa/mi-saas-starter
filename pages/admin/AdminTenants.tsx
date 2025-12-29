
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
    const { error } = await supabase.from('tenants').insert([{ ...newTenant, status: 'active' }]);
    if (!error) { 
      setIsCreating(false); 
      setNewTenant({ name: '', slug: '', plan: 'free' }); 
      fetchTenants(); 
    } else {
      alert("Error al crear: " + error.message);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string | undefined) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenantId);
    
    if (error) alert("Error al cambiar estado: " + error.message);
    else fetchTenants();
  };

  const handleDeleteTenant = async (tenantId: string, name: string) => {
    if (!window.confirm(`¿Estás COMPLETAMENTE SEGURO de querer eliminar la empresa "${name}"? Esta acción no se puede deshacer.`)) return;
    
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);
    
    if (error) alert("Error al eliminar: " + error.message);
    else fetchTenants();
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Directorio de Empresas</h3>
          <p className="text-slate-500 text-xs mt-1">Gestión centralizada de todas las instancias del sistema.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="w-full sm:w-auto px-6 py-3 bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-brand-600 transition-colors">+ Registrar Empresa</button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-slate-900 border border-white/10 p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] w-full max-w-md shadow-2xl">
              <h4 className="text-xl font-black text-white mb-6 uppercase italic">Nuevo Registro</h4>
              <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nombre Comercial</label>
                   <input placeholder="Nombre de Empresa" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-brand-500" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Slug URL</label>
                   <input placeholder="url-personalizada" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-brand-500" value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} />
                 </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button onClick={handleCreateTenant} className="flex-1 py-4 bg-brand-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-600 transition-all">Crear Registro</button>
                <button onClick={() => setIsCreating(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden overflow-x-auto shadow-2xl">
        <table className="w-full text-left min-w-[900px]">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Empresa</th>
              <th className="px-6 py-6">Web Pública</th>
              <th className="px-6 py-6">Licencia</th>
              <th className="px-6 py-6">Estado</th>
              <th className="px-10 py-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-10 py-6">
                  <div className="font-black text-white">{t.name}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">ID: {t.id.slice(0, 8)}</div>
                </td>
                <td className="px-6 py-6">
                  <a 
                    href={`#/c/${t.slug}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-brand-500/10 text-brand-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/5 transition-all"
                  >
                    Ver Web ↗
                  </a>
                </td>
                <td className="px-6 py-6">
                  <span className="px-4 py-1.5 text-[9px] font-black uppercase rounded-full bg-slate-800 text-slate-300 border border-white/5">
                    {t.plan}
                  </span>
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${t.status === 'inactive' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${t.status === 'inactive' ? 'text-red-400' : 'text-green-400'}`}>
                      {t.status === 'inactive' ? 'Baja' : 'Activo'}
                    </span>
                  </div>
                </td>
                <td className="px-10 py-6 text-right">
                  <div className="flex gap-2 justify-end">
                    <Link 
                      to={`/t/${t.slug}/dashboard`} 
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/5 transition-all"
                    >
                      Panel
                    </Link>
                    <button 
                      onClick={() => handleToggleStatus(t.id, t.status)}
                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${
                        t.status === 'inactive' 
                          ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20' 
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      {t.status === 'inactive' ? 'Activar' : 'Dar Baja'}
                    </button>
                    <button 
                      onClick={() => handleDeleteTenant(t.id, t.name)}
                      className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-10 py-20 text-center text-slate-600 font-black uppercase tracking-widest italic text-xs">
                  No se han encontrado empresas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
