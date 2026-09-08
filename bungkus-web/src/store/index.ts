import { create } from "zustand";
import type { Product, GroupBuy } from "@/types";

// ============================================================
// Cart Store
// ============================================================
interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product, qty = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + qty }
              : i
          ),
        };
      }
      return { items: [...state.items, { product, quantity: qty }] };
    }),

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.product.id !== productId),
    })),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalPrice: () =>
    get().items.reduce((sum, i) => sum + i.product.currentPrice * i.quantity, 0),
}));

// ============================================================
// Group Buy Store
// ============================================================
interface GroupBuyState {
  activeGroupBuy: GroupBuy | null;
  setActiveGroupBuy: (gb: GroupBuy | null) => void;
  updateQuota: (quota: number) => void;
  addParticipant: (participant: GroupBuy["participants"][0]) => void;
}

export const useGroupBuyStore = create<GroupBuyState>((set) => ({
  activeGroupBuy: null,

  setActiveGroupBuy: (gb) => set({ activeGroupBuy: gb }),

  updateQuota: (quota) =>
    set((state) =>
      state.activeGroupBuy
        ? { activeGroupBuy: { ...state.activeGroupBuy, currentQuota: quota } }
        : state
    ),

  addParticipant: (participant) =>
    set((state) =>
      state.activeGroupBuy
        ? {
            activeGroupBuy: {
              ...state.activeGroupBuy,
              currentQuota: state.activeGroupBuy.currentQuota + 1,
              participants: [...state.activeGroupBuy.participants, participant],
            },
          }
        : state
    ),
}));

// ============================================================
// Merchant Store
// ============================================================
interface MerchantDashboardState {
  posConnected: boolean;
  setPosConnected: (connected: boolean) => void;
  inventoryCount: number;
  setInventoryCount: (count: number) => void;
  revenueToday: number;
  setRevenueToday: (revenue: number) => void;
}

export const useMerchantStore = create<MerchantDashboardState>((set) => ({
  posConnected: false,
  setPosConnected: (connected) => set({ posConnected: connected }),
  inventoryCount: 0,
  setInventoryCount: (count) => set({ inventoryCount: count }),
  revenueToday: 0,
  setRevenueToday: (revenue) => set({ revenueToday: revenue }),
}));
