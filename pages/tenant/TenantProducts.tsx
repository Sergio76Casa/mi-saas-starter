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

  const handleToggleActive = async (id: string, current: boolean) => {
    if (!tenant?.id) return;
    await supabase.from('products').update({ is_active: !current }).eq('id', id).eq('tenant_id', tenant.id);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!tenant?.id || !window.confirm('¿Eliminar?')) return;
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
      if (error) throw new Error("IA desconectada.");
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
          <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">Inventario</h3>
        </div>
        <div className="flex w-full md:w-auto gap-2 md:gap-4">
          <button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none px-4 py-3 bg-white border border-gray-100 text-[9px] font-black uppercase tracking-widest rounded-xl shadow-sm">IA Import</button>
          <button onClick={() => handleOpenModal()} className="flex-1 md:flex-none px-4 py-3 bg-brand-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg">+ Nuevo</button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-end gap-4 md:gap-6">
        <div className="flex-1"><Input label="Buscar" value={searchTerm} onChange={(e:any) => setSearchTerm(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
          <div><label className="block text-[9px] font-black uppercase text-gray-400 mb-1.5 ml-1">Categoría</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full px-4 py-2.5 border border-gray-100 rounded-xl bg-gray-50/50 text-xs outline-none focus:ring-2 focus:ring-brand-500"><option value="all">Todas</option>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          <div><label className="block text-[9px] font-black uppercase text-gray-400 mb-1.5 ml-1">Estado</label>
          <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className="w-full px-4 py-2.5 border border-gray-100 rounded-xl bg-gray-50/50 text-xs outline-none focus:ring-2 focus:ring-brand-500"><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-[1.5rem] md:rounded-[2.8rem] overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-widest">
            <tr><th className="px-6 md:px-10 py-4 md:py-6">Producto</th><th className="px-6 md:px-10 py-4 md:py-6">Categoría</th><th className="px-6 md:px-10 py-4 md:py-6">Precio</th><th className="px-6 md:px-10 py-4 md:py-6">Estado</th><th className="px-6 md:px-10 py-4 md:py-6 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 md:px-10 py-4 md:py-6"><div className="font-black text-gray-900 text-xs md:text-sm">{p.name}</div></td>
                <td className="px-6 md:px-10 py-4 md:py-6"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[8px] md:text-[9px] font-black uppercase rounded-full">{CATEGORIES.find(c => c.id === p.category)?.label || p.category}</span></td>
                <td className="px-6 md:px-10 py-4 md:py-6 font-black text-brand-600 text-xs md:text-sm">{formatCurrency(p.price, language)}</td>
                <td className="px-6 md:px-10 py-4 md:py-6"><button onClick={() => handleToggleActive(p.id, p.is_active)} className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${p.is_active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>{p.is_active ? 'Activo' : 'Inactivo'}</button></td>
                <td className="px-6 md:px-10 py-4 md:py-6 text-right flex justify-end gap-2 md:gap-3"><button onClick={() => handleOpenModal(p)} className="text-brand-600 font-black text-[9px] uppercase">Edit</button><button onClick={() => handleDelete(p.id)} className="text-red-400 font-black text-[9px] uppercase">Del</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h4 className="text-xl font-black text-gray-900 mb-6">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h4>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <Input label="Nombre" value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} required />
              <textarea className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50/50 h-24 text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="Descripción" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              <div className="grid grid-cols-2 gap-4"><Input label="Precio" type="number" step="0.01" value={formData.price} onChange={(e:any) => setFormData({...formData, price: parseFloat(e.target.value)})} required /><div className="text-left"><label className="block text-[9px] font-black uppercase text-gray-400 mb-1 ml-1">Categoría</label><select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2.5 border border-gray-100 rounded-xl bg-gray-50/50 text-xs outline-none focus:ring-2 focus:ring-brand-500">{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div></div>
              <div className="flex gap-4 pt-6"><button type="submit" className="flex-1 py-4 bg-brand-600 text-white rounded-xl font-black uppercase text-xs">Guardar</button><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-xs">Cerrar</button></div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
            <h4 className="text-xl font-black text-gray-900 mb-4 uppercase italic leading-none">Importar con IA</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div><label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1">Documento</label><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setImportFile(e.target.files?.[0] || null)} className="w-full text-xs" /></div>
                <button onClick={handleProcessIA} disabled={isImporting || !importFile} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs shadow-xl">{isImporting ? 'IA PROCESANDO...' : '✨ EXTRAER PRODUCTOS'}</button>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl text-center flex items-center justify-center"><p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed italic">Sube un catálogo y nuestra IA detectará precios y modelos automáticamente.</p></div>
            </div>
            {importPreview.length > 0 && (
              <div className="flex-1 overflow-x-auto bg-gray-50 rounded-2xl mb-6 p-4">
                <table className="w-full text-left text-[10px] min-w-[500px]">
                  <thead className="text-gray-400 border-b border-gray-200"><tr><th className="py-2">Producto</th><th className="py-2 text-right">Precio</th><th className="py-2"></th></tr></thead>
                  <tbody>{importPreview.map((p, idx) => (<tr key={idx} className="border-b border-gray-100"><td className="py-2 font-bold">{p.name}</td><td className="py-2 text-right font-black">{formatCurrency(p.price, language)}</td><td className="py-2 text-right"><button onClick={() => setImportPreview(importPreview.filter((_, i) => i !== idx))} className="text-red-400 font-black text-base">×</button></td></tr>))}</tbody>
                </table>
              </div>
            )}
            <div className="flex gap-4"><button onClick={handleConfirmImport} disabled={importPreview.length === 0} className="flex-1 py-4 bg-brand-600 text-white rounded-xl font-black uppercase text-xs shadow-xl">Confirmar {importPreview.length}</button><button onClick={() => setIsImportModalOpen(false)} className="px-6 py-4 text-gray-400 font-black uppercase text-xs">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};