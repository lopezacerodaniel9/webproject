'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { BarChart3, TrendingUp, TrendingDown, Receipt, PieChart as PieChartIcon } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface Props {
  activePantryId: string;
}

interface ReceiptRecord {
  id: string;
  total_spent: number;
  created_at: string;
  items_summary: Array<{ name: string; quantity: number; category?: string }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Lácteos': '#3b82f6',
  'Carnes': '#ef4444',
  'Frutas y Verduras': '#10b981',
  'Despensa': '#f59e0b',
  'Bebidas': '#8b5cf6',
  'Congelados': '#06b6d4',
  'Panadería': '#f97316',
  'Limpieza': '#64748b',
  'Farmacia': '#ec4899',
  'Otros': '#a8a29e'
};

export default function StatsDashboard({ activePantryId }: Props) {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (activePantryId) {
      fetchReceipts();
    }
  }, [activePantryId]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      // Fetch all receipts for the active pantry
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('pantry_id', activePantryId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReceipts(data || []);
    } catch (err) {
      console.error('Error fetching receipts for stats', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Data Processing ───

  const {
    currentMonthTotal,
    lastMonthTotal,
    percentChange,
    dailyData,
    categoryData
  } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    let currentTotal = 0;
    let lastTotal = 0;

    // Daily spending for current month (Chart 1)
    const dailySpendMap = new Map<number, number>();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      dailySpendMap.set(i, 0);
    }

    // Category distribution for current month (Chart 2)
    const categoryCountMap = new Map<string, number>();

    receipts.forEach(r => {
      const date = new Date(r.created_at);
      const m = date.getMonth();
      const y = date.getFullYear();

      if (m === currentMonth && y === currentYear) {
        currentTotal += Number(r.total_spent);
        
        const day = date.getDate();
        dailySpendMap.set(day, (dailySpendMap.get(day) || 0) + Number(r.total_spent));

        // Aggregate categories based on items
        if (Array.isArray(r.items_summary)) {
          r.items_summary.forEach(item => {
            const cat = item.category || 'Otros';
            const qty = item.quantity || 1;
            categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + qty);
          });
        }
      } else if (m === lastMonth && y === lastMonthYear) {
        lastTotal += Number(r.total_spent);
      }
    });

    const change = lastTotal === 0 ? 100 : ((currentTotal - lastTotal) / lastTotal) * 100;

    const dailyChart = Array.from(dailySpendMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, amount]) => ({
        day: `${day} ${now.toLocaleString('es-ES', { month: 'short' })}`,
        amount: Number(amount.toFixed(2))
      }));

    const categoryChart = Array.from(categoryCountMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || CATEGORY_COLORS['Otros']
      }))
      .sort((a, b) => b.value - a.value);

    return {
      currentMonthTotal: currentTotal,
      lastMonthTotal: lastTotal,
      percentChange: change,
      dailyData: dailyChart,
      categoryData: categoryChart
    };
  }, [receipts]);


  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20 sm:pb-0">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Total Month Card */}
        <div className="bg-[#13131f] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BarChart3 className="w-16 h-16 text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Gasto este mes
          </h3>
          <p className="text-3xl font-bold text-foreground mb-2">
            {currentMonthTotal.toFixed(2)} €
          </p>
          <div className="flex items-center gap-2 text-sm">
            {percentChange > 0 ? (
              <span className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">
                <TrendingUp className="w-3.5 h-3.5" /> +{percentChange.toFixed(1)}%
              </span>
            ) : percentChange < 0 ? (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                <TrendingDown className="w-3.5 h-3.5" /> {percentChange.toFixed(1)}%
              </span>
            ) : (
              <span className="text-muted-foreground px-2 py-0.5 bg-white/5 rounded-full">Igual que el mes pasado</span>
            )}
            <span className="text-muted-foreground text-xs">vs mes anterior</span>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-[#13131f] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Tickets Analizados
              </h3>
              <p className="text-2xl font-bold text-foreground mt-1">
                {receipts.filter(r => new Date(r.created_at).getMonth() === new Date().getMonth()).length}
              </p>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="bg-[#13131f] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col min-h-[350px]">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            Evolución Diaria (Mes Actual)
          </h3>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="#ffffff40" 
                  fontSize={12}
                  tickMargin={10}
                  tickFormatter={(val) => val.split(' ')[0]} // Show only day number
                />
                <YAxis 
                  stroke="#ffffff40" 
                  fontSize={12}
                  tickFormatter={(val) => `€${val}`}
                  width={40}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#13131f', borderColor: '#ffffff20', borderRadius: '12px' }}
                  itemStyle={{ color: '#a78bfa' }}
                  formatter={(value: any) => [`${value} €`, 'Gasto']}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4, strokeOpacity: 0.5 }}
                  activeDot={{ r: 6, fill: '#a78bfa' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-[#13131f] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col min-h-[350px]">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-400" />
            Distribución por Categorías
          </h3>
          
          {categoryData.length > 0 ? (
            <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#13131f', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any) => [`${value} uds.`, 'Cantidad comprada']}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50">
              <PieChartIcon className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">No hay compras este mes</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
