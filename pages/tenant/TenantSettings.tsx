
import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Branch } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';

export const TenantSettings = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, refreshProfile } = useApp();
  
  // Estados Locales
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

  // Sincronizar estado local cuando el objeto tenant del contexto cambie (hidratación real-time)
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
  }, [tenant]); // Escuchar cambios en el objeto completo para re-hidratar tras refreshProfile

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
        const { error: storageError } = await supabase.storage.from('products').upload(path, logoFile);
        if (storageError) throw storageError;
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
        finalLogoUrl = publicUrl;
      }

      const cleanedSocials = {
        social_instagram: sanitizeUrl(socials.social_instagram),
        social_facebook: sanitizeUrl(socials.social_facebook),
        social_tiktok: sanitizeUrl(socials.social_tiktok),
        social_youtube: sanitizeUrl(socials.social_youtube),
        social_x: sanitizeUrl(socials.social_x),
        social_linkedin: sanitizeUrl(socials.social_linkedin),
        social_whatsapp: sanitizeUrl(socials.social_whatsapp),
        social_telegram: sanitizeUrl(socials.social_telegram)
      };

      const updatePayload = { 
        name,
        phone: phone.trim(),
        email: email.trim(),
        footer_description_es: footerEs.trim(),
        footer_description_ca: footerCa.trim(),
        ...cleanedSocials,
        logo_url: finalLogoUrl,
        use_logo_on_web: useLogo
      };

      const { error: tenantError } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', tenant.id);

      if (tenantError) throw tenantError;

      // Verificación inmediata post-update
      const { data: verifyData } = await supabase.from('tenants').select('*').eq('id', tenant.id).single();
      console.log("CONFIG_SAVE_VERIFIED_IN_DB:", verifyData);

      const branchesToSave = branches
        .filter(b => b.name?.trim() || b.address?.trim())
        .map(b => {
          const cleaned: any = { 
            name: b.name?.trim() || 'Sucursal',
            address: b.address?.trim() || '',
            tenant_id: tenant.id,
            is_active: b.is_active ?? true,
            sort_order: b.sort_order ?? 0
          };
          if (b.id && b.id !== "") cleaned.id = b.id;
          return cleaned;
        });

      if (branchesToSave.length > 0) {
        await supabase.from('tenant_branches').upsert(branchesToSave);
      }

      await refreshProfile();
      alert("Configuración actualizada correctamente.");
    } catch (err: any) {
      console.error("SAVE_ERROR:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl animate-in fade-in duration-500 mx-auto md:mx-0 pb-20 text-left">
      {/* Marcador de Depuración Temporal */}
      <div className="inline-block px-2 py-0.5 bg-red-600 text-white text-[8px] font-black rounded mb-4 animate-pulse">
        DEBUG_SETTINGS_RENDER_OK
      </div>
      
      <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-10 uppercase italic">{t('settings')}</h3>
      
      <div className="space-y-8">
        {/* EMPRESA */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Datos de la Empresa</h4>
          <Input label="Nombre de la Empresa" value={name} onChange={(e:any) => setName(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Teléfono" value={phone} onChange={(e:any) => setPhone(e.target.value)} placeholder="+34 ..." />
            <Input label="Email de contacto" value={email} onChange={(e:any) => setEmail(e.target.value)} placeholder="info@empresa.com" />
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Textos del Footer</h4>
          <div className="space-y-6">
             <div className="space-y-1.5">
               <div className="flex items-center gap-2 mb-2 ml-1">
                  <span className="bg-slate-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded">ES</span>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descripción Footer (Español)</label>
               </div>
               <textarea 
                 value={footerEs} 
                 onChange={(e) => setFooterEs(e.target.value)}
                 className="w-full px-6 py-4 border border-gray-100 rounded-2xl bg-gray-50 text-sm font-medium h-24 resize-none focus:ring-2 focus:ring-brand-500 outline-none transition-all"
               />
             </div>
             <div className="space-y-1.5">
               <div className="flex items-center gap-2 mb-2 ml-1">
                  <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded">CA</span>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descripció Footer (Català)</label>
               </div>
               <textarea 
                 value={footerCa} 
                 onChange={(e) => setFooterCa(e.target.value)}
                 className="w-full px-6 py-4 border border-gray-100 rounded-2xl bg-gray-50 text-sm font-medium h-24 resize-none focus:ring-2 focus:ring-brand-500 outline-none transition-all"
               />
             </div>
          </div>
        </div>

        {/* REDES SOCIALES */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Redes Sociales</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <Input label="Instagram" value={socials.social_instagram} onChange={(e:any) => setSocials({...socials, social_instagram: e.target.value})} placeholder="instagram.com/usuario" />
            <Input label="Facebook" value={socials.social_facebook} onChange={(e:any) => setSocials({...socials, social_facebook: e.target.value})} placeholder="facebook.com/pagina" />
            <Input label="TikTok" value={socials.social_tiktok} onChange={(e:any) => setSocials({...socials, social_tiktok: e.target.value})} placeholder="tiktok.com/@usuario" />
            <Input label="YouTube" value={socials.social_youtube} onChange={(e:any) => setSocials({...socials, social_youtube: e.target.value})} />
            <Input label="X (Twitter)" value={socials.social_x} onChange={(e:any) => setSocials({...socials, social_x: e.target.value})} />
            <Input label="LinkedIn" value={socials.social_linkedin} onChange={(e:any) => setSocials({...socials, social_linkedin: e.target.value})} />
            <Input label="WhatsApp" value={socials.social_whatsapp} onChange={(e:any) => setSocials({...socials, social_whatsapp: e.target.value})} placeholder="wa.me/34600000000" />
            <Input label="Telegram" value={socials.social_telegram} onChange={(e:any) => setSocials({...socials, social_telegram: e.target.value})} />
          </div>
        </div>

        {/* LOGO */}
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] italic">Identidad Visual</h4>
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div onClick={() => fileInputRef.current?.click()} className="w-40 h-40 rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50 flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-100 transition-all group relative">
              {logoPreview ? <img src={logoPreview} className="w-full h-full object-contain p-4" alt="Logo" /> : <div className="text-center p-4"><p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Subir logo</p></div>}
              <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }}} className="hidden" accept="image/*" />
            </div>
            <div className="flex-1">
              <label className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer">
                <span className="text-[10px] font-black uppercase text-gray-900">Usar logo en la web</span>
                <input type="checkbox" checked={useLogo} onChange={(e) => setUseLogo(e.target.checked)} className="w-5 h-5 accent-brand-600" />
              </label>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50"
        >
          {saving ? 'GUARDANDO...' : 'ACTUALIZAR CONFIGURACIÓN'}
        </button>
      </div>
    </div>
  );
};
