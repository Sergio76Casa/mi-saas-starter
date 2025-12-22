import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchProducts();
  }, [tenant?.id, searchTerm, filterCategory, filterActive]);

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category || 'aire_acondicionado',
        is_active: product.is_active
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        category: 'aire_acondicionado',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  // Fixed type annotation: added React namespace
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) {
      alert("Error: No se ha detectado el identificador de empresa.");
      return;
    }

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(formData)
        .eq('id', editingProduct.id)
        .eq('tenant_id', tenant.id);
      
      if (error) {
        alert("Error al actualizar: " + error.message);
      } else {
        setIsModalOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert([{ ...formData, tenant_id: tenant.id }]);
      
      if (error) {
        alert("Error al guardar: " + error.message);
      } else {
        setIsModalOpen(false);
      }
    }
    fetchProducts();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    if (!tenant?.id) return;
    await supabase
      .from('products')
      .update({ is_active: !current })
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!tenant?.id || !window.confirm('¿Eliminar producto?')) return;
    await supabase.from('products').delete().eq('id', id).eq('tenant_id', tenant.id);
    fetchProducts();
  };

  const handleProcessIA = async () => {
    if (!importFile || !tenant?.id) return;
    setIsImporting(true);
    setImportStatus(null);
    setImportPreview([]);
    
    try {
      const body = new FormData();
      body.append('file', importFile);
      body.append('defaultCategory', defaultCategory);

      const { data, error } = await supabase.functions.invoke('extract_products_from_file', {
        body,
      });

      if (error) throw new Error("Error al conectar con el servidor de IA.");
      if (data?.error) throw new Error(data.error);

      if (!data?.products || data.products.length === 0) {
        throw new Error("No se detectó ningún producto en el documento.");
      }

      const normalizedProducts = data.products.map((p: any) => ({
        ...p,
        name: `${p.brand || ''} ${p.model || ''}`.trim() || 'Producto sin nombre',
        category: p.category || defaultCategory
      }));

      setImportPreview(normalizedProducts);
      setImportStatus({ type: 'success', message: 'Procesado correctamente.' });
    } catch (err: any) {
      console.error("Error en extracción IA:", err);
      setImportStatus({ 
        type: 'error', 
        message: err.message || "Error al procesar el documento. Inténtalo de nuevo." 
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!tenant?.id || importPreview.length === 0) return;
    
    const productsToInsert = importPreview.map(p => ({
      name: p.name,
      description: p.description || '',
      price: p.price || 0,
      category: p.category || defaultCategory,
      is_active: true,
      tenant_id: tenant.id
    }));

    const { error } = await supabase.from('products').insert(productsToInsert);
    
    if (!error) {
      setIsImportModalOpen(false);
      setImportPreview([]);
      setImportFile(null);
      setImportStatus(null);
      fetchProducts();
    } else {
      alert('Error de seguridad RLS al guardar: ' + error.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-3xl font-black text-gray-900 tracking-tighter">Productos/Inventario</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Gestiona tu catálogo personalizado</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="px-6 py-3 bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            ✨ IA Import
          </button>
          <button 
            onClick={() => handleOpenModal()} 
            className="px-6 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg"
          >
            + Nuevo Producto
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-wrap items-end gap-6">
        <div className="flex-1 min-w-[200px]">
          <Input 
            label="Buscar producto" 
            placeholder="Nombre o descripción..." 
            value={searchTerm} 
            onChange={(e:any) => setSearchTerm(e.target.value)} 
          />
        </div>
        <div className="w-48">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Categoría</label>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm bg-gray-50/50"
          >
            <option value="all">Todas</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Estado</label>
          <select 
            value={filterActive} 
            onChange={(e) => setFilterActive(e.target.value)}
            className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm bg-gray-50/50"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-[2.8rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Producto</th>
              <th className="px-10 py-6">Categoría</th>
              <th className="px-10 py-6">Precio</th>
              <th className="px-10 py-6">Estado</th>
              <th className="px-10 py-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-10 py-6">
                  <div className="font-black text-gray-900">{p.name}</div>
                  <div className="text-[10px] text-gray-400 font-medium line-clamp-1">{p.description}</div>
                </td>
                <td className="px-10 py-6">
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-full">
                    {CATEGORIES.find(c => c.id === p.category)?.label || p.category}
                  </span>
                </td>
                <td className="px-10 py-6 font-black text-brand-600">{formatCurrency(p.price, language)}</td>
                <td className="px-10 py-6">
                  <button 
                    onClick={() => handleToggleActive(p.id, p.is_active)}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${p.is_active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                  >
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-10 py-6 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => handleOpenModal(p)} className="text-brand-600 font-black text-[9px] uppercase tracking-widest">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 font-black text-[9px] uppercase tracking-widest">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-10 py-20 text-center text-gray-300 font-black uppercase text-xs italic">No hay productos en el inventario.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-300">
            <h4 className="text-2xl font-black text-gray-900 mb-8">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h4>
            <form onSubmit={handleSaveProduct} className="space-y-6">
              <Input label="Nombre" value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} required />
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Descripción</label>
                <textarea 
                  className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm bg-gray-50/50 h-24 resize-none"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <Input label="Precio" type="number" step="0.01" value={formData.price} onChange={(e:any) => setFormData({...formData, price: parseFloat(e.target.value)})} required />
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Categoría</label>
                  <select 
                    value={formData.category} 
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm bg-gray-50/50"
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Producto Activo</span>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="submit" className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Guardar Cambios</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-gray-400 font-black uppercase text-xs">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-4xl shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <h4 className="text-2xl font-black text-gray-900 mb-2">Importar con IA</h4>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Sube un catálogo o tarifa para extraer productos automáticamente</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8 shrink-0">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Archivo (PDF o Imagen)</label>
                  <input 
                    type="file" 
                    accept=".pdf,.png,.jpg,.jpeg" 
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Categoría por defecto</label>
                  <select 
                    value={defaultCategory} 
                    onChange={(e) => setDefaultCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm bg-gray-50/50"
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>

                {importStatus && (
                  <div className={`p-4 rounded-xl text-[10px] font-black uppercase tracking-widest ${importStatus.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                    {importStatus.type === 'error' ? '⚠️ ' : '✅ '} {importStatus.message}
                  </div>
                )}

                <button 
                  onClick={handleProcessIA}
                  disabled={isImporting || !importFile}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-50 shadow-xl"
                >
                  {isImporting ? 'Procesando con IA...' : '✨ Procesar Documento'}
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 flex items-center justify-center text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                  La IA detectará la marca, modelo y precio de forma inteligente. <br/> Normalización aplicada automáticamente.
                </p>
              </div>
            </div>

            {importPreview.length > 0 && (
              <div className="flex-1 overflow-auto bg-gray-50 rounded-3xl border border-gray-100 mb-8 p-6">
                <table className="w-full text-left text-xs">
                  <thead className="text-[9px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-200">
                    <tr>
                      <th className="py-4">Producto (Normalizado)</th>
                      <th className="py-4">Categoría</th>
                      <th className="py-4 text-right">Precio</th>
                      <th className="py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((p, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-4">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[9px] text-slate-400 italic line-clamp-1">{p.description}</div>
                        </td>
                        <td className="py-4">
                          <select 
                            value={p.category} 
                            onChange={e => {
                              const newList = [...importPreview];
                              newList[idx].category = e.target.value;
                              setImportPreview(newList);
                            }}
                            className="bg-transparent border-0 p-0 text-[10px] font-black uppercase text-slate-500 focus:ring-0"
                          >
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </td>
                        <td className="py-4 text-right font-black">{formatCurrency(p.price, language)}</td>
                        <td className="py-4 text-right">
                          <button onClick={() => setImportPreview(importPreview.filter((_, i) => i !== idx))} className="text-red-400 text-lg">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-4 shrink-0">
              <button 
                onClick={handleConfirmImport} 
                disabled={importPreview.length === 0}
                className="flex-1 py-5 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50"
              >
                Importar {importPreview.length} Productos
              </button>
              <button onClick={() => { setIsImportModalOpen(false); setImportPreview([]); setImportStatus(null); }} className="px-8 py-5 text-gray-400 font-black uppercase text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};