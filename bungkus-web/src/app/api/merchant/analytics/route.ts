import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    weekly: [
      { day: "Sen", revenue: 1850000, waste: 450000, recovered: 320000 },
      { day: "Sel", revenue: 2100000, waste: 380000, recovered: 290000 },
      { day: "Rab", revenue: 1950000, waste: 520000, recovered: 410000 },
      { day: "Kam", revenue: 2400000, waste: 290000, recovered: 250000 },
      { day: "Jum", revenue: 2650000, waste: 340000, recovered: 310000 },
      { day: "Sab", revenue: 3200000, waste: 480000, recovered: 420000 },
      { day: "Min", revenue: 2450000, waste: 310000, recovered: 270000 },
    ],
    summary: {
      totalRevenue: 58500000,
      recoveredRevenue: 12800000,
      preventedWasteKg: 45.2,
      co2ePreventedTons: 8.9,
      ordersCompleted: 847,
      avgDiscount: 32,
    },
  });
}
