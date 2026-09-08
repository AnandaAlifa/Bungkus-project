/**
 * Bungkus! — TypeScript Type Definitions
 * =======================================
 * Shared types across all components.
 */

// ============================================================================
// PRODUCT TYPES
// ============================================================================

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  imageUrl: string;
  basePrice: number;        // Rp (original)
  currentPrice: number;     // Rp (dynamic)
  minPrice: number;         // Rp (floor)
  discountPercent: number;  // 0-100
  quantityInit: number;
  quantityRemaining: number;
  unit: string;             // 'pcs', 'kg', 'pack'
  expiryTimestamp: string;  // ISO 8601
  listedAt: string;         // ISO 8601
  merchant: Merchant;
  category: ProductCategory;
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  businessType: string;     // 'bakery', 'supermarket', 'restaurant'
  avgRating: number;
  totalReviews: number;
  location: GeoLocation;
  operationalHours: OperationalHours;
}

export interface ProductCategory {
  id: string;
  name: string;
  nameId: string;           // Indonesian name
  icon: string;
  carbonFactorKg: number;   // kgCO2e per kg
}

export interface GeoLocation {
  lng: number;
  lat: number;
  distanceMeters?: number;  // from user
}

export interface OperationalHours {
  [key: string]: {          // 'mon', 'tue', etc.
    open: string;           // '08:00'
    close: string;          // '21:00'
  };
}

// ============================================================================
// GROUP BUY TYPES
// ============================================================================

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
  state: GroupBuyState;
  startedAt: string;
  expiresAt: string;
  product: Product;
  merchant: Merchant;
  participants: GroupBuyParticipant[];
}

export type GroupBuyState =
  | 'CREATED'
  | 'WAITING_MEMBERS'
  | 'LOCKED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'AUTO_REFUND';

export interface GroupBuyParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string;
  paymentStatus: PaymentStatus;
  joinedAt: string;
  reservedQty: number;
}

export type PaymentStatus =
  | 'PENDING'
  | 'HELD'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

// ============================================================================
// ORDER TYPES
// ============================================================================

export interface Order {
  id: string;
  orderNumber: string;      // 'BG-20260907-00001'
  userId: string;
  merchantId: string;
  groupBuyId?: string;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  totalPrice: number;
  qrCodeData: string;
  pickupDeadline: string;
  items: OrderItem[];
  createdAt: string;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'EXPIRED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  carbonSavedKg: number;
}

// ============================================================================
// USER / IMPACT TYPES
// ============================================================================

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  totalCarbonSavedKg: number;
  totalSavingsRp: number;
  totalOrdersCompleted: number;
  createdAt: string;
}

export type UserRole = 'CONSUMER' | 'MERCHANT_ADMIN' | 'MERCHANT_STAFF' | 'SUPER_ADMIN';

export interface ImpactMetrics {
  totalSavingsRp: number;
  totalMealsSaved: number;
  totalCarbonSavedKg: number;
  monthlySavingsRp: number;
  monthlyMealsSaved: number;
  monthlyCarbonSavedKg: number;
  rank: number;             // leaderboard position
  streakDays: number;       // consecutive days ordering
}

// ============================================================================
// WEBSOCKET EVENT TYPES
// ============================================================================

export type WSEventType =
  | 'GROUP_CREATED'
  | 'GROUP_UPDATED'
  | 'MEMBER_JOINED'
  | 'MEMBER_LEFT'
  | 'QUOTA_MET'
  | 'GROUP_TIMED_OUT'
  | 'PAYMENT_HELD'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'GROUP_LOCKED'
  | 'GROUP_COMPLETED'
  | 'GROUP_EXPIRED'
  | 'AUTO_REFUND_TRIGGERED'
  | 'PRICE_UPDATED'
  | 'HEARTBEAT'
  | 'ERROR';

export interface WSEvent {
  eventType: WSEventType;
  groupBuyId: string;
  timestamp: string;
  data: Record<string, unknown>;
  actorId?: string;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface DynamicPriceCardProps {
  product: Product;
  onPress?: () => void;
  onBuy?: () => void;
  showCountdown?: boolean;
  compact?: boolean;
}

export interface BungkusBarengWidgetProps {
  groupBuy: GroupBuy;
  onJoin?: () => void;
  onShare?: () => void;
  onDetail?: () => void;
}

export interface BungkusImpactWidgetProps {
  metrics: ImpactMetrics;
  onDetail?: () => void;
}

export interface ComplianceModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  type: 'geofencing' | 'food_safety' | 'both';
}
