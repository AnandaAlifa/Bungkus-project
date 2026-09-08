"use client";

import { useEffect, useState } from "react";

export function HeroSection() {
  const [impact, setImpact] = useState({
    mealsSaved: 0,
    co2Reduced: 0,
    merchantsActive: 0,
  });

  // Simulate live impact counter
  useEffect(() => {
    const target = { mealsSaved: 125847, co2Reduced: 89.2, merchantsActive: 342 };
    const duration = 2000;
    const steps = 60;
    const stepDuration = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);

      setImpact({
        mealsSaved: Math.round(target.mealsSaved * eased),
        co2Reduced: Math.round(target.co2Reduced * eased * 10) / 10,
        merchantsActive: Math.round(target.merchantsActive * eased),
      });

      if (step >= steps) clearInterval(timer);
    }, stepDuration);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-eco-50 via-white to-eco-50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-eco-200 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-deal-200 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="section-container relative py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="animate-slide-up">
            <div className="badge-eco inline-block mb-4">
              🌱 Selamatkan Makanan, Selamatkan Bumi
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-dark-900 mb-6 leading-tight">
              Makanan Segar{" "}
              <span className="text-gradient">Hemat Hingga 70%</span>{" "}
              Setiap Hari
            </h1>

            <p className="text-lg text-dark-500 mb-8 max-w-lg">
              Beli makanan near-expiry berkualitas dari bakery, supermarket, dan
              restoran terdekat. Hemat uang, kurangi sampah makanan.
            </p>

            <div className="flex flex-wrap gap-4">
              <a href="/app" className="btn-primary text-lg">
                🛒 Mulai Bungkus
              </a>
              <a href="#how-it-works" className="btn-outline text-lg">
                Pelajari Lebih Lanjut
              </a>
            </div>
          </div>

          {/* Right: Live Impact Card */}
          <div className="animate-fade-in">
            <div className="card bg-gradient-to-br from-eco-500 to-eco-600 text-white p-8 rounded-3xl shadow-xl">
              <h3 className="text-lg font-semibold mb-6 opacity-90">
                📊 Dampak Real-Time
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">
                    {impact.mealsSaved.toLocaleString("id-ID")}
                  </div>
                  <div className="text-sm opacity-80 mt-1">Makanan Terselamatkan</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">
                    {impact.co2Reduced}
                  </div>
                  <div className="text-sm opacity-80 mt-1">Ton CO₂e Dicegah</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">
                    {impact.merchantsActive}
                  </div>
                  <div className="text-sm opacity-80 mt-1">Merchant Aktif</div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/20 text-center">
                <p className="text-sm opacity-80">
                  Setiap pemesanan = langkah kecil untuk bumi 🌍
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
