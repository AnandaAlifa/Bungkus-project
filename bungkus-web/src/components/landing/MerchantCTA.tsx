export function MerchantCTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-dark-900 to-dark-800">
      <div className="section-container text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          🏪 Untuk Merchant
        </h2>
        <p className="text-dark-300 max-w-2xl mx-auto mb-8">
          Kurangi food waste & tambah revenue dari makanan yang biasanya terbuang.
          Dynamic pricing otomatis berdasarkan waktu & stok.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="/merchant" className="btn-primary text-lg">
            Daftar Merchant
          </a>
          <a href="/merchant/dashboard" className="btn-outline border-white text-white text-lg" style={{ backgroundColor: "transparent" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            Lihat Dashboard
          </a>
        </div>
      </div>
    </section>
  );
}
