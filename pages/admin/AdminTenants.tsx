
import React, { useState, useEffect } from 'react';
// Import Link from react-router to avoid export issues in react-router-dom
import { Link } from 'react-router';
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../supabaseClient';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';

// Extendemos el tipo localmente para incluir el conteo de productos y los emails de miembros
interface TenantWithStats extends Tenant {
  products: { count: number }[];
  memberships: {
    user_id: string;
    role: string;
    profiles: { email: string; full_name?: string } | null;
  }[];
}

export const AdminTenants = () => {
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [activeTab, setActiveTab] = useState<'directory' | 'trash'>('directory');
  const [isCreating, setIsCreating] = useState(false);
  const [newTenant, setNewTenant] = useState({ 
    name: '', 
    slug: '', 
    plan: 'free',
    ownerName: '',
    email: '',
    password: ''
  });
  const { dbHealthy, session, refreshProfile } = useApp();

  const fetchTenants = async () => {
    if (!dbHealthy) return;
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *, 
          products:products(count),
          memberships(
            user_id,
            role,
            profiles(email, full_name)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setTenants(data as any);
    } catch (err: any) {
      console.error("Error fetching tenants:", err.message);
    }
  };

  useEffect(() => { fetchTenants(); }, [dbHealthy]);

  const filteredTenants = tenants.filter(t => 
    activeTab === 'directory' ? !t.is_deleted : t.is_deleted
  );

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug || !newTenant.email || !newTenant.password || !newTenant.ownerName) {
      return alert("Todos los campos son obligatorios.");
    }
    
    try {
      // VALIDACIÓN: Comprobar si el slug ya existe
      const { data: existingSlug, error: slugCheckError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', newTenant.slug)
        .maybeSingle();

      if (slugCheckError) throw slugCheckError;
      
      if (existingSlug) {
        return alert("La URL personalizada (slug) ya está en uso. Por favor, elige otra.");
      }

      // 1. Crear el Usuario de Auth usando un cliente temporal para no perder la sesión del Admin
      const tempAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
      });

      const { data: authData, error: authError } = await tempAuthClient.auth.signUp({
        email: newTenant.email,
        password: newTenant.password,
        options: {
          data: { 
            full_name: newTenant.ownerName
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario.");

      const newUserId = authData.user.id;

      // 2. Crear el Tenant SIN campos redundantes (email u owner_id) que no existen en la tabla
      const { data: tenant, error: tError } = await supabase
        .from('tenants')
        .insert([{ 
          name: newTenant.name, 
          slug: newTenant.slug, 
          plan: (newTenant.plan as any),
          status: 'active', 
          is_deleted: false 
        }])
        .select()
        .single();

      if (tError) throw tError;

      if (tenant) {
        // 3. Crear membresía oficial para el nuevo usuario con rol 'owner'
        // Esto define quién es el dueño real de la empresa
        const { error: mOwnerError } = await supabase
          .from('memberships')
          .insert([{ 
            user_id: newUserId, 
            tenant_id: tenant.id, 
            role: 'owner' 
          }]);
        
        if (mOwnerError) console.error("Error al vincular dueño:", mOwnerError.message);

        // 4. Vincular también al SuperAdmin actual como admin para acceso inmediato (opcional pero recomendado)
        if (session?.user?.id) {
          await supabase
            .from('memberships')
            .insert([{ 
              user_id: session.user.id, 
              tenant_id: tenant.id, 
              role: 'admin' 
            }]);
        }
      }

      setIsCreating(false); 
      setNewTenant({ name: '', slug: '', plan: 'free', ownerName: '', email: '', password: '' }); 
      await refreshProfile(); 
      fetchTenants(); 
      alert("Empresa y usuario creados correctamente. El usuario ha sido asignado como 'owner'.");
    } catch (err: any) {
      alert("Error en el proceso: " + err.message);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string | undefined) => {
    const newStatus = (currentStatus === 'active' || !currentStatus) ? 'inactive' : 'active';
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenantId);
    
    if (!error) fetchTenants();
  };

  const handleSoftDelete = async (tenantId: string, name: string) => {
    if (!window.confirm(`¿Mover "${name}" a la papelera?`)) return;
    const { error } = await supabase.from('tenants').update({ is_deleted: true }).eq('id', tenantId);
    if (!error) fetchTenants();
  };

  const handleRestore = async (tenantId: string) => {
    const { error } = await supabase.from('tenants').update({ is_deleted: false }).eq('id', tenantId);
    if (!error) fetchTenants();
  };

  const handlePermanentDelete = async (tenantId: string, name: string) => {
    if (!window.confirm(`¿ELIMINAR DEFINITIVAMENTE "${name}"?`)) return;
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (!error) fetchTenants();
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase italic">Gestión de Empresas</h3>
          <p className="text-slate-500 text-xs mt-1">Directorio maestro y control de instancias.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="w-full sm:w-auto px-6 py-3 bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-brand-600 transition-colors">+ Registrar Empresa</button>
      </div>

      <div className="flex border-b border-white/5">
        <button onClick={() => setActiveTab('directory')} className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'directory' ? 'text-brand-500' : 'text-slate-500 hover:text-slate-300'}`}>
          Directorio ({tenants.filter(t => !t.is_deleted).length})
          {activeTab === 'directory' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500"></div>}
        </button>
        <button onClick={() => setActiveTab('trash')} className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'trash' ? 'text-red-500' : 'text-slate-500 hover:text-slate-300'}`}>
          Papelera ({tenants.filter(t => t.is_deleted).length})
          {activeTab === 'trash' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500"></div>}
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-slate-900 border border-white/10 p-8 md:p-10 rounded-[2rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
              <h4 className="text-xl font-black text-white mb-6 uppercase italic">Nuevo Registro</h4>
              <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Datos Empresa</label>
                   <input placeholder="Nombre de Empresa" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-brand-500" value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} />
                   <input placeholder="url-personalizada (slug)" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-brand-500" value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} />
                 </div>
                 
                 <div className="space-y-1 pt-4 border-t border-white/5">
                   <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Datos del Dueño (Owner)</label>
                   <input placeholder="Nombre Completo" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 mb-2" value={newTenant.ownerName} onChange={e => setNewTenant({...newTenant, ownerName: e.target.value})} />
                   <input placeholder="Email del Dueño" type="email" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 mb-2" value={newTenant.email} onChange={e => setNewTenant({...newTenant, email: e.target.value})} />
                   <input placeholder="Contraseña Inicial" type="password" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-brand-500" value={newTenant.password} onChange={e => setNewTenant({...newTenant, password: e.target.value})} />
                 </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button onClick={handleCreateTenant} className="flex-1 py-4 bg-brand-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-600 transition-all">Crear Empresa y Dueño</button>
                <button onClick={() => setIsCreating(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden overflow-x-auto shadow-2xl">
        <table className="w-full text-left min-w-[950px]">
          <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Empresa</th>
              <th className="px-6 py-6">Dueño / Email</th>
              <th className="px-6 py-6 text-center">Catálogo</th>
              <th className="px-6 py-6 text-center">Web Pública</th>
              <th className="px-6 py-6">Licencia</th>
              <th className="px-6 py-6">Estado</th>
              <th className="px-10 py-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTenants.map(t => {
              const status = t.status || 'active';
              const productCount = t.products?.[0]?.count || 0;
              
              // RESOLUCIÓN DE EMAIL USANDO EL ROL 'OWNER' EN MEMBERSHIPS
              // Buscamos la membresía que tiene el rol de dueño
              const ownerMembership = t.memberships?.find(m => m.role === 'owner');
              
              // Si no hay owner (por ejemplo, legacy data), buscamos un admin que no sea el actual superadmin
              const adminMembership = t.memberships?.find(m => m.role === 'admin' && m.user_id !== session?.user?.id);
              
              const targetMember = ownerMembership || adminMembership;
              const displayEmail = targetMember?.profiles?.email || '—';
              const displayName = targetMember?.profiles?.full_name || 'Dueño no definido';
              
              return (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-10 py-6">
                    <div className="font-black text-white">{t.name}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">slug: {t.slug}</div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="text-white text-xs font-bold mb-1">{displayName}</div>
                    <div className="text-slate-400 text-[10px] font-medium truncate max-w-[200px]" title={displayEmail}>{displayEmail}</div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black tabular-nums transition-all ${productCount > 0 ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-500'}`}>
                        {productCount}
                      </span>
                      <span className="text-[8px] font-black uppercase text-slate-600 mt-1 tracking-tighter">SKUs</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    {!t.is_deleted ? (
                      <a href={`#/c/${t.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-brand-500/10 text-brand-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/5 transition-all">Ver Web ↗</a>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-slate-600">Off</span>
                    )}
                  </td>
                  <td className="px-6 py-6">
                    <span className="px-4 py-1.5 text-[9px] font-black uppercase rounded-full bg-slate-800 text-slate-300 border border-white/5">{t.plan}</span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status === 'inactive' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${status === 'inactive' ? 'text-red-400' : 'text-green-400'}`}>
                        {status === 'inactive' ? 'Baja' : 'Activo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex gap-2 justify-end">
                      {activeTab === 'directory' ? (
                        <>
                          <Link to={`/t/${t.slug}/dashboard`} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/5 transition-all">Panel</Link>
                          <button onClick={() => handleToggleStatus(t.id, status)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${status === 'inactive' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                            {status === 'inactive' ? 'Activar' : 'Dar Baja'}
                          </button>
                          <button onClick={() => handleSoftDelete(t.id, t.name)} className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all">Borrar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleRestore(t.id)} className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all">Restaurar</button>
                          <button onClick={() => handlePermanentDelete(t.id, t.name)} className="px-4 py-2 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all">Eliminar Físico</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTenants.length === 0 && !isCreating && (
              <tr>
                <td colSpan={7} className="px-10 py-20 text-center text-slate-500 font-black uppercase text-[10px] italic tracking-widest">No hay empresas registradas en esta sección.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
