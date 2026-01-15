
import React from 'react';

export const AdminDashboard = () => (
  <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 text-left">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
      {[ { label: 'Tenants', val: '24', icon: '🏢' }, { label: 'Usuarios', val: '1,2k', icon: '👥' }, { label: 'MRR', val: '8.450€', icon: '💰' }, { label: 'Uptime', val: '99.9%', icon: '⚡' } ].map((s, i) => (
        <div key={i} className="bg-white/5 border border-white/5 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] relative overflow-hidden group hover:bg-white/10 transition-all">
          <div className="absolute -right-4 -bottom-4 text-6xl md:text-8xl opacity-5 group-hover:scale-110 transition-all">{s.icon}</div>
          <div className="text-slate-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-2">{s.label}</div>
          <div className="text-3xl md:text-4xl font-black text-white tracking-tighter">{s.val}</div>
        </div>
      ))}
    </div>
  </div>
);
