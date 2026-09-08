"use client";

import { useState, useRef, useEffect } from "react";

interface ScanResult {
  orderId: string;
  customer: string;
  product: string;
  amount: number;
  verified: boolean;
}

export default function MerchantScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setScanning(true);
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setScanning(false);
  };

  // Simulate scan for demo
  const simulateScan = () => {
    const mock: ScanResult = {
      orderId: `BG-${Date.now().toString(36).toUpperCase()}`,
      customer: "Budi Santoso",
      product: "Roti Tawar Gandum",
      amount: 15400,
      verified: true,
    };
    setResult(mock);
    setHistory((prev) => [mock, ...prev]);
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-900 mb-6">📱 QR Code Scanner</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <div className="card">
          <h3 className="font-bold text-dark-900 mb-4">Scan QR Code Pesanan</h3>

          <div className="relative bg-dark-900 rounded-xl overflow-hidden aspect-square mb-4">
            {scanning ? (
              <>
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-eco-400 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-eco-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-eco-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-eco-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-eco-500 rounded-br-lg" />
                    <div className="absolute inset-0 border-t-2 border-eco-500 animate-pulse" />
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-dark-400">
                <div className="text-5xl mb-4">📷</div>
                <p>Arahkan kamera ke QR Code</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!scanning ? (
              <button onClick={startCamera} className="btn-primary flex-1">
                📷 Mulai Scan
              </button>
            ) : (
              <button onClick={stopCamera} className="btn-outline flex-1">
                ⏹️ Stop
              </button>
            )}
            <button onClick={simulateScan} className="btn-accent">
              🧪 Demo Scan
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="space-y-4">
          {result && (
            <div className={`card ${result.verified ? "border-2 border-eco-500" : "border-2 border-deal-500"} animate-slide-up`}>
              <div className="text-center mb-4">
                <div className="text-5xl mb-2">{result.verified ? "✅" : "❌"}</div>
                <div className="text-lg font-bold text-dark-900">
                  {result.verified ? "Terverifikasi!" : "Gagal Verifikasi"}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-dark-500">Order ID:</span><span className="font-mono">{result.orderId}</span></div>
                <div className="flex justify-between"><span className="text-dark-500">Pelanggan:</span><span>{result.customer}</span></div>
                <div className="flex justify-between"><span className="text-dark-500">Produk:</span><span>{result.product}</span></div>
                <div className="flex justify-between font-bold"><span className="text-dark-500">Total:</span><span className="text-eco-500">Rp {result.amount.toLocaleString("id-ID")}</span></div>
              </div>
              {result.verified && (
                <button className="btn-primary w-full mt-4">✅ Serahkan Pesanan</button>
              )}
            </div>
          )}

          {/* History */}
          <div className="card">
            <h3 className="font-bold text-dark-900 mb-3">Riwayat Scan</h3>
            {history.length === 0 ? (
              <p className="text-sm text-dark-400 text-center py-4">Belum ada scan</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.orderId} className="flex items-center justify-between text-sm py-2 border-b border-dark-50 last:border-0">
                    <div>
                      <div className="font-medium text-dark-900">{h.customer}</div>
                      <div className="text-xs text-dark-400">{h.product}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-eco-500">Rp {h.amount.toLocaleString("id-ID")}</div>
                      <div className="text-xs text-eco-500">✅ Verified</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
