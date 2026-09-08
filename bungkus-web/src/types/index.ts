// ============================================================
// Bungkus! Web — TypeScript Type Definitions
// ============================================================

// Product
export interface Product {
  id: string;
  merchantId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  currentPrice: number;
  minPrice: number;
  discountPercent: number;
  quantityInit: number;
  quantityRemaining: number;
  unit: string;
  expiryTimestamp: string;
  listedAt: string;
  status: "ACTIVE" | "LOW_STOCK" | "SOLD_OUT" | "EXPIRED" | "DELISTED";
}

// Merchant
export interface Merchant {
  id: string;
  name: string;
  slug: string;
  businessType: "bakery" | "supermarket" | "restaurant" | "cafe" | "other";
  avgRating: number;
  totalReviews: number;
  location: { lat: number; lng: number };
  operationalHours: Record<string, { open: string; close: string }>;
}

// Group Buy
export interface GroupBuy {
  id: string;
  productId: string;
  merchantId: string;
  leaderId: string;
  requiredQuota: number;
  currentQuota: number;
  maxQuota: number;
  originalPrice: number;
  groupPrice: number;
  discountPercent: number;
  state: "CREATED" | "WAITING_MEMBERS" | "LOCKED" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  startedAt: string;
  expiresAt: string;
  product: Product;
  merchant: Merchant;
  participants: GroupBuyParticipant[];
}

export interface GroupBuyParticipant {
  userId: string;
  name: string;
  avatarUrl?: string;
  paymentStatus: "PENDING" | "HELD" | "PAID" | "REFUNDED";
  joinedAt: string;
  reservedQty: number;
}

// Order
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  merchantId: string;
  groupId?: string;
  status: "PENDING_PAYMENT" | "PAID" | "READY_FOR_PICKUP" | "PICKED_UP" | "COMPLETED" | "CANCELLED" | "REFUND_PENDING" | "REFUNDED";
  subtotal: number;
  discountAmount: number;
  totalPrice: number;
  qrVerificationHash: string;
  pickupDeadline: string;
  createdAt: string;
}

// Impact Metrics
export interface ImpactMetrics {
  totalSavingsRp: number;
  totalMealsSaved: number;
  totalCarbonSavedKg: number;
  monthlySavingsRp: number;
  monthlyMealsSaved: number;
  monthlyCarbonSavedKg: number;
  rank: number;
  streakDays: number;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
