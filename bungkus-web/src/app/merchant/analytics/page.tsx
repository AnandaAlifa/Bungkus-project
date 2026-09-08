"use client";

const weeklyData = [
  { day: "Sen", revenue: 1850000, waste: 450000, recovered: 320000 },
  { day: "Sel", revenue: 2100000, waste: 380000, recovered: 290000 },
  { day: "Rab", revenue: 1950000, waste: 520000, recovered: 410000 },
  { day: "Kam", revenue: 2400000, waste: 290000, recovered: 250000 },
  { day: "Jum", revenue: 2650000, waste: 340000, recovered: 310000 },
  { day: "Sab", revenue: 3200000, waste: 480000, recovered: 420000 },
  { day: "Min", revenue: 2450000, waste: 310000, recovered: 270000 },
];

const monthlyStats = {
  totalRevenue: 58500000,
  recoveredRevenue: 12800000,
  preventedWaste: 45.2,
  co2ePrevented: 8.9,
  ordersCompleted: 847,
  avgDiscount: 32,
};

export default function MerchantAnalytics() {
  const maxVal = Math.max(...weeklyData.map((d) => d.revenue));
  const totalWaste = weeklyData.reduce((s, d) => s + d.waste, 0);
  const totalRecovered = weeklyData.reduce((s, d) => s + d.recovered, 0);
  const recoveryRate = Math.round((totalRecovered / totalWaste) * 100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-900 mb-6">📈 Waste & Sales Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-xs text-dark-500">Total Revenue</div>
          <div className="text-xl font-bold text-dark-900">Rp {(monthlyStats.totalRevenue / 1000000).toFixed(1)}M</div>
        </div>
        <div className="card">
          <div className="text-xs text-dark-500">Recovered Revenue</div>
          <div className="text-xl font-bold text-eco-500">Rp {(monthlyStats.recoveredRevenue / 1000000).toFixed(1)}M</div>
          <div className="text-xs text-eco-500">↑ 18% dari bulan lalu</div>
        </div>
        <div className="card">
          <div className="text-xs text-dark-500">Waste Dihindari</div>
          <div className="text-xl font-bold text-eco-500">{monthlyStats.preventedWaste} kg</div>
          <div className="text-xs text-eco-500">= {monthlyStats.co2ePrevented} ton CO₂e</div>
        </div>
        <div className="card">
          <div className="text-xs text-dark-500">Recovery Rate</div>
          <div className="text-xl font-bold text-eco-500">{recoveryRate}%</div>
          <div className="text-xs text-dark-400">vs rata-rata industri 15%</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="card mb-6">
        <h3 className="font-bold text-dark-900 mb-4">📊 Revenue Mingguan</h3>
        <div className="flex items-end gap-3 h-40">
          {weeklyData.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col" style={{ height: "140px", justifyContent: "flex-end" }}>
                <div
                  className="w-full bg-eco-500 rounded-t-lg transition-all duration-500"
                  style={{ height: `${(d.revenue / maxVal) * 100}%` }}
                />
              </div>
              <span className="text-xs text-dark-500 mt-1">{d.day}</span>
              <span className="text-[10px] text-dark-400">Rp {(d.revenue / 1000000).toFixed(1)}M</span>
            </div>
          ))}
        </div>
      </div>

      {/* Waste vs Recovered */}
      <div className="card mb-6">
        <h3 className="font-bold text-dark-900 mb-4">♻️ Waste vs Recovered (Mingguan)</h3>
        <div className="flex items-end gap-3 h-40">
          {weeklyData.map((d) => {
            const maxH = Math.max(d.waste, d.recovered);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center">
                <div className="flex gap-1" style={{ height: "140px", alignItems: "flex-end" }}>
                  <div
                    className="w-4 bg-deal-300 rounded-t transition-all duration-500"
                    style={{ height: `${(d.waste / maxH) * 80}%` }}
                  />
                  <div
                    className="w-4 bg-eco-500 rounded-t transition-all duration-500"
                    style={{ height: `${(d.recovered / maxH) * 80}%` }}
                  />
                </div>
                <span className="text-xs text-dark-500 mt-1">{d.day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-dark-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-deal-300 rounded" /> Waste</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-eco-500 rounded" /> Recovered</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-dark-900">{monthlyStats.ordersCompleted}</div>
          <div className="text-sm text-dark-500">Pesanan Selesai</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-deal-500">{monthlyStats.avgDiscount}%</div>
          <div className="text-sm text-dark-500">Rata-rata Diskon</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-eco-500">A+</div>
          <div className="text-sm text-dark-500">ESG Rating</div>
        </div>
      </div>
    </div>
  );
}
