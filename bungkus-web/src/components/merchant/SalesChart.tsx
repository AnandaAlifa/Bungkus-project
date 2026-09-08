"use client";

import { useState } from "react";

const data = [
  { day: "Sen", revenue: 1850000, waste: 450000, recovered: 320000 },
  { day: "Sel", revenue: 2100000, waste: 380000, recovered: 290000 },
  { day: "Rab", revenue: 1950000, waste: 520000, recovered: 410000 },
  { day: "Kam", revenue: 2400000, waste: 290000, recovered: 250000 },
  { day: "Jum", revenue: 2650000, waste: 340000, recovered: 310000 },
  { day: "Sab", revenue: 3200000, waste: 480000, recovered: 420000 },
  { day: "Min", revenue: 2450000, waste: 310000, recovered: 270000 },
];

export function SalesChart() {
  const [view, setView] = useState<"revenue" | "waste">("revenue");
  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.waste + d.recovered)));

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView("revenue")}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
            view === "revenue" ? "bg-eco-500 text-white" : "bg-dark-100 text-dark-600"
          }`}
        >
          Revenue
        </button>
        <button
          onClick={() => setView("waste")}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
            view === "waste" ? "bg-deal-500 text-white" : "bg-dark-100 text-dark-600"
          }`}
        >
          Waste vs Recovered
        </button>
      </div>

      <div className="flex items-end gap-3 h-48">
        {data.map((d) => {
          const totalH = view === "revenue"
            ? (d.revenue / maxVal) * 100
            : ((d.waste + d.recovered) / maxVal) * 100;
          const recoveredH = view === "waste" ? (d.recovered / (d.waste + d.recovered)) * totalH : 0;

          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center" style={{ height: "160px", justifyContent: "flex-end" }}>
                {view === "waste" && (
                  <div
                    className="w-full bg-eco-400 rounded-t-lg transition-all duration-500"
                    style={{ height: `${recoveredH}%` }}
                  />
                )}
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    view === "revenue" ? "bg-eco-500" : "bg-deal-400"
                  }`}
                  style={{ height: view === "revenue" ? `${totalH}%` : `${totalH - recoveredH}%` }}
                />
              </div>
              <span className="text-xs text-dark-500">{d.day}</span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 mt-4 text-xs text-dark-500">
        {view === "revenue" ? (
          <span>📊 Revenue per hari (Rp)</span>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-deal-400 rounded" /> Waste
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-eco-400 rounded" /> Recovered
            </span>
          </>
        )}
      </div>
    </div>
  );
}
