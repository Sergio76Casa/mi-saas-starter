
import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Branch } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';

export const TenantSettings = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, refreshProfile } = useApp();
  
  const [name, setName] = useState(tenant.name);
  const [phone, setPhone] = useState(tenant.phone || '');
  const [email, setEmail] = useState(tenant.email || '');
  const [footerEs, setFooterEs] = useState(tenant.footer_description_es || '');
  const [footerCa, setFooterCa] = useState(tenant.footer_description_ca || '');
  
  const [socials, setSocials] = useState({
    social_instagram: tenant.social_instagram || '',
    social_facebook: tenant.social_facebook || '',
    social_tiktok: tenant.social_tiktok || '',
    social_youtube: tenant.social_youtube || '',
    social_x: tenant.social_x || '',
    social_linkedin: tenant.social_linkedin || '',
    social_whatsapp: tenant.social_whatsapp || '',
    social_telegram: tenant.social_telegram || ''
  });

  const [useLogo, setUseLogo] = useState(tenant.use_logo_on_web ?? false);
  const [logoPreview, setLogoPreview] = useState(tenant.logo_url || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Partial<Branch>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenant || saving) return;
    setName(tenant.name || '');
    setPhone(tenant.phone || '');
    setEmail(tenant.email || '');
    setFooterEs(tenant.footer_description_es || '');
    setFooterCa(tenant.footer_description_ca || '');
    setSocials({
      social_instagram: tenant.social_instagram || '',
      social_facebook: tenant.social_facebook || '',
      social_tiktok: tenant.social_tiktok || '',
      social_youtube: tenant.social_youtube || '',
      social_x: tenant.social_x || '',
      social_linkedin: tenant.social_linkedin || '',
      social_whatsapp: tenant.social_whatsapp || '',
      social_telegram: tenant.social_telegram || ''
    });
    setUseLogo(tenant.use_logo_on_web ?? false);
    setLogoPreview(tenant.logo_url || '');
  }, [tenant]);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!tenant.id) return;
      const { data } = await supabase
        .from('tenant_branches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('sort_order', { ascending: true });
      if (data) setBranches(data);
    };
    fetchBranches();
  }, [tenant.id]);

  const sanitizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http') || trimmed.startsWith('//')) return trimmed;
    return `https://${trimmed}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = logoPreview;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;
        const path = `${tenant.id}/branding/${fileName}`;
        await supabase.storage.from('products').upload(path, logoFile);
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
        finalLogoUrl = publicUrl;
      }

      const updatePayload = { 
        name,
        phone: phone.trim(),
        email: email.trim(),
        footer_description_es: footerEs.trim(),
        footer_description_ca: footerCa.trim(),
        social_instagram: sanitizeUrl(socials.social_instagram),
        social_facebook: sanitizeUrl(socials.social_facebook),
        social_tiktok: sanitizeUrl(socials.social_tiktok),
        social_youtube: sanitizeUrl(socials.social_youtube),
        social_x: sanitizeUrl(socials.social_x),
        social_linkedin: sanitizeUrl(socials.social_linkedin),
        social_whatsapp: sanitizeUrl(socials.social_whatsapp),
        social_telegram: sanitizeUrl(socials.social_telegram),
        logo_url: finalLogoUrl,
        use_logo_on_web: useLogo
      };

      const { data: updatedTenant, error: updateError } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', tenant.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      
      if (!updatedTenant) {
        throw new Error("No tienes permisos para actualizar la empresa (RLS).");
      }

      if (branches.length > 0) {
        const branchesToSave = branches.map((b, idx) => ({
          id: b.id,
          tenant_id: tenant.id,
          name: b.name?.trim() || 'Sucursal',
          address: b.address?.trim() || '',
          phone: b.phone?.trim() || '',
          email: b.email?.trim() || '',
          sort_order: idx,
          is_active: b.is_active ?? true
        }));
        await supabase.from('tenant_branches').upsert(branchesToSave);
      }

      await refreshProfile();
      alert("✅ Configuración actualizada con éxito.");
    } catch (err: any) {
      console.error("SAVE_ERROR:", err);
      alert("❌ Error: " + (err.message || "No se ha podido guardar la configuración."));
    } finally {
      setSaving(false);
    }
  };

  const addBranch = () => setBranches([...branches, { name: '', address: '', phone: '', email: '', is_active: true }]);
  const updateBranch = (idx: number, field: keyof Branch, val: any) => {
    const updated = [...branches];
    updated[idx] = { ...updated[idx], [field]: val };
    setBranches(updated);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="max-w-3xl animate-in fade-in duration-500 mx-auto md:mx-0 pb-20 text-left">
      <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-10 uppercase italic">{t('settings')}</h3>
      
      <div className="space-y-8">
        {/* IDENTIDAD VISUAL */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Identidad Visual</h4>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="space-y-3">
              <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Logo de Empresa</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-40 h-40 bg-gray-50 border-2 border-dashed border-gray-100 rounded-[2rem] flex items-center justify-center cursor-pointer overflow-hidden group hover:bg-gray-100 transition-all"
              >
                {logoPreview ? (
                  <img src={logoPreview} className="w-full h-full object-contain p-4" alt="Logo preview" />
                ) : (
                  <div className="text-center opacity-30 group-hover:opacity-50 transition-opacity">
                    <svg className="w-8 h-8 mx-auto mb-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span className="text-[8px] font-black uppercase">Subir Logo</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="flex items-center gap-4 cursor-pointer">
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={useLogo} onChange={(e) => setUseLogo(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Mostrar Logo en la Web</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase italic">Si está desactivado, se mostrará el nombre comercial</span>
                  </div>
                </label>
              </div>
              <Input label="Nombre Comercial" value={name} onChange={(e:any) => setName(e.target.value)} />
            </div>
          </div>
        </div>

        {/* DATOS DE CONTACTO */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Datos de Contacto</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Teléfono de Contacto" value={phone} onChange={(e:any) => setPhone(e.target.value)} />
            <Input label="Email Público" value={email} onChange={(e:any) => setEmail(e.target.value)} />
          </div>
        </div>

        {/* SUCURSALES */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Sucursales</h4>
            <button onClick={addBranch} className="text-[9px] font-black bg-slate-900 text-white px-4 py-2 rounded-full uppercase">+ Añadir</button>
          </div>
          <div className="space-y-6">
            {branches.map((b, i) => (
              <div key={i} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 relative">
                <button onClick={() => setBranches(branches.filter((_, idx)=>idx!==i))} className="absolute top-4 right-4 text-red-400 font-bold">×</button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><Input label="Nombre de Sucursal" value={b.name} onChange={(e:any)=>updateBranch(i,'name',e.target.value)} /></div>
                  <div className="md:col-span-2"><Input label="Dirección" value={b.address} onChange={(e:any)=>updateBranch(i,'address',e.target.value)} /></div>
                  <Input label="Teléfono" value={b.phone} onChange={(e:any)=>updateBranch(i,'phone',e.target.value)} />
                  <Input label="Email" value={b.email} onChange={(e:any)=>updateBranch(i,'email',e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CONTENIDO DEL FOOTER */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Contenido del Footer</h4>
          <div className="space-y-6">
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase text-gray-400">Descripción (ES)</label>
               <textarea value={footerEs} onChange={(e) => setFooterEs(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm min-h-[100px]" />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase text-gray-400">Descripció (CA)</label>
               <textarea value={footerCa} onChange={(e) => setFooterCa(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm min-h-[100px]" />
             </div>
          </div>
        </div>

        {/* REDES SOCIALES */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Redes Sociales (URLs)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <Input label="Instagram" value={socials.social_instagram} onChange={(e:any) => setSocials({...socials, social_instagram: e.target.value})} />
            <Input label="Facebook" value={socials.social_facebook} onChange={(e:any) => setSocials({...socials, social_facebook: e.target.value})} />
            <Input label="TikTok" value={socials.social_tiktok} onChange={(e:any) => setSocials({...socials, social_tiktok: e.target.value})} />
            <Input label="YouTube" value={socials.social_youtube} onChange={(e:any) => setSocials({...socials, social_youtube: e.target.value})} />
            <Input label="WhatsApp" value={socials.social_whatsapp} onChange={(e:any) => setSocials({...socials, social_whatsapp: e.target.value})} />
            <Input label="Telegram" value={socials.social_telegram} onChange={(e:any) => setSocials({...socials, social_telegram: e.target.value})} />
            <Input label="X (Twitter)" value={socials.social_x} onChange={(e:any) => setSocials({...socials, social_x: e.target.value})} />
            <Input label="LinkedIn" value={socials.social_linkedin} onChange={(e:any) => setSocials({...socials, social_linkedin: e.target.value})} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50">
          {saving ? 'GUARDANDO...' : 'ACTUALIZAR CONFIGURACIÓN'}
        </button>
      </div>
    </div>
  );
};
