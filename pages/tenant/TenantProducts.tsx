
import React, { useState, useEffect, useMemo } from 'react';
// Import routing hooks from react-router to avoid export issues in react-router-dom
import { useOutletContext, useNavigate, useParams } from 'react-router';
import { supabase } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { formatCurrency } from '../../i18n';

const TYPES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Caldera' },
  { id: 'termo_electrico', label: 'Termo Eléctrico' }
];

const STATUS_MAP = {
  active: { label: 'Activo', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-100' },
  inactive: { label: 'Inactivo', color: 'bg-slate-400', bgColor: 'bg-slate-50', textColor: 'text-slate-500', borderColor: 'border-slate-200' },
  draft: { label: 'Borrador', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-100' }
};

export const TenantProducts = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { slug } = useParams();
  const { language } = useApp();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const fetchProducts = async () => {
    if (!tenant?.id) {
        console.warn("No se puede cargar el inventario: ID de empresa ausente.");
        setLoading(false);
        return;
    }
    setLoading(true);
    
    try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenant.id)
          .or('is_deleted.eq.false,is_deleted.is.null')
          .order('brand', { ascending: true });
        
        if (error) {
          console.error("Error de Supabase al recuperar productos:", error.message);
        } else {
          setProducts((data as Product[]) || []);
        }
    } catch (err: any) {
        console.error("Error crítico en fetchProducts:", err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { 
    if (tenant?.id) fetchProducts(); 
  }, [tenant?.id]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const brand = p.brand || '';
      const model = p.model || '';
      const matchesSearch = searchTerm === '' || 
        brand.toLowerCase().includes(searchTerm.toLowerCase()) || 
        model.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [products, searchTerm, filterType]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este producto?")) return;
    
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    
    if (!error) {
      fetchProducts();
    } else {
      alert("Error al eliminar: " + error.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 px-1">
        <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Inventario</h3>
        <button 
          onClick={() => navigate(`/t/${slug}/products/new/edit`)}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:scale-[1.02] transition-all"
        >
           <span className="text-lg">+</span> Nuevo Producto
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
          <div className="relative w-full md:w-64">
             <input 
               type="text"
               placeholder="Buscar marca o modelo..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-4 pr-10 py-3 text-xs border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium shadow-sm"
             />
          </div>
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full md:w-48 px-4 py-3 text-xs border border-slate-100 rounded-xl outline-none bg-white font-black uppercase tracking-widest cursor-pointer shadow-sm"
          >
            <option value="all">Todos los tipos</option>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-white text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-50">
              <tr>
                <th className="px-8 py-6">Marca / Modelo</th>
                <th className="px-6 py-6">Tipo</th>
                <th className="px-6 py-6">Variantes y Precios</th>
                <th className="px-6 py-6 text-center">Stock</th>
                <th className="px-6 py-6 text-center">Estado</th>
                <th className="px-6 py-6 text-center">Multimedia</th>
                <th className="px-6 py-6 text-center">Ficha Origen</th>
                <th className="px-8 py-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map((p) => {
                const statusInfo = STATUS_MAP[p.status || 'active'];
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-8 text-left">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-center p-2 shrink-0 overflow-hidden">
                          {p.image_url ? (
                            <img src={p.image_url} className="w-full h-full object-contain" alt={p.model} />
                          ) : (
                            <svg className="w-7 h-7 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[14px] font-black text-slate-900 leading-tight tracking-tight uppercase italic">{p.brand || 'S/M'}</span>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{p.model || 'S/M'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-8 text-left">
                      <span className="inline-flex px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-lg border border-slate-200/50">
                        {TYPES.find(t => t.id === p.type)?.label || p.type || 'S/T'}
                      </span>
                    </td>
                    <td className="px-6 py-8 text-left">
                      <div className="space-y-2 max-w-[240px]">
                        {p.pricing && Array.isArray(p.pricing) && p.pricing.length > 0 ? p.pricing.map((v: any, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white/50 border border-slate-100 px-3 py-2 rounded-xl text-[10px] font-medium">
                            <span className="text-slate-500 font-bold truncate max-w-[120px]">
                              {v.name && typeof v.name === 'object' ? (v.name[language] || v.name.es) : v.variant || p.model}
                            </span>
                            <span className="font-black text-blue-600 shrink-0">{formatCurrency(v.price, language)}</span>
                          </div>
                        )) : (
                          <span className="text-[10px] font-black text-slate-300 uppercase italic">Sin Precios</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-[13px] font-black tabular-nums ${p.stock && p.stock > 0 ? 'text-slate-900' : 'text-red-500'}`}>
                          {p.stock || 0}
                        </span>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Unidades</span>
                      </div>
                    </td>
                    <td className="px-6 py-8 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${statusInfo.bgColor} ${statusInfo.textColor} ${statusInfo.borderColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.color}`}></span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{statusInfo.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-8">
                      <div className="flex justify-center items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${p.image_url ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-200'}`}></div>
                          <span className="text-[8px] font-black text-slate-300 uppercase">IMG</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${p.brand_logo_url ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-200'}`}></div>
                          <span className="text-[8px] font-black text-slate-300 uppercase">LOG</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-8 text-center">
                      <div className="flex justify-center">
                        {p.pdf_url ? (
                          <a href={p.pdf_url} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-100/50 shadow-sm" title="Ver Documento de Extracción">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                          </a>
                        ) : (
                          <span className="text-slate-200 font-black text-[10px] uppercase italic">Sin Ficha</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-8 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => navigate(`/t/${slug}/products/${p.id}/edit`)}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                          title="Borrar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-24 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-xs italic">No hay productos en el inventario de {tenant.name}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
