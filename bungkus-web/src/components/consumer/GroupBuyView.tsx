"use client";

import { useEffect, useState, useCallback } from "react";

interface Participant {
  userId: string;
  name: string;
  joinedAt: string;
}

interface GroupBuyData {
  id: string;
  productName: string;
  merchantName: string;
  originalPrice: number;
  groupPrice: number;
  discountPercent: number;
  requiredQuota: number;
  currentQuota: number;
  expiresAt: string;
  state: string;
  participants: Participant[];
}

export function GroupBuyView({ groupId }: { groupId: string }) {
  const [data, setData] = useState<GroupBuyData | null>(null);
  const [timeLeft, setTimeLeft] = useState("--:--");
  const [joining, setJoining] = useState(false);

  // Mock data for demo
  useEffect(() => {
    setData({
      id: groupId,
      productName: "Nasi Goreng Spesial Ayam",
      merchantName: "Warung Bu Ani",
      originalPrice: 35000,
      groupPrice: 24500,
      discountPercent: 30,
      requiredQuota: 5,
      currentQuota: 3,
      expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      state: "WAITING_MEMBERS",
      participants: [
        { userId: "u1", name: "Budi", joinedAt: new Date().toISOString() },
        { userId: "u2", name: "Sari", joinedAt: new Date().toISOString() },
        { userId: "u3", name: "Andi", joinedAt: new Date().toISOString() },
      ],
    });
  }, [groupId]);

  // Countdown timer
  useEffect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      const diff = new Date(data.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [data]);

  const handleJoin = useCallback(() => {
    setJoining(true);
    setTimeout(() => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              currentQuota: prev.currentQuota + 1,
              participants: [
                ...prev.participants,
                { userId: "me", name: "Kamu", joinedAt: new Date().toISOString() },
              ],
            }
          : prev
      );
      setJoining(false);
    }, 1000);
  }, []);

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const isQuotaMet = data.currentQuota >= data.requiredQuota;

  return (
    <div className="min-h-screen bg-dark-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="card mb-6">
          <div className="badge-deal inline-block mb-2">🎯 BUNGKUS BARENG</div>
          <h1 className="text-2xl font-bold text-dark-900 mb-1">{data.productName}</h1>
          <p className="text-dark-500">{data.merchantName}</p>
        </div>

        {/* Price */}
        <div className="card mb-6 text-center">
          <div className="text-dark-400 line-through">Rp {data.originalPrice.toLocaleString("id-ID")}</div>
          <div className="text-4xl font-bold text-eco-500">Rp {data.groupPrice.toLocaleString("id-ID")}</div>
          <div className="badge-deal mt-2">Hemat {data.discountPercent}%</div>
        </div>

        {/* Progress */}
        <div className="card mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-dark-500">Target:</span>
            <span className="font-bold">{data.currentQuota}/{data.requiredQuota} Joined</span>
          </div>
          <div className="h-3 bg-dark-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-eco-500 to-eco-400 transition-all duration-500"
              style={{ width: `${(data.currentQuota / data.requiredQuota) * 100}%` }}
            />
          </div>
        </div>

        {/* Avatars */}
        <div className="card mb-6">
          <div className="flex -space-x-3 mb-3">
            {data.participants.map((p, i) => (
              <div
                key={p.userId}
                className="w-10 h-10 rounded-full bg-eco-100 border-2 border-white flex items-center justify-center text-sm font-bold text-eco-700"
                style={{ zIndex: 10 - i }}
              >
                {p.name[0]}
              </div>
            ))}
          </div>
          <div className="text-sm text-dark-500">
            {data.participants.map((p) => p.name).join(", ")} sudah join
          </div>
        </div>

        {/* Countdown */}
        {!isQuotaMet && (
          <div className="card mb-6 text-center">
            <div className="text-sm text-dark-500 mb-1">⏰ Sisa Waktu</div>
            <div className="text-4xl font-mono font-bold text-deal-500">{timeLeft}</div>
          </div>
        )}

        {/* CTA */}
        {!isQuotaMet ? (
          <button onClick={handleJoin} disabled={joining} className="btn-accent w-full text-lg">
            {joining ? "Bergabung..." : "🚀 Ikutan Sekarang"}
          </button>
        ) : (
          <div className="card bg-eco-50 text-center">
            <div className="text-lg font-bold text-eco-600">✅ Kuota Penuh!</div>
            <div className="text-sm text-dark-500">Siap bayar & ambil</div>
          </div>
        )}

        {/* Share */}
        <div className="flex gap-3 mt-4">
          <button className="flex-1 bg-[#25D366] text-white py-3 rounded-xl font-semibold">
            💬 Share WhatsApp
          </button>
          <button className="flex-1 bg-dark-100 text-dark-700 py-3 rounded-xl font-semibold">
            🔗 Salin Link
          </button>
        </div>
      </div>
    </div>
  );
}
