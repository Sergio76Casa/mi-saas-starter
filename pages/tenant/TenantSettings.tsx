
import React, { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';

export const TenantSettings = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, refreshProfile } = useApp();
  const [name, setName] = useState(tenant.name);
  const [useLogo, setUseLogo] = useState(tenant.use_logo_on_web ?? false);
  const [logoPreview, setLogoPreview] = useState(tenant.logo_url || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `tenant_logo_${Date.now()}.${fileExt}`;
    const path = `${tenant.id}/branding/${fileName}`;
    
    const { error } = await supabase.storage.from('products').upload(path, file);
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
    return publicUrl;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = tenant.logo_url;
      if (logoFile) {
        finalLogoUrl = await uploadLogo(logoFile);
      }

      const { error } = await supabase.from('tenants').update({ 
        name,
        logo_url: finalLogoUrl,
        use_logo_on_web: useLogo
      }).eq('id', tenant.id);

      if (error) throw error;
      await refreshProfile();
      alert("Ajustes guardados correctamente");
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl animate-in fade-in duration-500 mx-auto md:mx-0 pb-20 text-left">
      <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-10 uppercase italic">{t('settings')}</h3>
      
      <div className="space-y-8">
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Datos de la Empresa</h4>
          <Input label="Nombre de la Empresa" value={name} onChange={(e:any) => setName(e.target.value)} />
          
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Plan de Suscripción</label>
            <div className="flex justify-between items-center">
              <span className="font-black text-brand-600 uppercase italic">{tenant.plan}</span>
              <button className="text-[9px] font-black text-slate-400 uppercase underline">Cambiar Plan</button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Identidad Visual</h4>
          
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-40 h-40 rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50 flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-100 transition-all group relative"
            >
              {logoPreview ? (
                <img src={logoPreview} className="w-full h-full object-contain p-4" alt="Logo" />
              ) : (
                <div className="text-center p-4">
                  <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Sube tu logo</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-[9px] font-black uppercase tracking-widest">Cambiar</span>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleLogoChange} className="hidden" accept="image/*" />
            </div>

            <div className="flex-1 space-y-6">
              <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 group">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-900 block mb-1">Usar logo en la web</label>
                  <p className="text-[9px] text-gray-400 font-medium italic">Si se desactiva, se mostrará solo el nombre.</p>
                </div>
                <button 
                  onClick={() => setUseLogo(!useLogo)}
                  className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${useLogo ? 'bg-brand-600' : 'bg-gray-200'}`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform flex items-center justify-center ${useLogo ? 'translate-x-6' : 'translate-x-0'}`}>
                    {useLogo && <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                  </div>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Previsualización en Web Pública</label>
                <div className="px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-3">
                   {useLogo && logoPreview ? (
                     <img src={logoPreview} className="h-6 w-auto object-contain" alt="Preview" />
                   ) : (
                     <span className="text-sm font-black italic tracking-tighter uppercase text-slate-900">{name || 'Nombre Empresa'}</span>
                   )}
                   <span className="text-[8px] font-bold text-gray-300 uppercase ml-auto">Header Mockup</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full py-5 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
        >
          {saving ? 'PROCESANDO...' : 'ACTUALIZAR CONFIGURACIÓN'}
        </button>
      </div>
    </div>
  );
};
