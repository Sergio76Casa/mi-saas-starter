
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Product, Tenant, Language } from '../../types';
import { formatCurrency } from '../../i18n';
import { FINANCING_COEFFICIENTS } from '../../data/pdfCatalog';

interface PublicQuoteConfiguratorProps {
  product: Product;
  tenant: Tenant | null;
  language: Language;
  onBack: () => void;
  translations: any;
}

export const PublicQuoteConfigurator: React.FC<PublicQuoteConfiguratorProps> = ({
  product,
  tenant,
  language,
  onBack,
  translations
}) => {
  const navigate = useNavigate();
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedKitIdx, setSelectedKitIdx] = useState(0);
  const [extraQuantities, setExtraQuantities] = useState<Record<number, number>>({});
  const [paymentType, setPaymentType] = useState<'cash' | 'financing'>('cash');
  const [financingMonths, setFinancingMonths] = useState(12);
  const [isSaving, setIsSaving] = useState(false);

  const tt = (key: string) => translations[language]?.[key] || translations['es']?.[key] || key;

  const quoteItems = useMemo(() => {
    const items = [];
    // 1. Producto principal
    const variant = product.pricing?.[selectedVariantIdx];
    if (variant) {
      items.push({
        description: `${product.brand} ${product.model} - ${variant.name?.[language] || variant.variant}`,
        quantity: 1,
        unit_price: variant.price,
        total: variant.price
      });
    }
    // 2. Kit
    const kit = product.installation_kits?.[selectedKitIdx];
    if (kit) {
      items.push({
        description: kit.name,
        quantity: 1,
        unit_price: kit.price,
        total: kit.price
      });
    }
    // 3. Extras
    Object.entries(extraQuantities).forEach(([idxStr, qty]) => {
      const idx = parseInt(idxStr);
      const extra = product.extras?.[idx];
      if (extra && qty > 0) {
        items.push({
          description: extra.name,
          quantity: qty,
          unit_price: extra.unit_price,
          total: qty * extra.unit_price
        });
      }
    });
    return items;
  }, [product, selectedVariantIdx, selectedKitIdx, extraQuantities, language]);

  const currentTotal = useMemo(() => {
    return quoteItems.reduce((acc, item) => acc + item.total, 0);
  }, [quoteItems]);

  const handleSaveBudget = async () => {
    if (!tenant) return;
    setIsSaving(true);
    
    try {
      // 1. Generar número de presupuesto simple
      const quoteNo = `PRE-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // 2. Insertar presupuesto en Supabase
      const { data: quote, error } = await supabase
        .from('quotes')
        .insert([{
          tenant_id: tenant.id,
          quote_no: quoteNo,
          total_amount: currentTotal,
          status: 'draft', // Empieza como borrador
          financing_months: paymentType === 'financing' ? financingMonths : null,
          financing_fee: paymentType === 'financing' ? (currentTotal * (FINANCING_COEFFICIENTS[financingMonths] || 0)) : null,
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          // Pasamos los items como JSON en una columna temporal o similar si no hay tabla items relacionada
          // En esta estructura, asumimos que se guardan los items en el objeto
          client_name: 'Pendiente de completar',
          client_email: 'pendiente@pendiente.com'
        }])
        .select()
        .single();

      if (error) throw error;

      // 3. Guardar items del presupuesto (Asumiendo tabla quote_items existe)
      if (quote) {
        const itemsToSave = quoteItems.map(item => ({
          quote_id: quote.id,
          ...item
        }));
        await supabase.from('quote_items').insert(itemsToSave);
        
        // 4. Redirigir a la página de firma/aceptación
        navigate(`/presupuestos/${quote.id}/aceptar`);
      }
    } catch (err: any) {
      console.error("Error al guardar presupuesto:", err);
      alert("No se pudo guardar el presupuesto: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <button 
        onClick={onBack} 
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 mb-10 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/>
        </svg>
        {tt('back_to_catalog')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-8 space-y-12 text-left">
          {/* Paso 1: Selección de Modelo */}
          <div className="space-y-6">
            <h3 className="flex items-center gap-4 text-xl font-black tracking-tighter uppercase italic text-slate-900">
              <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-black text-sm not-italic shadow-sm">1</span>
              {tt('step_model')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(product.pricing || []).map((v: any, i: number) => (
                <button 
                  key={i} 
                  onClick={() => setSelectedVariantIdx(i)}
                  className={`p-6 rounded-2xl border-2 text-left transition-all relative ${selectedVariantIdx === i ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-white hover:border-blue-200'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-slate-900 uppercase italic leading-tight pr-8">{v.name?.[language] || v.variant}</h4>
                    {selectedVariantIdx === i && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center absolute top-6 right-6">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-xl font-black text-blue-600 tracking-tighter">{formatCurrency(v.price, language)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Paso 2: Kits de Instalación */}
          <div className="space-y-6">
            <h3 className="flex items-center gap-4 text-xl font-black tracking-tighter uppercase italic text-slate-900">
              <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-black text-sm not-italic shadow-sm">2</span>
              {tt('step_install')}
            </h3>
            <div className="space-y-3">
              {(product.installation_kits || []).map((k: any, i: number) => (
                <label key={i} className={`flex items-center justify-between p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedKitIdx === i ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-white hover:border-blue-200'}`}>
                  <div className="flex items-center gap-4">
                    <input type="radio" checked={selectedKitIdx === i} onChange={() => setSelectedKitIdx(i)} className="w-5 h-5 accent-blue-600" />
                    <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">{k.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{k.price} €</span>
                </label>
              ))}
            </div>
          </div>

          {/* Paso 3: Extras */}
          <div className="space-y-6">
            <h3 className="flex items-center gap-4 text-xl font-black tracking-tighter uppercase italic text-slate-900">
              <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-black text-sm not-italic shadow-sm">3</span>
              {tt('step_extras')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(product.extras || []).map((e: any, i: number) => (
                <div key={i} className="p-6 bg-white border-2 border-slate-100 rounded-2xl flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-1 leading-tight">{e.name}</h4>
                    <p className="text-blue-600 font-black">{e.unit_price} €</p>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    <button onClick={() => setExtraQuantities(prev => ({ ...prev, [i]: Math.max(0, (prev[i] || 0) - 1) }))} className="w-8 h-8 bg-white text-slate-400 hover:text-slate-900 rounded-lg flex items-center justify-center font-black transition-colors shadow-sm">－</button>
                    <span className="text-sm font-black text-slate-900 w-8 text-center">{extraQuantities[i] || 0}</span>
                    <button onClick={() => setExtraQuantities(prev => ({ ...prev, [i]: (prev[i] || 0) + 1 }))} className="w-8 h-8 bg-white text-slate-400 hover:text-slate-900 rounded-lg flex items-center justify-center font-black transition-colors shadow-sm">＋</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paso 4: Pago */}
          <div className="space-y-6">
            <h3 className="flex items-center gap-4 text-xl font-black tracking-tighter uppercase italic text-slate-900">
              <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-black text-sm not-italic shadow-sm">4</span>
              {tt('step_payment')}
            </h3>
            <div className="space-y-4">
              <label className={`flex items-center gap-4 p-6 rounded-2xl border-2 cursor-pointer transition-all ${paymentType === 'cash' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-white'}`}>
                <input type="radio" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="w-5 h-5 accent-blue-600" />
                <div className="flex items-center gap-3">
                  <span className="text-xl">💳</span>
                  <span className="font-black text-slate-900 uppercase italic tracking-tighter">{tt('payment_cash')}</span>
                </div>
              </label>

              {[12, 24, 36, 48, 60].map(m => {
                const coeff = FINANCING_COEFFICIENTS[m] || 0.087;
                const fee = currentTotal * coeff;
                return (
                  <label key={m} className={`flex items-center justify-between p-6 rounded-2xl border-2 cursor-pointer transition-all ${paymentType === 'financing' && financingMonths === m ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-white'}`}>
                    <div className="flex items-center gap-4">
                      <input type="radio" checked={paymentType === 'financing' && financingMonths === m} onChange={() => { setPaymentType('financing'); setFinancingMonths(m); }} className="w-5 h-5 accent-blue-600" />
                      <span className="font-black text-slate-900 uppercase italic tracking-tighter">{m} Meses</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xl font-black text-blue-600 tracking-tighter">{formatCurrency(fee, language)}</span>
                      <span className="text-[10px] font-black uppercase text-slate-400">/mes</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-28 self-start space-y-6 z-[60]">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="mb-10 text-center flex flex-col items-center">
              <div className="w-full h-40 bg-white rounded-3xl p-6 flex items-center justify-center mb-6 shadow-inner relative">
                {product.brand_logo_url && (
                  <img src={product.brand_logo_url} className="absolute top-4 right-4 h-7 w-auto object-contain drop-shadow-sm z-10" alt={product.brand} />
                )}
                {product.image_url ? (
                  <img src={product.image_url} className="w-full h-full object-contain relative z-0" alt="" />
                ) : (
                  <div className="text-slate-200 font-black text-[10px] uppercase">NO IMAGE</div>
                )}
              </div>
              <h4 className="text-2xl font-black text-white tracking-tighter uppercase italic">{tt('summary_title')}</h4>
            </div>

            <div className="space-y-6 mb-10 border-b border-white/5 pb-8">
              <div className="flex justify-between items-start gap-4">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{tt('selected_variant')}</span>
                <span className="text-[11px] font-bold text-white text-right leading-tight max-w-[150px]">
                  {product.pricing?.[selectedVariantIdx]?.name?.[language] || product.pricing?.[selectedVariantIdx]?.variant}
                </span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{tt('selected_kit')}</span>
                <span className="text-[11px] font-bold text-white text-right leading-tight max-w-[150px]">
                  {product.installation_kits?.[selectedKitIdx]?.name || tt('none')}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-10">
              <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em] block text-center mb-4">{tt('summary_total')}</span>
              <div className="text-5xl font-black text-white tracking-tighter text-center">{formatCurrency(currentTotal, language)}</div>
              <p className="text-[10px] font-black uppercase text-slate-500 text-center tracking-widest">{tt('vat_included')}</p>
            </div>

            <div className="space-y-4">
              <button 
                disabled={isSaving}
                onClick={handleSaveBudget}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                {isSaving ? 'GUARDANDO...' : tt('btn_save_quote')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
