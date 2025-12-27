
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { formatCurrency } from '../../i18n';

const TYPES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Caldera' },
  { id: 'termo_electrico', label: 'Termo Eléctrico' }
];

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
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenant.id)
          .neq('is_deleted', true)
          .order('brand', { ascending: true });
        
        if (error) console.error(error.message);
        else setProducts(data as Product[] || []);
    } catch (err: any) {
        console.error("Error fetching products");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { 
    if (tenant?.id) fetchProducts(); 
  }, [tenant?.id]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = searchTerm === '' || 
        p.brand.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.model.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [products, searchTerm, filterType]);

  const handleEdit = (productId: string) => {
    navigate(`/t/${slug}/products/${productId}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este producto?")) return;
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true })
      .eq('id', id);
    if (!error) fetchProducts();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <h3 className="text-xl font-bold text-slate-800">Administración · Inventario</h3>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => navigate(`/t/${slug}/products/new/edit`)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-blue-500/20"
          >
             <span className="text-lg">+</span> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
          <input 
            type="text"
            placeholder="Buscar por marca o modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64 px-4 py-2 text-xs border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full md:w-48 px-4 py-2 text-xs border border-slate-100 rounded-xl outline-none bg-white"
          >
            <option value="all">Todos los tipos</option>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-white text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-50">
              <tr>
                <th className="px-8 py-6">MARCA / MODELO</th>
                <th className="px-6 py-6">TIPO</th>
                <th className="px-6 py-6">PRECIOS</th>
                <th className="px-6 py-6 text-center">IMÁGENES</th>
                <th className="px-6 py-6 text-center">FICHA</th>
                <th className="px-8 py-6 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} className="w-full h-full object-contain" alt={product.model} />
                        ) : (
                          <svg className="w-6 h-6 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black text-slate-900 leading-tight">{product.brand}</span>
                          <span className={`w-2 h-2 rounded-full ${product.status === 'active' ? 'bg-green-500' : product.status === 'draft' ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{product.model}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-8">
                    <span className="inline-flex px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-lg">
                      {TYPES.find(t => t.id === product.type)?.label || product.type}
                    </span>
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex flex-col gap-1">
                      {product.pricing?.slice(0, 3).map((v, idx) => (
                        <div key={idx} className="text-[11px] font-medium text-slate-500">
                          {v.variant}: <span className="font-black text-blue-600 ml-1">{formatCurrency(v.price, language)}</span>
                        </div>
                      ))}
                      {product.pricing?.length > 3 && <div className="text-[9px] font-bold text-slate-300">+{product.pricing.length - 3} más...</div>}
                    </div>
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex justify-center items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${product.image_url ? 'bg-green-500' : 'bg-slate-200'}`} title="Producto"></div>
                      <div className={`w-2 h-2 rounded-full ${product.brand_logo_url ? 'bg-blue-500' : 'bg-slate-200'}`} title="Marca"></div>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      {product.pdf_url ? (
                        <a href={product.pdf_url} target="_blank" rel="noreferrer" className="text-blue-500 p-1 hover:scale-110 transition-transform">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </a>
                      ) : (
                        <span className="text-slate-200">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-8 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <button onClick={() => handleEdit(product.id)} className="text-slate-300 hover:text-blue-600 transition-colors" title="Editar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-300 font-bold italic text-sm">No se encontraron productos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
