
import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Branch } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { BusinessHoursEditor, defaultHours } from '../../components/common/BusinessHoursEditor';

export const TenantSettings = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, refreshProfile, memberships, session } = useApp();

  // Datos generales
  const [name, setName] = useState(tenant.name);
  const [phone, setPhone] = useState(tenant.phone || '');
  const [email, setEmail] = useState(tenant.email || '');
  const [footerEs, setFooterEs] = useState(tenant.footer_description_es || '');
  const [footerCa, setFooterCa] = useState(tenant.footer_description_ca || '');

  // Configuración WhatsApp / Share
  const [shareTitle, setShareTitle] = useState(tenant.share_title || '');
  const [shareDescription, setShareDescription] = useState(tenant.share_description || '');
  const [shareImageUrl, setShareImageUrl] = useState(tenant.share_image_url || '');
  const [whatsappPrefill, setWhatsappPrefill] = useState(tenant.whatsapp_prefill_text || '');
  const [shareFile, setShareFile] = useState<File | null>(null);

  // Redes Sociales
  const [socials, setSocials] = useState({
    social_instagram: tenant.social_instagram || '',
    social_facebook: tenant.social_facebook || '',
    social_tiktok: tenant.social_tiktok || '',
    social_whatsapp: tenant.social_whatsapp || '',
    social_linkedin: tenant.social_linkedin || ''
  });

  const [useLogo, setUseLogo] = useState(tenant.use_logo_on_web ?? false);
  const [logoPreview, setLogoPreview] = useState(tenant.logo_url || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Partial<Branch>[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareImgRef = useRef<HTMLInputElement>(null);

  // Verificar si el usuario es Admin u Owner
  const userMembership = memberships.find(m => m.tenant_id === tenant.id);
  const isAdmin = userMembership?.role === 'owner' || userMembership?.role === 'admin';

  useEffect(() => {
    if (!tenant || saving) return;
    setName(tenant.name || '');
    setPhone(tenant.phone || '');
    setEmail(tenant.email || '');
    setFooterEs(tenant.footer_description_es || '');
    setFooterCa(tenant.footer_description_ca || '');
    setShareTitle(tenant.share_title || '');
    setShareDescription(tenant.share_description || '');
    setShareImageUrl(tenant.share_image_url || '');
    setWhatsappPrefill(tenant.whatsapp_prefill_text || '');
    setSocials({
      social_instagram: tenant.social_instagram || '',
      social_facebook: tenant.social_facebook || '',
      social_tiktok: tenant.social_tiktok || '',
      social_whatsapp: tenant.social_whatsapp || '',
      social_linkedin: tenant.social_linkedin || ''
    });
    setUseLogo(tenant.use_logo_on_web ?? false);
    setLogoPreview(tenant.logo_url || '');
  }, [tenant]);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!tenant.id) return;
      const { data } = await supabase.from('tenant_branches').select('*').eq('tenant_id', tenant.id).order('sort_order', { ascending: true });
      if (data) setBranches(data);
    };
    fetchBranches();
  }, [tenant.id]);

  const handleSave = async () => {
    if (!isAdmin) return alert("No tienes permisos de administrador para guardar cambios.");
    setSaving(true);
    try {
      // 1. Subida de Logo si existe
      let finalLogoUrl = logoPreview;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo_${Date.now()}.${fileExt}`;
        const path = `${tenant.id}/branding/${fileName}`;
        await supabase.storage.from('products').upload(path, logoFile);
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
        finalLogoUrl = publicUrl;
      }

      // 2. Subida de Imagen WhatsApp si existe
      let finalShareImgUrl = shareImageUrl;
      if (shareFile) {
        const fileExt = shareFile.name.split('.').pop();
        const fileName = `share_${Date.now()}.${fileExt}`;
        const path = `${tenant.id}/branding/${fileName}`;
        await supabase.storage.from('products').upload(path, shareFile);
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
        finalShareImgUrl = publicUrl;
      }

      const updatePayload = {
        name,
        phone,
        email,
        footer_description_es: footerEs,
        footer_description_ca: footerCa,
        share_title: shareTitle,
        share_description: shareDescription,
        share_image_url: finalShareImgUrl,
        whatsapp_prefill_text: whatsappPrefill,
        logo_url: finalLogoUrl,
        use_logo_on_web: useLogo,
        ...socials
      };

      const { error: updateError } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', tenant.id);

      if (updateError) throw updateError;

      // Upsert sucursales
      if (branches.length > 0) {
        const branchesToSave = branches.map((b, idx) => ({ ...b, tenant_id: tenant.id, sort_order: idx }));
        await supabase.from('tenant_branches').upsert(branchesToSave);
      }

      await refreshProfile();
      alert("✅ Configuración guardada correctamente.");
    } catch (err: any) {
      alert("❌ Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleShareImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setShareFile(file);
      setShareImageUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div className="max-w-4xl animate-in fade-in duration-500 mx-auto md:mx-0 pb-20 text-left">
      <div className="flex justify-between items-center mb-10">
        <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{t('settings')}</h3>
        {!isAdmin && (
          <div className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-amber-100 flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Sólo lectura (Admin)
          </div>
        )}
      </div>

      <div className="space-y-10">

        {/* COMPARTIR EN WHATSAPP (Nueva sección mejorada) */}
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic mb-1">Presencia en Redes</h4>
              <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Compartir en WhatsApp</h2>
            </div>
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412s-1.239 6.167-3.488 8.413c-2.248 2.244-5.231 3.484-8.411 3.484h-.001c-2.008 0-3.975-.521-5.714-1.506l-6.276 1.649zm6.151-3.692l.332.197c1.472.873 3.136 1.335 4.845 1.335h.001c5.446 0 9.876-4.43 9.878-9.876.001-2.64-1.029-5.12-2.899-6.992s-4.353-2.901-6.993-2.902c-5.448 0-9.879 4.432-9.881 9.879 0 1.83.509 3.618 1.474 5.176l.216.35-.97 3.541 3.633-.953z" /></svg>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Formulario de Configuración */}
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Imagen de la tarjeta</label>
                <div
                  onClick={() => isAdmin && shareImgRef.current?.click()}
                  className={`w-full h-44 bg-slate-50 border-2 border-dashed rounded-[1.8rem] flex items-center justify-center overflow-hidden group transition-all ${isAdmin ? 'cursor-pointer hover:bg-slate-100 hover:border-green-400 border-slate-200' : 'cursor-not-allowed border-slate-100 opacity-60'}`}
                >
                  {shareImageUrl ? (
                    <img src={shareImageUrl} className="w-full h-full object-cover" alt="Share preview" />
                  ) : (
                    <div className="text-center opacity-30">
                      <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[9px] font-black uppercase">Subir Banner Social</span>
                      <p className="text-[7px] mt-1">Recomendado: 1200x630 (PNG/JPG)</p>
                    </div>
                  )}
                  <input type="file" ref={shareImgRef} className="hidden" accept="image/*" onChange={handleShareImgChange} disabled={!isAdmin} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between px-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Título de la Tarjeta</label>
                    <span className={`text-[8px] font-black ${shareTitle.length > 120 ? 'text-red-500' : 'text-slate-300'}`}>{shareTitle.length}/120</span>
                  </div>
                  <input
                    disabled={!isAdmin}
                    value={shareTitle}
                    onChange={(e) => setShareTitle(e.target.value.substring(0, 150))}
                    placeholder="Ej: Aire Acondicionado Premium en Sabadell"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between px-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Texto descriptivo corto</label>
                    <span className={`text-[8px] font-black ${shareDescription.length > 300 ? 'text-red-500' : 'text-slate-300'}`}>{shareDescription.length}/300</span>
                  </div>
                  <textarea
                    disabled={!isAdmin}
                    value={shareDescription}
                    onChange={(e) => setShareDescription(e.target.value.substring(0, 500))}
                    placeholder="Breve descripción que aparecerá bajo el título..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium h-24 resize-none outline-none focus:ring-2 focus:ring-green-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Simulador Interactivo */}
            <div className="space-y-4">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Vista Previa (Simulador)</label>
              <div className="bg-slate-100 p-8 rounded-[2.5rem] flex items-center justify-center">
                <div className="w-full max-w-[280px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-500">
                  <div className="h-32 bg-slate-200 relative overflow-hidden flex items-center justify-center">
                    {shareImageUrl ? (
                      <img src={shareImageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Banner Imagen</span>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-1">
                    <h5 className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-1 truncate">{shareTitle || 'Título de ejemplo para compartir'}</h5>
                    <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{shareDescription || 'Aquí aparecerá la descripción corta que configures para tus enlaces de WhatsApp...'}</p>
                    <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest block pt-1">{tenant.slug}.ecoteq.com</span>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 italic font-medium px-4 text-center leading-relaxed">
                * Así es como verán tus clientes el enlace cuando se lo envíes por WhatsApp o lo publiques en tus estados.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-50">
            <div className="flex items-center gap-3 mb-4 px-1">
              <div className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.26.26-.53.26l.213-3.05 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" /></svg>
              </div>
              <h5 className="text-[11px] font-black uppercase text-slate-700 tracking-widest">Texto Predeterminado de Envío</h5>
            </div>
            <textarea
              disabled={!isAdmin}
              value={whatsappPrefill}
              onChange={(e) => setWhatsappPrefill(e.target.value)}
              placeholder="¡Hola! He estado revisando vuestro catálogo y me gustaría pedir presupuesto para este equipo..."
              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium h-24 resize-none outline-none focus:ring-2 focus:ring-green-500 transition-all"
            />
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-2 ml-1 italic">
              Este texto aparecerá automáticamente en el móvil del cliente cuando pulse "Compartir por WhatsApp".
            </p>
          </div>
        </div>

        {/* IDENTIDAD VISUAL */}
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm space-y-8 opacity-80 hover:opacity-100 transition-opacity">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic text-left">{t('settings_visual_id')}</h4>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="space-y-3">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">{t('settings_logo_label')}</label>
              <div
                onClick={() => isAdmin && fileInputRef.current?.click()}
                className={`w-40 h-40 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex items-center justify-center overflow-hidden transition-all ${isAdmin ? 'cursor-pointer hover:bg-slate-100' : 'cursor-not-allowed opacity-60'}`}
              >
                {logoPreview ? (
                  <img src={logoPreview} className="w-full h-full object-contain p-4" alt="Logo preview" />
                ) : (
                  <div className="text-center opacity-30">
                    <svg className="w-8 h-8 mx-auto mb-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[8px] font-black uppercase">{t('settings_logo_upload')}</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])); } }} disabled={!isAdmin} />
              </div>
            </div>

            <div className="flex-1 space-y-6 w-full">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <label className="flex items-center gap-4 cursor-pointer">
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={useLogo} onChange={(e) => isAdmin && setUseLogo(e.target.checked)} className="sr-only peer" disabled={!isAdmin} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">{t('settings_logo_show_web')}</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase italic">{t('settings_logo_hint')}</span>
                  </div>
                </label>
              </div>
              <Input disabled={!isAdmin} label={t('settings_commercial_name')} value={name} onChange={(e: any) => setName(e.target.value)} />
            </div>
          </div>
        </div>

        {/* DATOS DE CONTACTO */}
        <div className="bg-white p-6 md:p-10 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic text-left">{t('settings_contact_title')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input disabled={!isAdmin} label={t('settings_contact_phone')} value={phone} onChange={(e: any) => setPhone(e.target.value)} />
            <Input disabled={!isAdmin} label={t('settings_contact_email')} value={email} onChange={(e: any) => setEmail(e.target.value)} />
          </div>
        </div>

        {/* SUCURSALES */}
        <div className="bg-white p-6 md:p-10 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic text-left">{t('settings_branches_title')}</h4>
            {isAdmin && <button onClick={() => setBranches([...branches, { name: '', address: '', phone: '', email: '', is_active: true }])} className="text-[9px] font-black bg-slate-900 text-white px-4 py-2 rounded-full uppercase tracking-widest">+ Añadir</button>}
          </div>
          <div className="space-y-6">
            {branches.map((b, i) => (
              <div key={i} className="p-6 bg-slate-50 rounded-3xl border-slate-100 border relative text-left">
                {isAdmin && <button onClick={() => setBranches(branches.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 text-red-400 font-bold text-xl">×</button>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><Input disabled={!isAdmin} label={t('settings_branch_name')} value={b.name} onChange={(e: any) => { const c = [...branches]; c[i].name = e.target.value; setBranches(c); }} /></div>
                  <div className="md:col-span-2"><Input disabled={!isAdmin} label={t('address')} value={b.address} onChange={(e: any) => { const c = [...branches]; c[i].address = e.target.value; setBranches(c); }} /></div>

                  {/* Business Hours Editor */}
                  <div className="md:col-span-2 mt-4">
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-3 block">Horario de Atención</label>
                    <BusinessHoursEditor
                      hours={b.business_hours || defaultHours}
                      onChange={(hours) => {
                        const c = [...branches];
                        c[i].business_hours = hours;
                        setBranches(c);
                      }}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <button onClick={handleSave} disabled={saving} className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl shadow-slate-900/20 disabled:opacity-50 active:scale-[0.98]">
            {saving ? t('settings_btn_saving') : t('settings_btn_update')}
          </button>
        )}
      </div>
    </div>
  );
};
