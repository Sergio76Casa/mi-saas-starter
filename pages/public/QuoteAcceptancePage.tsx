
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Quote, QuoteItem } from '../../types';
import { formatCurrency } from '../../i18n';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useApp } from '../../AppProvider';
import { jsPDF } from 'jspdf';

export const QuoteAcceptancePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useApp();
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [clientData, setClientData] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isTechnician, setIsTechnician] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [isAccepted, setIsAccepted] = useState(false);
  const [signature, setSignature] = useState('');

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const { data: q, error: qError } = await supabase
          .from('quotes')
          .select('*, tenant:tenants(*)')
          .eq('id', id)
          .single();

        if (qError || !q) throw new Error("No se encontró el presupuesto.");

        setQuote(q as any);
        setClientData(prev => ({
          ...prev,
          name: q.client_name?.split(' ')[0] || '',
          surname: q.client_name?.split(' ').slice(1).join(' ') || '',
          email: q.client_email || '',
          phone: q.client_phone || '',
          address: q.client_address || ''
        }));
        setIsTechnician(q.is_technician || false);
        setOrderNumber(q.maintenance_no || '');

        const { data: i, error: iError } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', id);

        if (!iError && i) setItems(i);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [id]);

  const generateAndUploadPDF = async (finalQuote: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(quote?.tenant?.name?.toUpperCase() || 'PRESUPUESTO', 20, 30);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(`Nº Presupuesto: ${quote?.quote_no}`, 20, 38);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 43);

    // Client Info
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`${finalQuote.client_name}`, 20, 68);
    doc.text(`${finalQuote.client_email}`, 20, 73);
    doc.text(`${finalQuote.client_phone}`, 20, 78);
    doc.text(`${finalQuote.client_address}`, 20, 83);

    // Table Header
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 100, pageWidth - 40, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO', 25, 106.5);
    doc.text('CANT.', pageWidth - 65, 106.5, { align: 'right' });
    doc.text('TOTAL', pageWidth - 25, 106.5, { align: 'right' });

    // Table Items
    let y = 118;
    doc.setFont('helvetica', 'normal');
    items.forEach(item => {
      doc.text(item.description, 25, y, { maxWidth: 100 });
      doc.text(item.quantity.toString(), pageWidth - 65, y, { align: 'right' });
      doc.text(formatCurrency(item.total, language), pageWidth - 25, y, { align: 'right' });
      y += 12;
    });

    // Total
    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL (IVA Incl.):', pageWidth - 80, y, { align: 'right' });
    doc.text(formatCurrency(quote?.total_amount || 0, language), pageWidth - 25, y, { align: 'right' });

    // Financing if exists
    if (quote?.financing_months) {
      y += 20;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('OPCIÓN DE FINANCIACIÓN:', 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${quote.financing_months} cuotas de ${formatCurrency(quote.financing_fee || 0, language)} / mes`, 20, y + 8);
    }

    // Signature Area
    y = doc.internal.pageSize.getHeight() - 60;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Firma del cliente y aceptación de condiciones:', 20, y);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('times', 'italic');
    doc.text('Documento firmado digitalmente', 20, y + 15);

    const pdfBlob = doc.output('blob');
    const fileName = `${quote?.tenant_id}/${id}/presupuesto.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('quotes')
      .upload(fileName, pdfBlob, { upsert: true, contentType: 'application/pdf' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('quotes').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleConfirmarPedido = async () => {
    if (!clientData.name || !clientData.email || !clientData.address) {
      return alert("Por favor, completa los datos del cliente.");
    }
    if (!signature) {
      return alert("La firma es obligatoria para confirmar el pedido.");
    }
    if (!isAccepted) {
      return alert("Debes aceptar las condiciones de servicio.");
    }

    setIsSubmitting(true);
    try {
      const finalClientName = `${clientData.name} ${clientData.surname}`.trim();
      
      // 1. Generar y subir el PDF
      const pdfUrl = await generateAndUploadPDF({ client_name: finalClientName });

      // 2. Actualizar presupuesto con estado y URL del PDF
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          client_name: finalClientName,
          client_email: clientData.email,
          client_phone: clientData.phone,
          client_address: clientData.address,
          status: 'accepted',
          is_technician: isTechnician,
          maintenance_no: isTechnician ? orderNumber : null,
          pdf_url: pdfUrl
        })
        .eq('id', id);

      if (updateError) throw updateError;

      alert("¡Pedido Confirmado con éxito! El presupuesto ha sido generado.");
      navigate(`/c/${quote?.tenant?.slug}`);
    } catch (err: any) {
      alert("Error en el proceso: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFirmarTarde = async () => {
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          client_name: `${clientData.name} ${clientData.surname}`.trim(),
          client_email: clientData.email,
          client_phone: clientData.phone,
          client_address: clientData.address,
          is_technician: isTechnician,
          maintenance_no: orderNumber,
          status: 'sent'
        })
        .eq('id', id);

      if (updateError) throw updateError;
      
      alert("Presupuesto guardado. Pendiente de firma.");
      navigate(`/c/${quote?.tenant?.slug}`);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-20 text-center text-red-500 font-black uppercase italic">{error}</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-600/20 text-left font-sans">
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center px-6 md:px-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          Volver
        </button>
        <div className="flex-1 text-center">
          <span className="text-xl font-black italic tracking-tighter uppercase text-slate-900">Aceptación de Presupuesto</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          <div className="lg:col-span-5 space-y-10">
             <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 mb-2">Detalle del pedido</h3>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Referencia: {quote?.quote_no}</p>
             </div>

             <div className="bg-slate-50 rounded-[2.5rem] p-8 md:p-10 border border-slate-100 space-y-6">
                <div className="space-y-4">
                   {items.map((item, i) => (
                     <div key={i} className="flex justify-between gap-4 border-b border-slate-200/50 pb-4">
                        <div className="flex-1">
                           <p className="text-xs font-bold text-slate-700 leading-tight">{item.description}</p>
                           <p className="text-[10px] font-black text-slate-400 mt-1 uppercase">Cantidad: {item.quantity}</p>
                        </div>
                        <span className="text-xs font-black text-slate-900">{formatCurrency(item.total, language)}</span>
                     </div>
                   ))}
                </div>

                <div className="pt-6 border-t-2 border-slate-200">
                   <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Total a pagar</p>
                         <p className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(quote?.total_amount || 0, language)}</p>
                      </div>
                      <p className="text-[10px] font-black uppercase text-slate-500 italic">IVA e instalación incl.</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-7 space-y-12">
             <section className="space-y-8">
                <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 border-b border-blue-50 pb-4">Datos del Cliente</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre</label>
                      <input value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Apellidos</label>
                      <input value={clientData.surname} onChange={e => setClientData({...clientData, surname: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email</label>
                      <input type="email" value={clientData.email} onChange={e => setClientData({...clientData, email: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Teléfono</label>
                      <input value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dirección Completa</label>
                      <input value={clientData.address} onChange={e => setClientData({...clientData, address: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                </div>

                <div className="pt-6">
                   <label className="flex items-center gap-4 cursor-pointer group">
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={isTechnician} onChange={e => setIsTechnician(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 group-hover:text-blue-600 transition-colors">Soy Técnico / Instalador</span>
                   </label>

                   {isTechnician && (
                     <div className="mt-6 p-6 bg-blue-50 rounded-2xl border border-blue-100 animate-in slide-in-from-top-4 duration-300">
                        <label className="text-[10px] font-black uppercase text-blue-600 ml-1 mb-2 block tracking-widest">Número de orden (8 dígitos)</label>
                        <input 
                           maxLength={8}
                           placeholder="Ej: 12345678"
                           value={orderNumber}
                           onChange={e => setOrderNumber(e.target.value.replace(/\D/g, ''))}
                           className="w-full px-5 py-3 bg-white border border-blue-200 rounded-xl text-lg font-black tracking-[0.3em] text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 text-center" 
                        />
                     </div>
                   )}
                </div>
             </section>

             <section className="space-y-8">
                <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 border-b border-blue-50 pb-4">Firma de conformidad</h4>
                
                <div className="space-y-4">
                   <div className="w-full h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden group cursor-crosshair">
                      {signature ? (
                         <div className="absolute inset-0 flex items-center justify-center bg-white">
                            <span className="text-4xl font-serif italic text-slate-800 drop-shadow-sm select-none">Firmado</span>
                            <button onClick={() => setSignature('')} className="absolute top-4 right-4 text-[10px] font-black uppercase text-red-500 hover:underline">Borrar</button>
                         </div>
                      ) : (
                         <div onClick={() => setSignature('signed')} className="text-center opacity-30 group-hover:opacity-100 transition-opacity">
                            <svg className="w-10 h-10 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            <p className="text-[10px] font-black uppercase tracking-widest">Haz clic o dibuja tu firma aquí</p>
                         </div>
                      )}
                   </div>

                   <label className="flex items-start gap-4 cursor-pointer group">
                      <input type="checkbox" checked={isAccepted} onChange={e => setIsAccepted(e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-200 text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs font-medium text-slate-500 leading-relaxed group-hover:text-slate-900 transition-colors">
                         Acepto el presupuesto y las <span className="text-blue-600 font-bold underline cursor-help">condiciones de servicio</span> para la ejecución del pedido.
                      </span>
                   </label>
                </div>
             </section>

             <div className="pt-10 flex flex-col gap-4">
                <button 
                   onClick={handleConfirmarPedido}
                   disabled={isSubmitting}
                   className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl hover:bg-black transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                   {isSubmitting ? 'GENERANDO PDF...' : 'Firmar y Confirmar Pedido'}
                </button>
                <button 
                   onClick={handleFirmarTarde}
                   disabled={isSubmitting}
                   className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 transition-all text-center"
                >
                   Firmar más tarde
                </button>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};
