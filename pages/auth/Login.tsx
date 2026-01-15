
import React, { useState } from 'react';
// Import routing hooks from react-router to avoid export issues in react-router-dom
import { useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../../supabaseClient';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { refreshProfile, enterDemoMode } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert("Error: Supabase no está configurado. Revisa las variables de entorno.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { 
      await refreshProfile(); 
      const returnTo = searchParams.get('returnTo');
      navigate(returnTo || '/'); 
    } else alert("Error de acceso.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 md:p-6 font-sans">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
        <div className="bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-500"></div>
          <h2 className="text-3xl md:text-4xl font-black mb-10 text-gray-900 tracking-tighter leading-none uppercase italic">Acceso</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
            <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
            <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl">ENTRAR</button>
          </form>
          <button onClick={() => { enterDemoMode(); navigate('/t/demo/dashboard'); }} className="w-full py-4 mt-8 bg-white text-gray-700 border border-gray-100 rounded-xl md:rounded-2xl font-black text-[10px] uppercase tracking-widest">Modo Demo</button>
        </div>
      </div>
    </div>
  );
};
