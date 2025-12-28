
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { PlatformContent } from '../../types';
import { useApp } from '../../AppProvider';

export const AdminCMS = () => {
  const [content, setContent] = useState<PlatformContent[]>([]);
  const [editing, setEditing] = useState<PlatformContent | null>(null);
  const { dbHealthy } = useApp();

  const fetchCMS = async () => {
    if (!dbHealthy) return;
    const { data } = await supabase.from('platform_content').select('*');
    if (data) setContent(data);
  };

  useEffect(() => { fetchCMS(); }, [dbHealthy]);

  const handleSave = async () => {
    if (!editing) return;
    const { error } = await supabase.from('platform_content').upsert([editing]);
    if (!error) { fetchCMS(); setEditing(null); }
  };

  return (
    <div className="space-y-6 text-left">
      <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Editor Global (CMS)</h3>
      {editing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-white/10 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh]">
              <h4 className="text-lg md:text-xl font-black text-white mb-8">Editar Nodo: <span className="text-brand-500 text-[10px] font-mono">{editing.key}</span></h4>
              <div className="space-y-6"><textarea value={editing.es} onChange={e => setEditing({...editing, es: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none" /><textarea value={editing.ca} onChange={e => setEditing({...editing, ca: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-6 text-sm text-slate-200 h-32 outline-none" /></div>
              <div className="flex gap-4 mt-10"><button onClick={handleSave} className="flex-1 py-4 bg-brand-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] uppercase">Publicar</button><button onClick={() => setEditing(null)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase">Cerrar</button></div>
           </div>
        </div>
      )}
      <div className="bg-white/5 border border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[500px]"><thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest"><tr><th className="px-10 py-6">Clave</th><th className="px-10 py-6 text-right">Acción</th></tr></thead><tbody className="divide-y divide-white/5">{content.map(item => (
          <tr key={item.key} className="hover:bg-white/[0.02] transition-colors"><td className="px-10 py-6 font-mono text-[10px] text-brand-400 font-black tracking-widest">{item.key}</td><td className="px-10 py-6 text-right"><button onClick={() => setEditing(item)} className="px-5 py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase">Editar</button></td></tr>
        ))}</tbody></table>
      </div>
    </div>
  );
};
