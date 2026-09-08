"use client";

import { SalesChart } from "@/components/merchant/SalesChart";
import { InventorySummary } from "@/components/merchant/InventorySummary";
import { POSStatus } from "@/components/merchant/POSStatus";

export default function MerchantDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-900 mb-6">📊 Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-dark-500">Revenue Hari Ini</div>
          <div className="text-2xl font-bold text-eco-500">Rp 2.450.000</div>
          <div className="text-xs text-eco-500">↑ 12% dari kemarin</div>
        </div>
        <div className="card">
          <div className="text-sm text-dark-500">Produk Terjual</div>
          <div className="text-2xl font-bold text-dark-900">47</div>
          <div className="text-xs text-deal-500">8 dari clearance</div>
        </div>
        <div className="card">
          <div className="text-sm text-dark-500">Waste Dihindari</div>
          <div className="text-2xl font-bold text-eco-500">12.3 kg</div>
          <div className="text-xs text-eco-500">= 2.1 ton CO₂e</div>
        </div>
        <div className="card">
          <div className="text-sm text-dark-500">Active Listings</div>
          <div className="text-2xl font-bold text-dark-900">23</div>
          <div className="text-xs text-deal-500">5 hampir expired</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-bold text-dark-900 mb-4">📈 Sales & Recovery</h2>
          <SalesChart />
        </div>

        {/* POS Status + Inventory */}
        <div className="space-y-6">
          <POSStatus />
          <InventorySummary />
        </div>
      </div>
    </div>
  );
}
