
import React, { useState, useRef, useEffect } from 'react';
// Core hooks imported from react-router
import { useOutletContext } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Branch } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';

export const TenantSettings = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, refreshProfile } = useApp();
  
  // Identidad
  const [name, setName] = useState(tenant.name);
  const [phone, setPhone] = useState(tenant.phone || '');
  const [email, setEmail] = useState(tenant.email || '');
  
  // Footer Bilingüe
  const [footerEs, setFooterEs] = useState(tenant.footer_description_es || '');
  const [footerCa, setFooterCa] = useState(tenant.footer_description_ca || '');
  
  // Redes Sociales
  const [socialInsta, setSocialInsta] = useState(tenant.social_instagram || '');
  const [socialFb, setSocialFb] = useState(tenant.social_facebook || '');
  const [socialTiktok, setSocialTiktok] = useState(tenant.social_tiktok || '');
  const [socialYoutube, setSocialYoutube] = useState(tenant.social_youtube || '');
  const [socialX, setSocialX] = useState(tenant.social_x || '');
  const [socialLinkedin, setSocialLinkedin] = useState(tenant.social_linkedin || '');
  const [socialWhatsapp, setSocialWhatsapp] = useState(tenant.social_whatsapp || '');
  const [socialTelegram, setSocialTelegram] = useState(tenant.social_telegram || '');

  const [useLogo, setUseLogo] = useState(tenant.use_logo_on_web ?? false);
  const [logoPreview, setLogoPreview] = useState(tenant.logo_url || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Sucursales
  const [branches, setBranches] = useState<Partial<Branch>[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from('tenant_branches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('sort_order', { ascending: true });
      
      if (data && !error) setBranches(data);
      setLoadingBranches(false);
    };
    fetchBranches();
  }, [tenant.id]);

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

  const addBranch = () => {
    setBranches([...branches, { tenant_id: tenant.id, name: '', address: '', is_active: true, sort_order: branches.length }]);
  };

  const updateBranch = (index: number, field: keyof Branch, value: any) => {
    const newBranches = [...branches];
    newBranches[index] = { ...newBranches[index], [field]: value };
    setBranches(newBranches);
  };

  const removeBranch = async (index: number) => {
    const branch = branches[index];
    if (branch.id) {
      const { error } = await supabase.from('tenant_branches').delete().eq('id', branch.id);
      if (error) {
        alert("Error al borrar sucursal: " + error.message);
        return;
      }
    }
    setBranches(branches.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = tenant.logo_url;
      if (logoFile) {
        finalLogoUrl = await uploadLogo(logoFile);
      }

      const { error: tenantError } = await supabase.from('tenants').update({ 
        name,
        phone,
        email,
        footer_description_es: footerEs,
        footer_description_ca: footerCa,
        social_instagram: socialInsta,
        social_facebook: socialFb,
        social_tiktok: socialTiktok,
        social_youtube: socialYoutube,
        social_x: socialX,
        social_linkedin: socialLinkedin,
        social_whatsapp: socialWhatsapp,
        social_telegram: socialTelegram,
        logo_url: finalLogoUrl,
        use_logo_on_web: useLogo
      }).eq('id', tenant.id);

      if (tenantError) throw tenantError;

      if (branches.length > 0) {
        const { error: branchesError } = await supabase.from('tenant_branches').upsert(
          branches.map(b => ({
            ...b,
            tenant_id: tenant.id
          }))
        );
        if (branchesError) throw branchesError;
      }

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
        {/* EMPRESA */}
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

        {/* CONTACTO */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Información de Contacto</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Teléfono" value={phone} onChange={(e:any) => setPhone(e.target.value)} placeholder="+34 ..." />
            <Input label="Email de contacto" value={email} onChange={(e:any) => setEmail(e.target.value)} placeholder="info@empresa.com" />
          </div>

          <div className="pt-6 border-t border-gray-50">
            <div className="flex justify-between items-center mb-6">
              <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sucursales y Puntos de Venta</h5>
              <button onClick={addBranch} className="px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-brand-100 transition-colors">
                + Añadir sucursal
              </button>
            </div>

            <div className="space-y-4">
              {branches.map((branch, index) => (
                <div key={branch.id || index} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                  <button onClick={() => removeBranch(index)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Nombre (Ej: Central Sabadell)</label>
                      <input 
                        value={branch.name} 
                        onChange={(e) => updateBranch(index, 'name', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none" 
                        placeholder="Nombre de la sucursal"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Dirección Completa</label>
                      <textarea 
                        value={branch.address} 
                        onChange={(e) => updateBranch(index, 'address', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-medium h-20 resize-none focus:ring-2 focus:ring-brand-500 outline-none" 
                        placeholder="Calle, Número, Ciudad, CP..."
                      />
                    </div>
                  </div>
                </div>
              ))}
              {branches.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-[1.8rem]">
                  <p className="text-[10px] font-black uppercase text-slate-300 italic">No hay sucursales configuradas</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER Y REDES SOCIALES */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Footer y Redes Sociales</h4>
          
          <div className="space-y-6">
             <div className="space-y-1.5">
               <div className="flex items-center gap-2 mb-2 ml-1">
                  <span className="bg-slate-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded">ES</span>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Texto del Footer</label>
               </div>
               <textarea 
                 value={footerEs} 
                 onChange={(e) => setFooterEs(e.target.value)}
                 className="w-full px-6 py-4 border border-gray-100 rounded-2xl bg-gray-50 text-sm font-medium h-24 resize-none focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                 placeholder="Expertos en climatización..."
               />
             </div>

             <div className="space-y-1.5">
               <div className="flex items-center gap-2 mb-2 ml-1">
                  <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded">CA</span>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Text del Footer</label>
               </div>
               <textarea 
                 value={footerCa} 
                 onChange={(e) => setFooterCa(e.target.value)}
                 className="w-full px-6 py-4 border border-gray-100 rounded-2xl bg-gray-50 text-sm font-medium h-24 resize-none focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                 placeholder="Experts en climatització..."
               />
             </div>
          </div>

          <div className="pt-8 border-t border-gray-50">
            <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">Enlaces a Redes Sociales</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <Input label="Instagram" value={socialInsta} onChange={(e:any) => setSocialInsta(e.target.value)} placeholder="https://..." />
              <Input label="Facebook" value={socialFb} onChange={(e:any) => setSocialFb(e.target.value)} placeholder="https://..." />
              <Input label="TikTok" value={socialTiktok} onChange={(e:any) => setSocialTiktok(e.target.value)} placeholder="https://..." />
              <Input label="YouTube" value={socialYoutube} onChange={(e:any) => setSocialYoutube(e.target.value)} placeholder="https://..." />
              <Input label="X (Twitter)" value={socialX} onChange={(e:any) => setSocialX(e.target.value)} placeholder="https://..." />
              <Input label="LinkedIn" value={socialLinkedin} onChange={(e:any) => setSocialLinkedin(e.target.value)} placeholder="https://..." />
              <Input label="WhatsApp (Enlace)" value={socialWhatsapp} onChange={(e:any) => setSocialWhatsapp(e.target.value)} placeholder="https://wa.me/..." />
              <Input label="Telegram" value={socialTelegram} onChange={(e:any) => setSocialTelegram(e.target.value)} placeholder="https://t.me/..." />
            </div>
          </div>
        </div>

        {/* IDENTIDAD VISUAL */}
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
