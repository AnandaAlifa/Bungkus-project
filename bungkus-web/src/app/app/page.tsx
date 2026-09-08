"use client";

import { useEffect, useRef, useState } from "react";

interface Merchant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: string;
  items: number;
  type: string;
}

const mockMerchants: Merchant[] = [
  { id: "1", name: "Toko Roti Sehat", lat: -6.2088, lng: 106.8456, distance: "0.3 km", items: 12, type: "bakery" },
  { id: "2", name: "Warung Bu Ani", lat: -6.2100, lng: 106.8470, distance: "0.5 km", items: 8, type: "restaurant" },
  { id: "3", name: "Supermarket Segar", lat: -6.2095, lng: 106.8430, distance: "0.8 km", items: 23, type: "supermarket" },
  { id: "4", name: "Kafe Sehat", lat: -6.2075, lng: 106.8490, distance: "1.2 km", items: 5, type: "cafe" },
];

export default function ConsumerApp() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLoading(false);
        },
        () => {
          // Default to Jakarta
          setUserLocation({ lat: -6.2088, lng: 106.8456 });
          setLoading(false);
        }
      );
    } else {
      setUserLocation({ lat: -6.2088, lng: 106.8456 });
      setLoading(false);
    }
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    let mapInstance: any = null;
    const initMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      mapInstance = L.map(mapRef.current!).setView([userLocation.lat, userLocation.lng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // User marker
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: "#0E9F6E",
        color: "#fff",
        weight: 2,
      }).addTo(map).bindPopup("📍 Lokasi Anda");

      // Merchant markers
      mockMerchants.forEach((m) => {
        const icon = L.divIcon({
          html: `<div style="background:#FF5A1F;color:white;padding:4px 8px;border-radius:8px;font-size:12px;font-weight:bold;white-space:nowrap;">${m.items} item</div>`,
          className: "",
        });
        L.marker([m.lat, m.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${m.name}</b><br>${m.type} • ${m.distance}`);
      });
    };

    initMap();
    return () => { if (mapInstance) mapInstance.remove(); };
  }, [userLocation]);

  return (
    <div className="min-h-screen bg-dark-50">
      {/* Header */}
      <div className="bg-white border-b border-dark-100 px-4 py-3">
        <div className="section-container flex items-center justify-between">
          <h1 className="text-lg font-bold text-eco-500">🌱 Bungkus!</h1>
          <div className="flex gap-2">
            <button className="btn-primary text-sm py-2">🛒 Keranjang</button>
          </div>
        </div>
      </div>

      <div className="section-container py-4">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="card p-0 overflow-hidden">
              <div ref={mapRef} className="h-[50vh] lg:h-[70vh] w-full" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Search */}
            <div className="card">
              <input className="input-field" placeholder="🔍 Cari makanan atau merchant..." />
            </div>

            {/* Nearby Merchants */}
            <div className="card">
              <h3 className="font-bold text-dark-900 mb-3">🏪 Terdekat</h3>
              <div className="space-y-3">
                {mockMerchants.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMerchant(m)}
                    className="p-3 rounded-xl border border-dark-100 hover:border-eco-300 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-dark-900">{m.name}</div>
                        <div className="text-xs text-dark-500">{m.type} • {m.distance}</div>
                      </div>
                      <span className="badge-deal">{m.items} item</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Group Buy CTA */}
            <div className="card bg-gradient-to-br from-deal-500 to-deal-600 text-white">
              <h3 className="font-bold mb-2">🎯 Bungkus Bareng</h3>
              <p className="text-sm opacity-90 mb-3">Beli bareng teman & hemat lebih banyak!</p>
              <a href="/group-buy/demo-001" className="block text-center bg-white text-deal-600 font-bold py-2 rounded-xl">
                Lihat Deal →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
