
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const Onboarding = () => {
    const { session, refreshProfile } = useApp();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { data: tenant, error } = await supabase.from('tenants').insert([{ name, slug }]).select().single();
        if (!error && tenant) {
            await supabase.from('memberships').insert([{ user_id: session?.user?.id, tenant_id: tenant.id, role: 'owner' }]);
            await refreshProfile();
            navigate(`/t/${slug}/dashboard`);
        } else alert("Error: " + error?.message);
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 md:p-6 text-center font-sans">
            <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-gray-100">
                <h2 className="text-3xl md:text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none uppercase italic">Workspace</h2>
                <form onSubmit={handleCreate} className="space-y-6">
                    <Input label="Nombre Empresa" value={name} onChange={(e:any) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')); }} required />
                    <Input label="Slug / URL personalizada" value={slug} onChange={(e: any) => setSlug(e.target.value)} required />
                    <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">{loading ? '...' : 'EMPEZAR'}</button>
                </form>
            </div>
        </div>
    );
};

export const OnboardingWrapper = () => {
  const { session, loading } = useApp();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" />;
  return <Onboarding />;
};
