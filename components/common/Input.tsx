
import React from 'react';

export const Input = ({ label, ...props }: any) => (
  <div className="mb-4 text-left w-full">
    {label && <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">{label}</label>}
    <input className="w-full px-4 py-3 border border-gray-100 rounded-xl md:rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-gray-50/50" {...props} />
  </div>
);
