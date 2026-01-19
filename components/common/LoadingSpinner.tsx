import React from 'react';

export const LoadingSpinner = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
    <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent shadow-xl"></div>
    <p className="mt-6 text-gray-500 font-black uppercase tracking-widest text-[10px] animate-pulse italic">Conectando...</p>
  </div>
);