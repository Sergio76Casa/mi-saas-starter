
import React from 'react';
// Import routing hooks from react-router to avoid export issues in react-router-dom
import { useOutletContext } from 'react-router';
import { Tenant } from '../../types';
import { useApp } from '../../AppProvider';
import { supabase } from '../../supabaseClient';
import { formatCurrency } from '../../i18n';

export const TenantDashboard = () => {
  const { tenant } = useOutletContext<{ tenant: Tenant }>();
  const { t, language } = useApp();
  const [stats, setStats] = React.useState({
    revenue: 0,
    activeQuotes: 0,
    totalCustomers: 0
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      if (!tenant?.id) return;
      try {
        // Total customers
        const { count: customersCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        // Active quotes (not draft and not rejected/expired)
        const { data: quotesData } = await supabase
          .from('quotes')
          .select('total_amount, status')
          .eq('tenant_id', tenant.id);

        const active = quotesData?.filter(q => !['draft', 'rejected', 'expired'].includes(q.status)) || [];
        const totalRevenue = active.reduce((acc, q) => acc + (q.total_amount || 0), 0);

        setStats({
          revenue: totalRevenue,
          activeQuotes: active.length,
          totalCustomers: customersCount || 0
        });
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [tenant?.id]);

  const statCards = [
    { l: t('total_revenue'), v: formatCurrency(stats.revenue, language), i: '💰' },
    { l: t('active_quotes'), v: stats.activeQuotes.toString(), i: '⏳' },
    { l: t('total_customers'), v: stats.totalCustomers.toString(), i: '👥' }
  ];

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in duration-500 text-left">
      <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic mb-10">{t('dashboard')}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.8rem] shadow-sm border border-gray-100 hover:shadow-2xl transition-all group text-left">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-50 text-gray-900 rounded-2xl flex items-center justify-center text-xl md:text-2xl mb-6 group-hover:bg-brand-600 group-hover:text-white transition-all">{s.i}</div>
            <h3 className="text-gray-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">{s.l}</h3>
            <p className="text-3xl md:text-4xl font-black mt-2 text-gray-900 tracking-tighter">
              {loading ? '...' : s.v}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-white p-12 rounded-[2rem] md:rounded-[3.5rem] border border-gray-50 h-64 md:h-80 flex items-center justify-center text-gray-300 font-black uppercase tracking-widest text-xs italic text-center">
        {loading ? 'Cargando workspace...' : `Espacio de trabajo para ${tenant.name}`}
      </div>
    </div>
  );
};
