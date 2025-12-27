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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Grouping logic by Brand + Model + Type
  const groupedProducts = useMemo(() => {
    const groups: Record<string, {
      id: string;
      brand: string;
      model: string;
      type: string;
      variants: { variant: string; price: number }[];
      ids: string[];
      pdfUrl?: string;
      imageUrl?: string;
      brandLogoUrl?: string;
      minPrice: number;
    }> = {};

    products.forEach(p => {
      const b = (p.brand || 'SIN MARCA').toUpperCase();
      const m = (p.model || 'ESTÁNDAR').toUpperCase();
      const t = p.type || 'aire_acondicionado';
      const key = `${b}||${m}||${t}`;

      if (!groups[key]) {
        groups[key] = {
          id: p.id,
          brand: b,
          model: m,
          type: t,
          variants: [],
          ids: [],
          pdfUrl: p.pdf_url,
          imageUrl: p.image_url,
          brandLogoUrl: p.brand_logo_url,
          minPrice: Infinity
        };
      }
      
      groups[key].ids.push(p.id);

      const rowPricing = Array.isArray(p.pricing) ? p.pricing : (p.pricing ? [p.pricing] : []);
      rowPricing.forEach((v: any) => {
        const vPrice = Number(v.price) || 0;
        groups[key].variants.push({
          variant: v.variant || v.name || 'Estándar',
          price: vPrice
        });
        if (vPrice < groups[key].minPrice) groups[key].minPrice = vPrice;
      });
    });

    return Object.values(groups).filter(g => {
      const matchesSearch = searchTerm === '' || 
        g.brand.toLowerCase().includes(searchTerm.toLowerCase()) || 
        g.model.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || g.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [products, searchTerm, filterType]);

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
        
        if (error) setFetchError(error.message);
        else setProducts(data as Product[] || []);
    } catch (err: any) {
        setFetchError("Error de conexión");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { 
    if (tenant?.id) fetchProducts(); 
  }, [tenant?.id]);

  const handleEdit = (productId: string) => {
    navigate(`/t/${slug}/products/${productId}/edit`);
  };

  const handleAddNew = () => {
    navigate(`/t/${slug}/products/new/edit`);
  };

  const handleDeleteFamily = async (ids: string[]) => {
    if (!tenant?.id || !window.confirm(`¿Desea eliminar esta familia de productos?`)) return;
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true })
      .in('id', ids)
      .eq('tenant_id', tenant.id);
    if (!error) fetchProducts();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <h3 className="text-xl font-bold text-slate-800">Inventario</h3>
        <div className="flex gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-brand-500/20">
             <span className="text-lg">✨</span> Importar con IA
          </button>
          <button 
            onClick={handleAddNew} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-blue-500/20"
          >
             <span className="text-lg">+</span> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
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
              {groupedProducts.map((group) => (
                <tr key={group.id} className="hover:bg-slate-50/30 transition-colors group">
                  {/* MARCA / MODELO */}
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                        {group.imageUrl ? (
                          <img src={group.imageUrl} className="w-full h-full object-contain" />
                        ) : (
                          <svg className="w-6 h-6 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-black text-slate-900 leading-tight">{group.brand}</span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{group.model}</span>
                      </div>
                    </div>
                  </td>

                  {/* TIPO */}
                  <td className="px-6 py-8">
                    <span className="inline-flex px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-lg">
                      {TYPES.find(t => t.id === group.type)?.label || group.type}
                    </span>
                  </td>

                  {/* PRECIOS */}
                  <td className="px-6 py-8">
                    <div className="flex flex-col gap-1">
                      {group.variants.map((v, idx) => (
                        <div key={idx} className="text-[11px] font-medium text-slate-500">
                          {group.brand} {group.model} {v.variant}: <span className="font-black text-blue-600 ml-1">{formatCurrency(v.price, language)}</span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* IMÁGENES (Puntos) */}
                  <td className="px-6 py-8">
                    <div className="flex justify-center items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${group.imageUrl ? 'bg-green-500' : 'bg-slate-200'}`} title="Producto"></div>
                      <div className={`w-2 h-2 rounded-full ${group.brandLogoUrl ? 'bg-blue-500' : 'bg-slate-200'}`} title="Marca"></div>
                    </div>
                  </td>

                  {/* FICHA (Icono) */}
                  <td className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      {group.pdfUrl ? (
                        <a href={group.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-500 p-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </a>
                      ) : (
                        <span className="text-slate-200">-</span>
                      )}
                    </div>
                  </td>

                  {/* ACCIONES */}
                  <td className="px-8 py-8 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <button className="text-slate-300 hover:text-slate-500 transition-colors" title="Duplicar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                      </button>
                      <button onClick={() => handleEdit(group.id)} className="text-slate-300 hover:text-blue-600 transition-colors" title="Editar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button onClick={() => handleDeleteFamily(group.ids)} className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && groupedProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-300 font-bold italic text-sm">No hay productos en el inventario</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};