"use client";

import { useEffect, useState } from "react";

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  icon: string;
}

const stats: StatItem[] = [
  { label: "Makanan Terselamatkan", value: 125847, suffix: " porsi", icon: "🍽️" },
  { label: "CO₂e Dicegah", value: 89.2, suffix: " ton", icon: "🌱" },
  { label: "Uang Hemat Konsumen", value: 2.4, suffix: " Miliar Rp", icon: "💰" },
  { label: "Merchant Bergabung", value: 342, suffix: " toko", icon: "🏪" },
];

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const steps = 60;
    const stepDuration = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(target * eased);

      if (step >= steps) clearInterval(timer);
    }, stepDuration);

    return () => clearInterval(timer);
  }, [target, duration]);

  const display = target >= 1000 ? Math.round(count).toLocaleString("id-ID") : count.toFixed(1);
  return <>{display}</>;
}

export function ImpactStats() {
  return (
    <section id="impact" className="py-20 bg-white">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
            Dampak Nyata Bungkus!
          </h2>
          <p className="text-dark-500 max-w-2xl mx-auto">
            Bersama-sama kita telah menyelamatkan ratusan ribu porsi makanan dari
            pemborosan.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="card-hover text-center">
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div className="text-3xl md:text-4xl font-bold text-eco-500 mb-2">
                <AnimatedCounter target={stat.value} />
                <span className="text-lg text-dark-400">{stat.suffix}</span>
              </div>
              <div className="text-sm text-dark-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
