import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Tenant, Product } from '../../types';
import { useApp } from '../../AppProvider';
import { formatCurrency } from '../../i18n';

const TYPES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Calderas' },
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
  const [maxPrice, setMaxPrice] = useState(10000);

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
          pdfUrl: p.pdfUrl,
          imageUrl: p.imageUrl,
          brandLogoUrl: p.brandLogoUrl,
          minPrice: Infinity
        };
      }
      
      groups[key].ids.push(p.id);

      // Handle variants in pricing jsonb
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

    // Filter resulting groups
    return Object.values(groups).filter(g => {
      const matchesSearch = searchTerm === '' || 
        g.brand.toLowerCase().includes(searchTerm.toLowerCase()) || 
        g.model.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || g.type === filterType;
      
      const priceToCompare = g.minPrice === Infinity ? 0 : g.minPrice;
      const matchesPrice = priceToCompare <= maxPrice;

      return matchesSearch && matchesType && matchesPrice;
    });
  }, [products, searchTerm, filterType, maxPrice]);

  const fetchProducts = async () => {
    if (!tenant?.id) {
        setLoading(false);
        return;
    }
    setLoading(true);
    setFetchError(null);

    try {
        // CORRECCIÓN: Uso de tenant_id y filtro neq para is_deleted
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenant.id)
          .neq('is_deleted', true)
          .order('brand', { ascending: true });
        
        if (error) {
            console.error("Supabase Error [fetchProducts]:", error);
            setFetchError(`Error de base de datos: ${error.message}`);
        } else {
            setProducts(data as Product[] || []);
        }
    } catch (err: any) {
        console.error("Unexpected Error [fetchProducts]:", err);
        setFetchError("Ocurrió un error inesperado al cargar el inventario.");
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
    if (!tenant?.id || !window.confirm(`¿Desea eliminar esta familia de productos (${ids.length} registros)?`)) return;
    
    // CORRECCIÓN: Uso de tenant_id para asegurar RLS y borrado correcto
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true })
      .in('id', ids)
      .eq('tenant_id', tenant.id);

    if (error) {
        alert("Error al eliminar: " + error.message);
    } else {
        fetchProducts();
    }
  };

  if (!tenant?.id && !loading) {
      return (
        <div className="p-12 text-center">
            <p className="text-slate-400 font-black uppercase text-xs italic tracking-widest">Esperando identificación de empresa...</p>
        </div>
      );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 px-4 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
           </div>
           <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Inventario</h3>
        </div>
        <button onClick={handleAddNew} className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
           Nuevo Producto
        </button>
      </div>

      {fetchError && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <div>
                <p className="font-black uppercase tracking-tight">Error de conexión</p>
                <p className="opacity-70 font-medium">{fetchError}</p>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Buscar por marca o modelo..." 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none"
        >
          <option value="all">Todos los Tipos</option>
          {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <div className="flex items-center gap-4 px-4 bg-slate-50 border border-slate-100 rounded-xl">
           <span className="text-[10px] font-black uppercase text-slate-400">Precio Máx:</span>
           <input 
             type="range" 
             min="0" 
             max="10000" 
             step="100" 
             value={maxPrice} 
             onChange={(e) => setMaxPrice(parseInt(e.target.value))}
             className="w-24 md:w-32 accent-blue-600"
           />
           <span className="text-xs font-bold text-blue-600 w-16 text-right">{maxPrice}€</span>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-50">
            <tr>
              <th className="px-8 py-5">Marca / Modelo</th>
              <th className="px-6 py-5">Tipo</th>
              <th className="px-6 py-5">Variantes / Precios</th>
              <th className="px-6 py-5 text-center">Imágenes</th>
              <th className="px-6 py-5 text-center">Ficha IA</th>
              <th className="px-8 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {groupedProducts.map((group) => (
              <tr key={group.id} className="hover:bg-slate-50/30 transition-colors align-top group">
                <td className="px-8 py-8">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-center p-2 shrink-0">
                       {group.brandLogoUrl ? (
                         <img src={group.brandLogoUrl} className="w-full h-full object-contain" alt={group.brand} />
                       ) : (
                         <svg className="w-8 h-8 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                       )}
                    </div>
                    <div className="flex flex-col pt-1">
                      <span className="text-sm font-black text-slate-900 leading-none">{group.brand}</span>
                      <span className="text-[11px] font-bold text-slate-400 tracking-tight mt-2">{group.model}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-8">
                  <span className="inline-flex items-center px-4 py-1.5 bg-blue-50/50 text-blue-600 text-[10px] font-black uppercase rounded-lg border border-blue-100 tracking-wider">
                    {TYPES.find(c => c.id === group.type)?.label || group.type}
                  </span>
                </td>
                <td className="px-6 py-8">
                  <div className="space-y-2">
                    {group.variants.map((v, idx) => (
                      <div key={idx} className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                        <span className="text-slate-400 truncate max-w-[280px]">
                          {v.variant}:
                        </span>
                        <span className="font-black text-blue-600 whitespace-nowrap">{formatCurrency(v.price, language)}</span>
                      </div>
                    ))}
                    {group.variants.length === 0 && <span className="text-[10px] text-slate-300 italic">Sin precios definidos</span>}
                  </div>
                </td>
                <td className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {group.imageUrl ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" title="Imagen disponible"></div>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-200 shadow-sm" title="Sin imagen"></div>
                    )}
                    {group.brandLogoUrl ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" title="Logo disponible"></div>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-200 shadow-sm" title="Sin logo"></div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-8 text-center">
                  <div className="flex justify-center">
                    {group.pdfUrl ? (
                      <a href={group.pdfUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-md hover:bg-blue-50">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </a>
                    ) : (
                      <span className="text-slate-200">-</span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-8 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(group.id)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => handleDeleteFamily(group.ids)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && products.length === 0 && !fetchError && (
                <tr><td colSpan={6} className="px-10 py-32 text-center text-slate-300 font-black uppercase text-xs italic tracking-widest">No hay productos todavía en tu inventario</td></tr>
            )}
            {!loading && products.length > 0 && groupedProducts.length === 0 && !fetchError && (
              <tr><td colSpan={6} className="px-10 py-32 text-center text-slate-300 font-black uppercase text-xs italic tracking-widest">No se encontraron productos con estos filtros</td></tr>
            )}
            {loading && (
                <tr><td colSpan={6} className="px-10 py-32 text-center text-slate-300 font-black uppercase text-[10px] italic tracking-[0.2em] animate-pulse">Cargando productos...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};