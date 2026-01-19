import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Quote } from '../../types';
import { useApp } from '../../AppProvider';
import { formatCurrency } from '../../i18n';

const STATUS_COLORS: Record<string, { bg: string, text: string, border: string, label: string }> = {
  draft: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100', label: 'Borrador' },
  sent: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', label: 'Enviado' },
  viewed: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', label: 'Visto' },
  accepted: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', label: 'Aceptado' },
  rejected: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', label: 'Rechazado' },
  expired: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', label: 'Expirado' }
};

export const Quotes = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          items:quote_items(*)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setQuotes(data as any);
    } catch (err) {
      console.error("Error fetching quotes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuotes(); }, [tenant.id]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de que deseas eliminar este presupuesto?")) return;
    
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
      setQuotes(quotes.filter(q => q.id !== id));
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 px-1">
        <div>
           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic mb-1">Gestión Comercial</h4>
           <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{t('quotes')}</h3>
        </div>
        <button 
          onClick={() => navigate(`/t/${tenant.slug}/quotes/new`)} 
          className="w-full md:w-auto px-8 py-3.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span> {t('new_quote')}
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[1100px]">
          <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-50">
            <tr>
              <th className="px-8 py-6">Fecha</th>
              <th className="px-6 py-6">Cliente</th>
              <th className="px-6 py-6">El Equipo</th>
              <th className="px-6 py-6">Financiación</th>
              <th className="px-6 py-6 text-center">Docs</th>
              <th className="px-6 py-6 text-center">Presupuesto</th>
              <th className="px-6 py-6">Total</th>
              <th className="px-6 py-6">Estado</th>
              <th className="px-8 py-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {quotes.map(q => {
              const status = STATUS_COLORS[q.status] || STATUS_COLORS.draft;
              const firstItem = q.items && q.items.length > 0 ? q.items[0] : null;
              
              return (
                <tr 
                  key={q.id} 
                  className="hover:bg-slate-50/50 transition-all cursor-pointer group border-transparent border-l-4 hover:border-blue-500" 
                  onClick={() => navigate(`/t/${tenant.slug}/quotes/${q.id}`)}
                >
                  <td className="px-8 py-7">
                    <span className="text-xs font-bold text-slate-500 tabular-nums">{formatDateShort(q.created_at)}</span>
                  </td>
                  
                  <td className="px-6 py-7">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-black text-slate-900 leading-none">{q.client_name || 'Cliente Genérico'}</span>
                      <span className="text-[10px] font-medium text-slate-400">{q.client_email || 'Sin email'}</span>
                      {q.maintenance_no && (
                        <div className="mt-1.5 flex">
                          <span className="px-2 py-0.5 bg-cyan-50 text-cyan-600 text-[8px] font-black uppercase rounded-md border border-cyan-100">
                             WO #{q.maintenance_no}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-7">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-slate-700 leading-tight">
                        {firstItem ? firstItem.description.split(' - ')[0] : 'No especificado'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {firstItem ? firstItem.description.split(' - ')[1] || 'Modelo base' : '—'}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-7">
                    <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border ${q.financing_months ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                       {q.financing_months ? `${q.financing_months} Meses` : 'Pago al Contado'}
                    </span>
                  </td>

                  <td className="px-6 py-7">
                    <div className="flex items-center justify-center gap-2">
                       <button className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors" title="Ver Documentación">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                       </button>
                       <button className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors" title="Ficha Técnica">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                       </button>
                    </div>
                  </td>

                  <td className="px-6 py-7">
                    <div className="flex justify-center">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-lg border border-slate-100 transition-all font-black text-[9px] uppercase">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.363 2c4.155 0 2.637 6 2.637 6s6-1.518 6 2.638v11.362c0 .552-.448 1-1 1h-11c-.552 0-1-.448-1-1v-19c0-.552.448-1 1-1zm-1.363 1.363v17.274h9.274v-10.274h-5.274v-5.274h-4zm1.363-1.363h3l5.274 5.274v3.089c-.583-.243-1.226-.363-1.9-.363-2.761 0-5 2.239-5 5 0 2.761 2.239 5 5 5 1.572 0 2.97-.728 3.874-1.861v1.861c0 .552-.448 1-1 1h-11c-.552 0-1-.448-1-1v-19c0-.552.448-1 1-1z"/></svg>
                        PDF
                      </button>
                    </div>
                  </td>

                  <td className="px-6 py-7">
                    <span className="text-sm font-black text-slate-900 tracking-tighter tabular-nums">
                      {formatCurrency(q.total_amount, language)}
                    </span>
                  </td>

                  <td className="px-6 py-7">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
                      <span className="text-[9px] font-black uppercase tracking-widest">{status.label}</span>
                    </div>
                  </td>

                  <td className="px-8 py-7 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button 
                        onClick={(e) => handleDelete(e, q.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Eliminar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {quotes.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-10 py-24 text-center">
                  <div className="flex flex-col items-center opacity-30">
                     <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">No hay presupuestos emitidos todavía.</p>
                  </div>
                </td>
              </tr>
            )}
            
            {loading && (
              <tr>
                <td colSpan={9} className="px-10 py-24 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cargando historial...</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};