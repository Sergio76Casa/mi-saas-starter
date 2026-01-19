import React, { useState } from 'react';
import { Tenant, Branch, Language, BusinessHours } from '../../types';

interface ContactModalProps {
    tenant: Tenant;
    branches: Branch[];
    language: Language;
    onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ tenant, branches, language, onClose }) => {
    const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');

    const selectedBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

    const isOpen = (branch: Branch): { open: boolean; message: string } => {
        if (!branch.business_hours) return { open: false, message: language === 'es' ? 'Horario no disponible' : 'Horari no disponible' };

        const now = new Date();
        const dayNames: (keyof BusinessHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = dayNames[now.getDay()];
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const schedule = branch.business_hours[currentDay];

        if (schedule.closed) {
            return { open: false, message: language === 'es' ? 'Cerrado hoy' : 'Tancat avui' };
        }

        if (currentTime >= schedule.open && currentTime < schedule.close) {
            return { open: true, message: language === 'es' ? `Abierto hasta las ${schedule.close}` : `Obert fins les ${schedule.close}` };
        }

        return { open: false, message: language === 'es' ? `Abre a las ${schedule.open}` : `Obre a les ${schedule.open}` };
    };

    const status = selectedBranch ? isOpen(selectedBranch) : { open: false, message: '' };

    const handleWhatsApp = () => {
        const phone = (tenant.social_whatsapp || tenant.phone || '').replace(/\s/g, '');
        const message = language === 'es'
            ? 'Hola, estoy interesado en sus servicios de climatización. ¿Podrían ayudarme?'
            : 'Hola, estic interessat en els vostres serveis de climatització. Podríeu ajudar-me?';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleCall = () => {
        const phone = selectedBranch?.phone || tenant.phone;
        if (phone) window.open(`tel:${phone}`, '_self');
    };

    const handleEmail = () => {
        const email = selectedBranch?.email || tenant.email;
        if (email) window.open(`mailto:${email}`, '_self');
    };

    const handleMap = () => {
        if (selectedBranch?.address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedBranch.address)}`, '_blank');
        }
    };

    const t = (key: string) => {
        const translations: Record<string, Record<Language, string>> = {
            title: { es: 'Contacta con nosotros', ca: 'Contacta amb nosaltres' },
            quick_actions: { es: 'Acciones Rápidas', ca: 'Accions Ràpides' },
            whatsapp: { es: 'WhatsApp', ca: 'WhatsApp' },
            call: { es: 'Llamar', ca: 'Trucar' },
            email: { es: 'Email', ca: 'Email' },
            map: { es: 'Mapa', ca: 'Mapa' },
            branches: { es: 'Nuestras Sucursales', ca: 'Les Nostres Sucursals' },
            select_branch: { es: 'Seleccionar sucursal', ca: 'Seleccionar sucursal' },
            all_branches: { es: 'Todas las sucursales', ca: 'Totes les sucursals' },
            open: { es: 'Abierto', ca: 'Obert' },
            closed: { es: 'Cerrado', ca: 'Tancat' },
            view_map: { es: 'Ver en mapa', ca: 'Veure al mapa' }
        };
        return translations[key]?.[language] || key;
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{t('title')}</h2>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    {/* Quick Actions */}
                    <div>
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">{t('quick_actions')}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <button onClick={handleWhatsApp} className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-2xl transition-all group">
                                <div className="w-12 h-12 bg-green-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                                </div>
                                <span className="text-[10px] font-black uppercase text-slate-700">{t('whatsapp')}</span>
                            </button>

                            <button onClick={handleCall} className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-2xl transition-all group">
                                <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                </div>
                                <span className="text-[10px] font-black uppercase text-slate-700">{t('call')}</span>
                            </button>

                            <button onClick={handleEmail} className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-2xl transition-all group">
                                <div className="w-12 h-12 bg-purple-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </div>
                                <span className="text-[10px] font-black uppercase text-slate-700">{t('email')}</span>
                            </button>

                            <button onClick={handleMap} className="flex flex-col items-center gap-2 p-4 bg-red-50 hover:bg-red-100 rounded-2xl transition-all group">
                                <div className="w-12 h-12 bg-red-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <span className="text-[10px] font-black uppercase text-slate-700">{t('map')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Branches */}
                    {branches.length > 0 && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">{t('branches')}</h3>

                            {branches.length > 1 && (
                                <select
                                    value={selectedBranchId}
                                    onChange={(e) => setSelectedBranchId(e.target.value)}
                                    className="w-full mb-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            )}

                            {selectedBranch && (
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">{selectedBranch.name}</h4>
                                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 ${status.open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            <div className={`w-2 h-2 rounded-full ${status.open ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            {status.open ? t('open') : t('closed')}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        {selectedBranch.address && (
                                            <div className="flex items-start gap-2">
                                                <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="text-slate-600 font-medium">{selectedBranch.address}</span>
                                            </div>
                                        )}
                                        {selectedBranch.phone && (
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                <span className="text-slate-600 font-medium">{selectedBranch.phone}</span>
                                            </div>
                                        )}
                                        {status.message && (
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <span className="text-slate-600 font-medium italic">{status.message}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-3 flex gap-2">
                                        <button onClick={handleMap} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                                            {t('view_map')}
                                        </button>
                                        <button onClick={handleCall} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                                            {t('call')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
