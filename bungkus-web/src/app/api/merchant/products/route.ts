import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    products: [
      { id: "1", name: "Roti Tawar Gandum", sku: "BR-001", basePrice: 22000, currentPrice: 15400, stock: 8, status: "ACTIVE" },
      { id: "2", name: "Croissant Coklat", sku: "BR-002", basePrice: 18000, currentPrice: 8500, stock: 3, status: "LOW_STOCK" },
      { id: "3", name: "Nasi Goreng Ayam", sku: "WR-001", basePrice: 18000, currentPrice: 12000, stock: 0, status: "SOLD_OUT" },
    ],
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({
    success: true,
    product: { id: Date.now().toString(), ...body },
  });
}
