import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    mealsSaved: 125847,
    co2ReducedTons: 89.2,
    merchantsActive: 342,
    totalOrders: 84732,
    updatedAt: new Date().toISOString(),
  });
}
