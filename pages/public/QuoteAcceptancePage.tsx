
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
        if (!supabase) return;
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
    if (!supabase) throw new Error("Supabase no está configurado");

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
    const fileName = `quotes/${quote?.tenant_id}/${id}/presupuesto.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, pdfBlob, { upsert: true, contentType: 'application/pdf' });

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
        throw new Error("El contenedor 'products' no existe. Créalo en Supabase Storage.");
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleConfirmarPedido = async () => {
    if (!clientData.name || !clientData.email || !clientData.address) {
      return alert("Por favor, completa los datos del cliente.");
    }
    if (!signature) {
      return alert("La firma es obligatoria.");
    }
    if (!isAccepted) {
      return alert("Debes aceptar las condiciones.");
    }

    setIsSubmitting(true);
    try {
      if (!supabase) throw new Error("Error de conexión");
      const finalClientName = `${clientData.name} ${clientData.surname}`.trim();

      // 1. Generar y subir el PDF
      const pdfUrl = await generateAndUploadPDF({ client_name: finalClientName });

      // 2. Actualizar presupuesto
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
          pdf_url: pdfUrl // <--- Aquí fallaba si no existía la columna
        })
        .eq('id', id);

      if (updateError) {
        if (updateError.message.includes('pdf_url')) {
          throw new Error("Falta la columna 'pdf_url' en la tabla 'quotes'. Por favor, ejecute el comando ALTER TABLE en el SQL Editor de Supabase.");
        }
        throw updateError;
      }

      alert("¡Pedido Confirmado! El presupuesto PDF ha sido guardado.");
      navigate(`/c/${quote?.tenant?.slug}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFirmarTarde = async () => {
    setIsSubmitting(true);
    try {
      if (!supabase) throw new Error("Error de conexión");
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
      alert("Guardado como borrador.");
      navigate(`/c/${quote?.tenant?.slug}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-20 text-center text-red-500 font-black uppercase italic">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600/20 text-left font-sans">
      <nav className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50 flex items-center px-6 md:px-10 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-all group">
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          </div>
          Volver
        </button>
        <div className="flex-1 text-center pr-10">
          <span className="text-xl font-black italic tracking-tighter uppercase text-slate-900 bg-gradient-to-r from-slate-900 to-slate-500 bg-clip-text text-transparent">Revisión de Presupuesto</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Columna Izquierda: Detalle del Pedido */}
          <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-28">
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2"></div>

              <div className="flex justify-between items-start mb-8 relative">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 mb-1">Tu Selección</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Ref: {quote?.quote_no}</p>
                  </div>
                </div>
                {(quote as any)?.brand_logo_url && (
                  <img src={(quote as any).brand_logo_url} className="h-8 w-auto object-contain opacity-80" alt="Brand Logo" />
                )}
              </div>

              {/* Imagen del Producto Principal */}
              {(quote as any)?.product_image_url && (
                <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center group hover:bg-white hover:shadow-inner transition-all duration-500">
                  <img
                    src={(quote as any).product_image_url}
                    className="max-h-48 w-auto object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-700"
                    alt="Producto"
                  />
                </div>
              )}

              <div className="space-y-4 mb-8">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between gap-4 py-3 border-b border-slate-100 last:border-0 group">
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-600 leading-tight group-hover:text-slate-900 transition-colors uppercase">{item.description}</p>
                      <p className="text-[9px] font-black text-slate-300 mt-1.5 uppercase tracking-widest">Unidades: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(item.total, language)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t-2 border-slate-50">
                <div className="flex justify-between items-end bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-24 h-24 bg-blue-500/20 blur-[40px] rounded-full translate-y-1/2 translate-x-1/2"></div>
                  <div className="relative">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 italic">Total Presupuestado</p>
                    <p className="text-4xl font-black text-white tracking-tighter tabular-nums">{formatCurrency(quote?.total_amount || 0, language)}</p>
                  </div>
                  <div className="relative text-right">
                    <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">IVA INCL. / INSTALADO</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase">Oferta válida 30 días</p>
                  </div>
                </div>
              </div>

              {quote?.financing_months && (
                <div className="mt-6 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest leading-none mb-1">Opc. Financiación</p>
                    <p className="text-sm font-black text-blue-900 italic">{quote.financing_months} MESES</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-blue-600 tracking-tighter">{formatCurrency(quote.financing_fee || 0, language)}<span className="text-[10px] uppercase ml-1">/mes</span></p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Formulario y Firma */}
          <div className="lg:col-span-7 space-y-8">
            {/* Datos del Cliente */}
            <section className="bg-white p-8 md:p-12 rounded-[2.8rem] shadow-sm border border-slate-200/50 space-y-10 group hover:border-blue-200 transition-colors duration-500">
              <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Datos de Contacto</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Por favor, verifica tus datos para la factura</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <div className="space-y-2 group/input">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest group-focus-within/input:text-blue-500 transition-colors">Nombre</label>
                  <input
                    value={clientData.name}
                    onChange={e => setClientData({ ...clientData, name: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="Ej: Juan"
                  />
                </div>
                <div className="space-y-2 group/input">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest group-focus-within/input:text-blue-500 transition-colors">Apellidos</label>
                  <input
                    value={clientData.surname}
                    onChange={e => setClientData({ ...clientData, surname: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="Ej: Pérez García"
                  />
                </div>
                <div className="space-y-2 group/input">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest group-focus-within/input:text-blue-500 transition-colors">Correo Electrónico</label>
                  <input
                    type="email"
                    value={clientData.email}
                    onChange={e => setClientData({ ...clientData, email: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="tu@email.com"
                  />
                </div>
                <div className="space-y-2 group/input">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest group-focus-within/input:text-blue-500 transition-colors">Número de Teléfono</label>
                  <input
                    value={clientData.phone}
                    onChange={e => setClientData({ ...clientData, phone: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="+34 000 000 000"
                  />
                </div>
                <div className="md:col-span-2 space-y-2 group/input">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest group-focus-within/input:text-blue-500 transition-colors">Dirección de Instalación</label>
                  <input
                    value={clientData.address}
                    onChange={e => setClientData({ ...clientData, address: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all"
                    placeholder="Calle, Número, Planta, Código Postal..."
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50">
                <label className="flex items-center gap-5 cursor-pointer group/toggle w-fit">
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isTechnician} onChange={e => setIsTechnician(e.target.checked)} className="sr-only peer" />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 group-hover/toggle:text-blue-600 transition-colors block">Acceso Profesional</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Soy técnico / instalador autorizado</span>
                  </div>
                </label>

                {isTechnician && (
                  <div className="mt-8 p-8 bg-blue-50/50 rounded-3xl border border-blue-100/50 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </div>
                      <label className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] italic">Número de Orden de Trabajo</label>
                    </div>
                    <input
                      maxLength={8}
                      placeholder="00000000"
                      value={orderNumber}
                      onChange={e => setOrderNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-6 py-5 bg-white border border-blue-200 rounded-2xl text-2xl font-black tracking-[0.5em] text-blue-700 outline-none focus:ring-4 focus:ring-blue-200 text-center shadow-inner"
                    />
                    <p className="mt-3 text-[9px] text-blue-400 font-bold uppercase text-center tracking-widest opacity-70">Introduce los 8 dígitos identificativos</p>
                  </div>
                )}
              </div>
            </section>

            {/* Firma y Confirmación */}
            <section className="bg-white p-8 md:p-12 rounded-[2.8rem] shadow-sm border border-slate-200/50 space-y-10 group hover:border-blue-200 transition-colors duration-500">
              <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Validación Digital</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Firma digitalmente para confirmar tu pedido</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="w-full h-64 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden group/signature cursor-crosshair hover:bg-white hover:border-blue-400 transition-all duration-500">
                  {signature ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-500">
                      <div className="mb-4 transform -rotate-3 border-b-2 border-blue-600 pb-2 px-8">
                        <span className="text-5xl font-serif italic text-slate-900 select-none tracking-tighter">Confirmado</span>
                      </div>
                      <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 px-4 py-2 rounded-full mb-6">Firma Registrada</p>
                      <button
                        onClick={() => setSignature('')}
                        className="text-[10px] font-black uppercase text-red-500 hover:bg-red-50 px-6 py-2 rounded-xl transition-all border border-transparent hover:border-red-100"
                      >
                        Borrar y repetir
                      </button>
                    </div>
                  ) : (
                    <div onClick={() => setSignature('signed')} className="text-center group-hover/signature:scale-110 transition-transform duration-500">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-5 rotate-3 group-hover/signature:rotate-0 transition-transform">
                        <svg className="w-8 h-8 text-slate-300 group-hover/signature:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Haz clic o dibuja tu firma</p>
                      <p className="text-[8px] font-bold text-slate-300 uppercase mt-1">Garantía de firma segura</p>
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-5 cursor-pointer group/legal p-6 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:bg-blue-50/30 hover:border-blue-100 transition-all">
                  <div className="pt-1">
                    <input type="checkbox" checked={isAccepted} onChange={e => setIsAccepted(e.target.checked)} className="w-6 h-6 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 leading-relaxed group-hover/legal:text-slate-900 transition-colors">
                    Declaro que he revisado el presupuesto y acepto las <span className="text-blue-600 font-black border-b border-blue-200 hover:border-blue-600 transition-all cursor-help">condiciones generales de venta</span>, autorizando el inicio de los trabajos según lo descrito.
                  </span>
                </label>
              </div>

              <div className="pt-10 flex flex-col gap-5">
                <button
                  onClick={handleConfirmarPedido}
                  disabled={isSubmitting}
                  className="w-full py-7 bg-slate-900 text-white rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-slate-900/40 hover:bg-blue-600 hover:shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 group/btn"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <span>Firmar y Confirmar Pedido</span>
                      <svg className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
                  )}
                </button>
                <button
                  onClick={handleFirmarTarde}
                  disabled={isSubmitting}
                  className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 transition-all text-center italic hover:not-italic"
                >
                  Guardar para firmar más tarde
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="py-10 border-t border-slate-200/50 bg-white">
        <div className="max-w-7xl mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">© 2026 {quote?.tenant?.name} • Plataforma de Presupuestos Digitales</p>
          <div className="flex gap-8">
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest flex items-center gap-2">
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
              Conexión Segura
            </span>
            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest flex items-center gap-2">
              <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
              Garantía RGPD
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
