"use client";

import { useState } from "react";

interface Product {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  currentPrice: number;
  minPrice: number;
  stock: number;
  expiry: string;
  status: string;
}

const mockProducts: Product[] = [
  { id: "1", name: "Roti Tawar Gandum", sku: "BR-001", basePrice: 22000, currentPrice: 15400, minPrice: 5000, stock: 8, expiry: "2026-09-08T18:00:00", status: "ACTIVE" },
  { id: "2", name: "Croissant Coklat", sku: "BR-002", basePrice: 18000, currentPrice: 8500, minPrice: 3000, stock: 3, expiry: "2026-09-08T15:00:00", status: "LOW_STOCK" },
  { id: "3", name: "Nasi Goreng Ayam", sku: "WR-001", basePrice: 18000, currentPrice: 12000, minPrice: 5000, stock: 0, expiry: "2026-09-08T20:00:00", status: "SOLD_OUT" },
];

export default function MerchantInventory() {
  const [products] = useState<Product[]>(mockProducts);
  const [showUpload, setShowUpload] = useState(false);

  const timeLeft = (expiry: string) => {
    const diff = new Date(expiry).getTime() - Date.now();
    if (diff <= 0) return { text: "Expired", color: "text-dark-400" };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h < 2) return { text: `${h}j ${m}m`, color: "text-deal-500" };
    return { text: `${h}j ${m}m`, color: "text-eco-500" };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-dark-900">📦 Inventory</h1>
        <button onClick={() => setShowUpload(!showUpload)} className="btn-primary text-sm">
          + Upload Produk Near-Expiry
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="card mb-6 animate-slide-up">
          <h3 className="font-bold text-dark-900 mb-4">Upload Manual SKU</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input className="input-field" placeholder="Nama Produk" />
            <input className="input-field" placeholder="SKU" />
            <input className="input-field" placeholder="Harga Normal (Rp)" type="number" />
            <input className="input-field" placeholder="Harga Minimum (Rp)" type="number" />
            <input className="input-field" placeholder="Jumlah Stok" type="number" />
            <input className="input-field" type="datetime-local" />
            <div className="md:col-span-2">
              <label className="text-sm text-dark-500 mb-2 block">⏱️ Timer Expiry</label>
              <div className="flex gap-2">
                {[1, 2, 4, 6, 8, 12].map((h) => (
                  <button key={h} className="px-4 py-2 rounded-lg border border-dark-200 text-sm hover:border-eco-500 hover:text-eco-500 transition">
                    {h} jam
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button className="btn-primary text-sm">Upload & List</button>
              <button onClick={() => setShowUpload(false)} className="btn-outline text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-100">
              <th className="text-left py-3 px-2 text-dark-500 font-medium">Produk</th>
              <th className="text-left py-3 px-2 text-dark-500 font-medium">SKU</th>
              <th className="text-right py-3 px-2 text-dark-500 font-medium">Harga Normal</th>
              <th className="text-right py-3 px-2 text-dark-500 font-medium">Harga Saat Ini</th>
              <th className="text-right py-3 px-2 text-dark-500 font-medium">Stok</th>
              <th className="text-center py-3 px-2 text-dark-500 font-medium">Sisa Waktu</th>
              <th className="text-center py-3 px-2 text-dark-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const time = timeLeft(p.expiry);
              const discount = Math.round(((p.basePrice - p.currentPrice) / p.basePrice) * 100);
              return (
                <tr key={p.id} className="border-b border-dark-50 hover:bg-dark-50 transition">
                  <td className="py-3 px-2 font-medium text-dark-900">{p.name}</td>
                  <td className="py-3 px-2 text-dark-500 font-mono text-xs">{p.sku}</td>
                  <td className="py-3 px-2 text-right text-dark-400 line-through">
                    Rp {p.basePrice.toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-eco-500 font-bold">Rp {p.currentPrice.toLocaleString("id-ID")}</span>
                    {discount > 0 && <span className="badge-deal ml-1">-{discount}%</span>}
                  </td>
                  <td className="py-3 px-2 text-right">{p.stock}</td>
                  <td className={`py-3 px-2 text-center font-mono text-xs ${time.color}`}>{time.text}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.status === "ACTIVE" ? "bg-eco-100 text-eco-700" :
                      p.status === "LOW_STOCK" ? "bg-deal-100 text-deal-700" :
                      "bg-dark-100 text-dark-500"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
