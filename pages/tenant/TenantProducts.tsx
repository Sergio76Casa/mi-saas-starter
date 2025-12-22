import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase, isConfigured } from '../../supabaseClient';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';
import { Input } from '../../components/common/Input';
import { formatCurrency } from '../../i18n';

const CATEGORIES = [
  { id: 'aire_acondicionado', label: 'Aire Acondicionado' },
  { id: 'caldera', label: 'Calderas' },
  { id: 'termo_electrico', label: 'Termo Eléctrico' }
];

export const TenantProducts = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { language } = useApp();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterActive, setFilterActive] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'aire_acondicionado',
    is_active: true
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [defaultCategory, setDefaultCategory] = useState('aire_acondicionado');
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  // Group products by Brand + Series for the specific layout
  const groupedProducts = useMemo(() => {
    const groups: Record<string, {
      id: string;
      brand: string;
      modelSeries: string;
      category: string;
      variants: any[];
      ids: string[];
    }> = {};

    products.forEach(p => {
      const parts = p.name.trim().split(' ');
      const brand = parts[0];
      // Heuristic: Group by Brand + Second Word (Series name)
      const modelSeries = parts.slice(1, 3).join(' ') || parts.slice(1).join(' ') || 'General';
      const key = `${brand}-${modelSeries}-${p.category}`;

      if (!groups[key]) {
        groups[key] = {
          id: p.id,
          brand: brand.toUpperCase(),
          modelSeries: modelSeries.toUpperCase(),
          category: p.category,
          variants: [],
          ids: []
        };
      }
      groups[key].variants.push(p);
      groups[key].ids.push(p.id);
    });

    return Object.values(groups);
  }, [products]);

  const fetchProducts = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name', { ascending: true });

    if (searchTerm) query = query.ilike('name', `%${searchTerm}%`);
    if (filterCategory !== 'all') query = query.eq('category', filterCategory);
    if (filterActive !== 'all') query = query.eq('is_active', filterActive === 'active');

    const { data } = await query;
    if (data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [tenant?.id, searchTerm, filterCategory, filterActive]);

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ name: product.name, description: product.description || '', price: product.price, category: product.category || 'aire_acondicionado', is_active: product.is_active });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', description: '', price: 0, category: 'aire_acondicionado', is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (editingProduct) {
      const { error } = await supabase.from('products').update(formData).eq('id', editingProduct.id).eq('tenant_id', tenant.id);
      if (!error) setIsModalOpen(false);
    } else {
      const { error } = await supabase.from('products').insert([{ ...formData, tenant_id: tenant.id }]);
      if (!error) setIsModalOpen(false);
    }
    fetchProducts();
  };

  const handleDeleteFamily = async (ids: string[]) => {
    if (!tenant?.id || !window.confirm(`¿Desea eliminar esta familia de productos (${ids.length} variantes)?`)) return;
    const { error } = await supabase.from('products').delete().in('id', ids).eq('tenant_id', tenant.id);
    if (error) alert("Error al eliminar: " + error.message);
    fetchProducts();
  };

  const handleProcessIA = async () => {
    if (!importFile || !tenant?.id) return;
    setIsImporting(true); setImportStatus(null); setImportPreview([]);
    try {
      const body = new FormData();
      body.append('file', importFile);
      body.append('defaultCategory', defaultCategory);
      const { data, error } = await supabase.functions.invoke('extract_products_from_file', { body });
      if (error) throw new Error("Servicio de IA no disponible.");
      const normalizedProducts = data.products.map((p: any) => ({ ...p, name: `${p.brand || ''} ${p.model || ''}`.trim() || 'Producto', category: p.category || defaultCategory }));
      setImportPreview(normalizedProducts);
      setImportStatus({ type: 'success', message: 'Procesado correctamente.' });
    } catch (err: any) { setImportStatus({ type: 'error', message: err.message }); } 
    finally { setIsImporting(false); }
  };

  const handleConfirmImport = async () => {
    if (!tenant?.id || importPreview.length === 0) return;
    const { error } = await supabase.from('products').insert(importPreview.map(p => ({ ...p, tenant_id: tenant.id, is_active: true })));
    if (!error) { setIsImportModalOpen(false); setImportPreview([]); fetchProducts(); }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 px-4 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
           </div>
           <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Inventario</h3>
        </div>
        <button onClick={() => handleOpenModal()} className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
           Nuevo Producto
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-50">
            <tr>
              <th className="px-8 py-5">Marca / Modelo</th>
              <th className="px-6 py-5">Tipo</th>
              <th className="px-6 py-5">Precios</th>
              <th className="px-6 py-5 text-center">Imágenes</th>
              <th className="px-6 py-5 text-center">Ficha</th>
              <th className="px-8 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {groupedProducts.map((group) => (
              <tr key={group.id} className="hover:bg-slate-50/30 transition-colors align-top group">
                {/* MARCA / MODELO */}
                <td className="px-8 py-8">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-center p-2 shrink-0">
                       <svg className="w-8 h-8 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                    <div className="flex flex-col pt-1">
                      <span className="text-sm font-black text-slate-900 leading-none">{group.brand}</span>
                      <span className="text-[11px] font-bold text-slate-400 tracking-tight mt-1.5">{group.modelSeries}</span>
                    </div>
                  </div>
                </td>

                {/* TIPO */}
                <td className="px-6 py-8">
                  <span className="inline-flex items-center px-4 py-1.5 bg-blue-50/50 text-blue-600 text-[10px] font-black uppercase rounded-lg border border-blue-100 tracking-wider">
                    {CATEGORIES.find(c => c.id === group.category)?.label || group.category}
                  </span>
                </td>

                {/* PRECIOS */}
                <td className="px-6 py-8">
                  <div className="space-y-1.5">
                    {group.variants.map((v, i) => (
                      <div key={v.id} className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                        <span className="text-slate-400 truncate max-w-[250px]">{v.name}:</span>
                        <span className="font-black text-blue-600 whitespace-nowrap">{formatCurrency(v.price, language)}</span>
                      </div>
                    ))}
                  </div>
                </td>

                {/* IMÁGENES */}
                <td className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div>
                  </div>
                </td>

                {/* FICHA */}
                <td className="px-6 py-8 text-center">
                  <div className="flex justify-center">
                    {group.variants[0].description ? (
                      <button className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded-md hover:bg-blue-50">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </button>
                    ) : (
                      <span className="text-slate-200">-</span>
                    )}
                  </div>
                </td>

                {/* ACCIONES */}
                <td className="px-8 py-8 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(group.variants[0])} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => handleDeleteFamily(group.ids)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {groupedProducts.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-10 py-32 text-center text-slate-300 font-black uppercase text-xs italic tracking-widest">No hay productos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Nuevo / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h4 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tighter italic">{editingProduct ? 'Editar Producto' : 'Añadir Producto'}</h4>
            <form onSubmit={handleSaveProduct} className="space-y-6">
              <Input label="Nombre del Producto (Incluir Marca + Modelo + Variante)" value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} required />
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Descripción / Especificaciones</label>
                <textarea className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50/50 h-28 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Precio Venta (€)" type="number" step="0.01" value={formData.price} onChange={(e:any) => setFormData({...formData, price: parseFloat(e.target.value)})} required />
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Categoría</label>
                  <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 border border-slate-100 rounded-xl bg-slate-50/50 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Guardar Cambios</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-5 text-slate-400 font-black uppercase text-xs tracking-widest">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};