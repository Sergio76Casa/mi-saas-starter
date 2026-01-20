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
  const [showToast, setShowToast] = useState<string | null>(null);

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

  const getAcceptanceLink = (id: string) => {
    return `${window.location.origin}${window.location.pathname}#/presupuestos/${id}/aceptar`;
  };

  const handleCopyLink = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const link = getAcceptanceLink(id);
    navigator.clipboard.writeText(link);
    setShowToast("¡Enlace de firma copiado!");
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleWhatsAppShare = (e: React.MouseEvent, q: Quote) => {
    e.stopPropagation();
    const link = getAcceptanceLink(q.id);
    const message = `Hola ${q.client_name || 'cliente'}, aquí tienes el presupuesto solicitado para tu revisión y firma digital: ${link}`;
    const waUrl = `https://wa.me/${q.client_phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const openPdf = (e: React.MouseEvent, url: string | undefined) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-20 relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          {showToast}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 px-1">
        <div>
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic mb-1">Gestión Comercial</h4>
          <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{t('quotes')}</h3>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[1200px]">
          <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-50">
            <tr>
              <th className="px-8 py-6">Fecha</th>
              <th className="px-6 py-6">Cliente</th>
              <th className="px-6 py-6">El Equipo</th>
              <th className="px-6 py-6">Financiación</th>
              <th className="px-6 py-6 text-center italic">Presupuesto PDF</th>
              <th className="px-6 py-6">Total</th>
              <th className="px-6 py-6">Estado</th>
              <th className="px-8 py-6 text-right">Enviar / Acciones</th>
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
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={(e) => openPdf(e, q.pdf_url)}
                        disabled={!q.pdf_url}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-black text-[9px] uppercase shadow-sm ${q.pdf_url
                            ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 hover:scale-105 active:scale-95'
                            : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-40'
                          }`}
                        title={q.pdf_url ? "Ver PDF Firmado" : "Pendiente de firma"}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.363 2c4.155 0 2.637 6 2.637 6s6-1.518 6 2.638v11.362c0 .552-.448 1-1 1h-11c-.552 0-1-.448-1-1v-19c0-.552.448-1 1-1zm-1.363 1.363v17.274h9.274v-10.274h-5.274v-5.274h-4zm1.363-1.363h3l5.274 5.274v3.089c-.583-.243-1.226-.363-1.9-.363-2.761 0-5 2.239-5 5 0 2.761 2.239 5 5 5 1.572 0 2.97-.728 3.874-1.861v1.861c0 .552-.448 1-1 1h-11c-.552 0-1-.448-1-1v-19c0-.552.448-1 1-1z" /></svg>
                        {q.pdf_url ? 'VER PDF' : 'SIN PDF'}
                      </button>
                      {q.pdf_url && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white" title="Firmado">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
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
                    <div className="flex justify-end items-center gap-3">
                      {/* BOTONES DE COMPARTIR (Solo visibles si no está aceptado) */}
                      {!q.pdf_url && (
                        <>
                          <button
                            onClick={(e) => handleWhatsAppShare(e, q)}
                            className="p-2.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-100 rounded-xl transition-all shadow-sm"
                            title="Enviar por WhatsApp"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412s-1.239 6.167-3.488 8.413c-2.248 2.244-5.231 3.484-8.411 3.484h-.001c-2.008 0-3.975-.521-5.714-1.506l-6.276 1.649zm6.151-3.692l.332.197c1.472.873 3.136 1.335 4.845 1.335h.001c5.446 0 9.876-4.43 9.878-9.876.001-2.64-1.029-5.12-2.899-6.992s-4.353-2.901-6.993-2.902c-5.448 0-9.879 4.432-9.881 9.879 0 1.83.509 3.618 1.474 5.176l.216.35-.97 3.541 3.633-.953z" /></svg>
                          </button>
                          <button
                            onClick={(e) => handleCopyLink(e, q.id)}
                            className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100 rounded-xl transition-all shadow-sm"
                            title="Copiar enlace de firma"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                          </button>
                        </>
                      )}

                      <button
                        onClick={(e) => handleDelete(e, q.id)}
                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                        title="Eliminar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {quotes.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-10 py-24 text-center">
                  <div className="flex flex-col items-center opacity-30">
                    <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">No hay presupuestos emitidos todavía.</p>
                  </div>
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={8} className="px-10 py-24 text-center">
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