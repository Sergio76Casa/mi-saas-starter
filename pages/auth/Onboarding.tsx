
import React, { useState } from 'react';
// Use react-router for core functionality to bypass possible re-export issues in dom package
import { useNavigate, Navigate } from 'react-router';
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
        try {
            // 1. Crear el tenant
            const { data: tenant, error: tError } = await supabase
                .from('tenants')
                .insert([{ name, slug, status: 'active', is_deleted: false }])
                .select()
                .single();

            if (tError) throw tError;

            if (tenant && session?.user?.id) {
                // 2. Crear la membresía (Propietario)
                const { error: mError } = await supabase
                    .from('memberships')
                    .insert([{ 
                        user_id: session.user.id, 
                        tenant_id: tenant.id, 
                        role: 'owner' 
                    }]);
                
                if (mError) throw mError;

                // 3. Refrescar estado global antes de navegar
                await refreshProfile();
                
                // 4. Navegar al dashboard
                navigate(`/t/${slug}/dashboard`);
            }
        } catch (err: any) {
            console.error("Error en onboarding:", err.message);
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 md:p-6 text-center font-sans">
            <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-gray-100">
                <h2 className="text-3xl md:text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none uppercase italic">Workspace</h2>
                <form onSubmit={handleCreate} className="space-y-6">
                    <Input label="Nombre Empresa" value={name} onChange={(e:any) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')); }} required />
                    <Input label="Slug / URL personalizada" value={slug} onChange={(e: any) => setSlug(e.target.value)} required />
                    <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50">
                        {loading ? 'CONFIGURANDO...' : 'EMPEZAR AHORA'}
                    </button>
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
