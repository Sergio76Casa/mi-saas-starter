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
  { id: 'termo_electrico', label: 'Termos eléctricos' }
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

  // Grouping logic for the UI to match the screenshot "Family" style
  const groupedProducts = useMemo(() => {
    const groups: Record<string, {
      id: string;
      brand: string;
      baseModel: string;
      category: string;
      items: any[];
      firstProduct: any;
    }> = {};

    products.forEach(p => {
      const parts = p.name.trim().split(' ');
      const brand = parts[0];
      // Simple heuristic to extract "Base Model": Brand + next 2 words or similar
      // For precision, we use the first 3 words if available as the family name
      const baseModel = parts.slice(1, 3).join(' ') || parts.slice(1).join(' ') || 'Modelo General';
      const key = `${brand}-${baseModel}-${p.category}`;

      if (!groups[key]) {
        groups[key] = {
          id: p.id,
          brand: brand.toUpperCase(),
          baseModel: (parts.slice(1).join(' ') || 'N/A').toUpperCase(),
          category: p.category,
          items: [],
          firstProduct: p
        };
      }
      groups[key].items.push(p);
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
      .order('created_at', { ascending: false });

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

  const handleDelete = async (id: string) => {
    if (!tenant?.id || !window.confirm('¿Desea eliminar este producto?')) return;
    await supabase.from('products').delete().eq('id', id).eq('tenant_id', tenant.id);
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">Gestión de Inventario</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Catalogo de productos y variantes</p>
        </div>
        <div className="flex w-full md:w-auto gap-2 md:gap-4">
          <button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none px-6 py-3 bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:bg-gray-50 transition-all">✨ IA Import</button>
          <button onClick={() => handleOpenModal()} className="flex-1 md:flex-none px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-brand-700 transition-all">+ Añadir Nuevo</button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-end gap-4 md:gap-6">
        <div className="flex-1"><Input label="Buscar por marca o modelo" value={searchTerm} onChange={(e:any) => setSearchTerm(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Tipo</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full px-4 py-2.5 border border-gray-100 rounded-xl bg-gray-50/50 text-xs outline-none focus:ring-2 focus:ring-brand-500">
              <option value="all">Todos los tipos</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Estado</label>
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className="w-full px-4 py-2.5 border border-gray-100 rounded-xl bg-gray-50/50 text-xs outline-none focus:ring-2 focus:ring-brand-500">
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
            <tr>
              <th className="px-6 py-5">Marca / Modelo</th>
              <th className="px-6 py-5">Tipo</th>
              <th className="px-6 py-5">Precios</th>
              <th className="px-6 py-5 text-center">Imágenes</th>
              <th className="px-6 py-5 text-center">Ficha</th>
              <th className="px-6 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {groupedProducts.map((group) => (
              <tr key={group.id} className="hover:bg-gray-50/30 transition-colors align-top group/row">
                {/* Brand / Model */}
                <td className="px-6 py-8">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      <svg className="w-8 h-8 text-gray-200" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                    <div className="flex flex-col pt-1">
                      <span className="text-sm font-black text-gray-900 leading-tight">{group.brand}</span>
                      <span className="text-[11px] font-bold text-gray-400 tracking-tight leading-normal mt-0.5">{group.baseModel}</span>
                    </div>
                  </div>
                </td>

                {/* Type Badge */}
                <td className="px-6 py-8">
                  <span className="inline-flex items-center px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg border border-blue-100 tracking-wider">
                    {CATEGORIES.find(c => c.id === group.category)?.label || group.category}
                  </span>
                </td>

                {/* Prices variants */}
                <td className="px-6 py-8">
                  <div className="space-y-1.5">
                    {group.items.map((item, idx) => (
                      <div key={item.id} className="text-[11px] font-medium text-gray-600 flex gap-1.5 items-center">
                        <span className="text-gray-400">{item.name}:</span>
                        <span className="font-black text-blue-600">{formatCurrency(item.price, language)}</span>
                      </div>
                    ))}
                  </div>
                </td>

                {/* Image Dots */}
                <td className="px-6 py-8">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div>
                  </div>
                </td>

                {/* Datasheet Icon */}
                <td className="px-6 py-8 text-center">
                  <div className="flex justify-center">
                    {group.firstProduct.description ? (
                      <button className="text-blue-500 hover:text-blue-700 transition-colors" title="Ver ficha técnica">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </button>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-8 text-right">
                  <div className="flex justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(group.firstProduct)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => handleDelete(group.firstProduct.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Eliminar">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-10 py-32 text-center text-gray-300 font-black uppercase text-xs italic tracking-widest">No se han encontrado productos en el inventario</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Edit / New Product */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h4 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tighter italic">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h4>
            <form onSubmit={handleSaveProduct} className="space-y-6">
              <Input label="Nombre del Producto" value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} required />
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Descripción corta / Especificaciones</label>
                <textarea className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50/50 h-28 text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Precio Venta (€)" type="number" step="0.01" value={formData.price} onChange={(e:any) => setFormData({...formData, price: parseFloat(e.target.value)})} required />
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Categoría</label>
                  <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50/50 text-xs outline-none focus:ring-2 focus:ring-brand-500">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="submit" className="flex-1 py-5 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-700 active:scale-95 transition-all">Guardar Producto</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-5 text-gray-400 font-black uppercase text-xs tracking-widest">Cerrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: IA Import */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
            <h4 className="text-2xl font-black text-gray-900 mb-4 uppercase italic tracking-tighter">Importar con Inteligencia Artificial</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 shrink-0">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Documento (Catálogo / PDF / Foto)</label>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setImportFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-brand-50 file:text-brand-700" />
                </div>
                <button onClick={handleProcessIA} disabled={isImporting || !importFile} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50">
                  {isImporting ? 'IA ANALIZANDO DOCUMENTO...' : '✨ EXTRAER DATOS CON IA'}
                </button>
              </div>
              <div className="bg-gray-50 p-8 rounded-[2rem] text-center flex flex-col items-center justify-center border border-gray-100">
                <svg className="w-12 h-12 text-brand-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed italic tracking-widest max-w-[250px]">
                  Nuestra IA detectará automáticamente Marca, Modelo y Precio Final.
                </p>
              </div>
            </div>
            {importPreview.length > 0 && (
              <div className="flex-1 overflow-x-auto bg-gray-50/50 rounded-[2rem] border border-gray-100 mb-8 p-6">
                <table className="w-full text-left text-[10px] min-w-[600px]">
                  <thead className="text-gray-400 border-b border-gray-200 uppercase font-black tracking-widest">
                    <tr><th className="py-3">Producto Detectado</th><th className="py-3 text-right">Precio IA</th><th className="py-3"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importPreview.map((p, idx) => (
                      <tr key={idx} className="group/row-ia">
                        <td className="py-4">
                          <div className="font-black text-slate-900">{p.name}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5 line-clamp-1 italic">{p.description}</div>
                        </td>
                        <td className="py-4 text-right font-black text-brand-600">{formatCurrency(p.price, language)}</td>
                        <td className="py-4 text-right">
                          <button onClick={() => setImportPreview(importPreview.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 transition-colors text-lg font-black px-2">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-4">
              <button onClick={handleConfirmImport} disabled={importPreview.length === 0} className="flex-1 py-5 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50">Confirmar Importación ({importPreview.length})</button>
              <button onClick={() => { setIsImportModalOpen(false); setImportPreview([]); setImportStatus(null); }} className="px-8 py-5 text-gray-400 font-black uppercase text-xs tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};