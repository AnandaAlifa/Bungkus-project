const deals = [
  { name: "Roti Tawar Gandum", merchant: "Toko Roti Sehat", price: 15400, original: 22000, discount: 30, icon: "🍞" },
  { name: "Nasi Goreng Ayam", merchant: "Warung Bu Ani", price: 12000, original: 18000, discount: 33, icon: "🍳" },
  { name: "Jus Alpukat Segar", merchant: "Kafe Sehat", price: 8000, original: 15000, discount: 47, icon: "🥑" },
];

export function FeaturedDeals() {
  return (
    <section className="py-20 bg-white">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
            🔥 Deal Hari Ini
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {deals.map((deal) => (
            <div key={deal.name} className="card-hover">
              <div className="text-5xl mb-4">{deal.icon}</div>
              <div className="badge-deal inline-block mb-2">-{deal.discount}%</div>
              <h3 className="text-lg font-bold text-dark-900">{deal.name}</h3>
              <p className="text-sm text-dark-500 mb-3">{deal.merchant}</p>
              <div className="flex items-center gap-2">
                <span className="text-dark-400 line-through text-sm">
                  Rp {deal.original.toLocaleString("id-ID")}
                </span>
                <span className="text-eco-500 font-bold text-xl">
                  Rp {deal.price.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
