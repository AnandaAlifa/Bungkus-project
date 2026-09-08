const connections = [
  { name: "Kasir Utama", status: "connected", lastSync: "2 detik lalu" },
  { name: "Kasir Dapur", status: "connected", lastSync: "15 detik lalu" },
  { name: "Gudang", status: "disconnected", lastSync: "3 jam lalu" },
];

export function POSStatus() {
  return (
    <div className="card">
      <h3 className="text-sm font-bold text-dark-700 mb-3">🔌 POS Status</h3>
      <div className="space-y-2">
        {connections.map((c) => (
          <div key={c.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  c.status === "connected" ? "bg-eco-500" : "bg-dark-300"
                }`}
              />
              <span className="text-dark-700">{c.name}</span>
            </div>
            <span className="text-xs text-dark-400">{c.lastSync}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-dark-100">
        <button className="text-sm text-eco-500 font-medium hover:text-eco-600">
          + Hubungkan POS Baru
        </button>
      </div>
    </div>
  );
}
