
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase, SUPABASE_URL } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const ProductEditor = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [productData, setProductData] = useState<any>({ brand: '', model: '', pricing: [], installation_kits: [], extras: [] });
  const [financing, setFinancing] = useState<any[]>([]);
  const [techSpecs, setTechSpecs] = useState<any[]>([]);

  useEffect(() => { setLoading(false); }, []);

  const handleAiExtract = async (file: File) => {
    setAiLoading(true);
    console.log("--- START AI EXTRACTION DIAGNOSTIC ---");
    console.log("Target Supabase URL:", SUPABASE_URL);
    console.log("Project Ref (from URL):", SUPABASE_URL.split('.')[0].replace('https://', ''));

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const { data, error } = await supabase.functions.invoke('extract_products_from_file', {
        body: formData
      });

      console.log("INVOKE RAW RESULT ->", { data, error });

      if (error) throw error;
      
      if (data?.__version) {
        console.log("%cSUCCESS: Received version " + data.__version, "color: green; font-weight: bold;");
      } else {
        console.warn("%cWARNING: __version not found. You are likely seeing a cached or different deployment.", "color: orange; font-weight: bold;");
      }

      setProductData((prev: any) => ({
        ...prev,
        brand: data.brand || prev.brand,
        model: data.model || prev.model,
        pricing: data.pricing || [],
        installation_kits: data.installationKits || data.installation_kits || [],
        extras: data.extras || []
      }));
      if (data.financing) setFinancing(data.financing);

    } catch (err: any) {
      console.error("DIAGNOSTIC ERROR:", err.message);
    } finally {
      setAiLoading(false);
      console.log("--- END AI EXTRACTION DIAGNOSTIC ---");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-10 text-left">
      <h1 className="text-2xl font-black uppercase italic mb-10">Diagnóstico de Extractor</h1>
      <div className="bg-slate-50 p-8 rounded-3xl border border-dashed border-slate-200">
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subir PDF para probar</span>
          <div className="px-8 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[11px]">
            {aiLoading ? 'EXTRAYENDO...' : 'SELECCIONAR ARCHIVO'}
          </div>
          <input type="file" className="hidden" onChange={(e) => e.target.files && handleAiExtract(e.target.files[0])} />
        </label>
      </div>
      
      <div className="mt-10 grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4">Datos Crudos (State)</h4>
          <pre className="text-[10px] bg-slate-900 text-green-400 p-4 rounded-xl overflow-auto max-h-60">
            {JSON.stringify(productData, null, 2)}
          </pre>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4">Financiación (State)</h4>
          <pre className="text-[10px] bg-slate-900 text-blue-400 p-4 rounded-xl overflow-auto max-h-60">
            {JSON.stringify(financing, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
