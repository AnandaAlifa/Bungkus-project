import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const groupBuy = {
    id: params.id,
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
      { userId: "u1", name: "Budi", paymentStatus: "HELD" },
      { userId: "u2", name: "Sari", paymentStatus: "PAID" },
      { userId: "u3", name: "Andi", paymentStatus: "PENDING" },
    ],
  };

  return NextResponse.json(groupBuy);
}
