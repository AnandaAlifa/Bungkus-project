const steps = [
  { icon: "📍", title: "Temukan", desc: "Lihat produk near-expiry terdekat via peta interaktif" },
  { icon: "🛒", title: "Bungkus", desc: "Pilih produk & checkout dengan harga diskon hingga 70%" },
  { icon: "📱", title: "QR Ambil", desc: "Tunjukkan QR code ke merchant untuk ambil pesanan" },
  { icon: "🌍", title: "Dampak", desc: "Setiap pembelian mengurangi sampah makanan & CO₂e" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-dark-50">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
            Cara Kerja
          </h2>
          <p className="text-dark-500">4 langkah mudah selamatkan makanan</p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="w-16 h-16 bg-eco-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                {step.icon}
              </div>
              <div className="text-sm font-bold text-eco-500 mb-1">Langkah {i + 1}</div>
              <h3 className="text-lg font-bold text-dark-900 mb-2">{step.title}</h3>
              <p className="text-sm text-dark-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
