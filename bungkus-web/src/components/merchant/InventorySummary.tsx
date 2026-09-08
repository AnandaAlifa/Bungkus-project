const items = [
  { name: "Roti Tawar Gandum", qty: 8, max: 30, price: 15400, status: "active" as const },
  { name: "Croissant Coklat", qty: 3, max: 20, price: 8500, status: "low" as const },
  { name: "Nasi Goreng Ayam", qty: 0, max: 15, price: 0, status: "sold_out" as const },
  { name: "Jus Alpukat", qty: 12, max: 25, price: 8000, status: "active" as const },
];

export function InventorySummary() {
  return (
    <div className="card">
      <h3 className="text-sm font-bold text-dark-700 mb-3">📦 Top Items</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-dark-900 truncate">{item.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.status === "sold_out"
                        ? "bg-dark-300"
                        : item.status === "low"
                        ? "bg-deal-400"
                        : "bg-eco-500"
                    }`}
                    style={{ width: `${(item.qty / item.max) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-dark-500 whitespace-nowrap">
                  {item.qty}/{item.max}
                </span>
              </div>
            </div>
            {item.status === "active" && (
              <span className="badge-eco ml-2">Rp {item.price.toLocaleString("id-ID")}</span>
            )}
            {item.status === "low" && (
              <span className="badge-deal ml-2">Low Stock</span>
            )}
            {item.status === "sold_out" && (
              <span className="bg-dark-100 text-dark-500 text-xs px-2 py-1 rounded-full ml-2">Habis</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
