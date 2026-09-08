import Link from "next/link";

export default function MerchantIndex() {
  return (
    <div className="min-h-screen bg-dark-50 py-20">
      <div className="section-container text-center">
        <h1 className="text-4xl font-bold text-dark-900 mb-4">
          🏪 Bungkus! for Merchant
        </h1>
        <p className="text-lg text-dark-500 mb-8 max-w-2xl mx-auto">
          Kurangi food waste & tambah revenue dari makanan yang biasanya terbuang.
        </p>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link href="/merchant/dashboard" className="card-hover text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-bold text-dark-900">Dashboard</h3>
            <p className="text-sm text-dark-500">Lihat performa & analytics</p>
          </Link>

          <Link href="/merchant/inventory" className="card-hover text-center">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="font-bold text-dark-900">Inventory</h3>
            <p className="text-sm text-dark-500">Kelola produk near-expiry</p>
          </Link>

          <Link href="/merchant/scanner" className="card-hover text-center">
            <div className="text-4xl mb-3">📱</div>
            <h3 className="font-bold text-dark-900">QR Scanner</h3>
            <p className="text-sm text-dark-500">Verifikasi pesanan pelanggan</p>
          </Link>
        </div>

        <div className="mt-12">
          <a href="/merchant/dashboard" className="btn-primary text-lg">
            Masuk ke Dashboard →
          </a>
        </div>
      </div>
    </div>
  );
}
