
import React, { useState } from 'react';
// Use core routing hooks from react-router
import { useNavigate } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Input } from '../../components/common/Input';

export const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (!error) navigate('/login'); else alert(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 md:p-6 font-sans">
      <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-gray-100 text-center">
        <h2 className="text-3xl md:text-4xl font-black mb-10 text-gray-900 tracking-tighter uppercase italic">Registro</h2>
        <form onSubmit={handleSignup} className="space-y-6">
          <Input label="Nombre" type="text" value={fullName} onChange={(e: any) => setFullName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
          <Input label="Contraseña" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <button type="submit" className="w-full py-5 bg-brand-600 text-white rounded-xl md:rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">REGISTRARME</button>
        </form>
      </div>
    </div>
  );
};
