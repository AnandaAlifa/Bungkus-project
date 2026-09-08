/**
 * Bungkus! — DynamicPriceCard Component
 * =======================================
 * Animated price change counter with:
 * - Strikethrough Base Price
 * - Current Dynamic Price
 * - Discount Badge (%)
 * - Animated Countdown Bar
 *
 * Design System: Eco Green #0E9F6E, Deal Orange #FF5A1F
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme/tokens';
import type { DynamicPriceCardProps, Product } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format Rupiah currency: 20000 → "Rp 20.000"
 */
function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/**
 * Calculate hours remaining until expiry
 */
function getHoursRemaining(expiryTimestamp: string): number {
  const now = Date.now();
  const expiry = new Date(expiryTimestamp).getTime();
  return Math.max(0, (expiry - now) / (1000 * 60 * 60));
}

/**
 * Calculate countdown progress (0 to 1)
 */
function getCountdownProgress(
  listedAt: string,
  expiryTimestamp: string,
): number {
  const now = Date.now();
  const listed = new Date(listedAt).getTime();
  const expiry = new Date(expiryTimestamp).getTime();
  const total = expiry - listed;
  const elapsed = now - listed;
  return Math.min(1, Math.max(0, elapsed / total));
}

// ============================================================================
// ANIMATED PRICE COUNTER
// ============================================================================

interface AnimatedPriceProps {
  value: number;
  duration?: number;
  style?: object;
}

function AnimatedPrice({ value, duration = 600, style }: AnimatedPriceProps) {
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Animate from current displayed value to new value
    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Update display value during animation
    const listener = animatedValue.addListener(({ v }) => {
      setDisplayValue(Math.round(v));
    });

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value, duration, animatedValue]);

  return (
    <Animated.Text style={style}>
      {formatRupiah(displayValue)}
    </Animated.Text>
  );
}

// ============================================================================
// COUNTDOWN BAR
// ============================================================================

interface CountdownBarProps {
  listedAt: string;
  expiryTimestamp: string;
}

function CountdownBar({ listedAt, expiryTimestamp }: CountdownBarProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const newProgress = getCountdownProgress(listedAt, expiryTimestamp);
      setCurrentProgress(newProgress);

      Animated.timing(progress, {
        toValue: newProgress,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);

    return () => clearInterval(interval);
  }, [listedAt, expiryTimestamp, progress]);

  // Color transitions: green → yellow → orange → red
  const barColor = progress.interpolate({
    inputRange: [0, 0.3, 0.6, 0.8, 1],
    outputRange: [
      Colors.primary[500],
      Colors.primary[400],
      Colors.accent[400],
      Colors.accent[500],
      Colors.error,
    ],
  });

  const hoursLeft = getHoursRemaining(expiryTimestamp);
  const timeLabel =
    hoursLeft >= 1
      ? `${Math.floor(hoursLeft)}j ${Math.floor((hoursLeft % 1) * 60)}m`
      : `${Math.floor(hoursLeft * 60)}m`;

  return (
    <View style={countdownStyles.container}>
      <View style={countdownStyles.barBackground}>
        <Animated.View
          style={[
            countdownStyles.barFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      <Text style={countdownStyles.timeLabel}>⏱ {timeLabel}</Text>
    </View>
  );
}

const countdownStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  barBackground: {
    flex: 1,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[200],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  timeLabel: {
    ...Typography.fontFamily.mono,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
    minWidth: 48,
    textAlign: 'right',
  },
});

// ============================================================================
// DISCOUNT BADGE
// ============================================================================

function DiscountBadge({ percent }: { percent: number }) {
  if (percent <= 0) return null;

  return (
    <View style={badgeStyles.container}>
      <Text style={badgeStyles.text}>-{Math.round(percent)}%</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.accent[500],
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1],
    borderRadius: BorderRadius.full,
  },
  text: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.xs,
    color: Colors.background,
    fontWeight: Typography.fontWeight.bold,
  },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DynamicPriceCard({
  product,
  onPress,
  onBuy,
  showCountdown = true,
  compact = false,
}: DynamicPriceCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation on price change
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [product.currentPrice, scaleAnim]);

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.compactRow}>
          <View style={styles.compactInfo}>
            <Text style={styles.compactName} numberOfLines={1}>
              {product.name}
            </Text>
            <Text style={styles.compactMerchant} numberOfLines={1}>
              {product.merchant.name}
            </Text>
          </View>
          <View style={styles.compactPrice}>
            <DiscountBadge percent={product.discountPercent} />
            <Text style={styles.compactBasePrice}>
              {formatRupiah(product.basePrice)}
            </Text>
            <AnimatedPrice
              value={product.currentPrice}
              style={styles.compactCurrentPrice}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header: Merchant + Category */}
      <View style={styles.header}>
        <View style={styles.merchantInfo}>
          <View style={styles.merchantAvatar}>
            <Text style={styles.merchantInitial}>
              {product.merchant.name[0]}
            </Text>
          </View>
          <View>
            <Text style={styles.merchantName} numberOfLines={1}>
              {product.merchant.name}
            </Text>
            <Text style={styles.categoryName}>{product.category.nameId}</Text>
          </View>
        </View>
        <DiscountBadge percent={product.discountPercent} />
      </View>

      {/* Product Image Placeholder */}
      <View style={styles.imageContainer}>
        <Text style={styles.imagePlaceholder}>🍞</Text>
      </View>

      {/* Product Name */}
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>

      {/* Price Section */}
      <View style={styles.priceSection}>
        <View style={styles.priceRow}>
          <Text style={styles.basePrice}>{formatRupiah(product.basePrice)}</Text>
          <Text style={styles.savingsText}>
            Hemat {formatRupiah(product.basePrice - product.currentPrice)}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Text style={styles.currentPrice}>
            {formatRupiah(product.currentPrice)}
          </Text>
        </Animated.View>
      </View>

      {/* Stock Info */}
      <View style={styles.stockRow}>
        <Text style={styles.stockText}>
          Sisa {product.quantityRemaining} {product.unit}
        </Text>
        <Text style={styles.unitPrice}>
          {formatRupiah(product.currentPrice)}/{product.unit}
        </Text>
      </View>

      {/* Countdown Bar */}
      {showCountdown && (
        <CountdownBar
          listedAt={product.listedAt}
          expiryTimestamp={product.expiryTimestamp}
        />
      )}

      {/* Buy Button */}
      {onBuy && (
        <TouchableOpacity
          style={styles.buyButton}
          onPress={onBuy}
          activeOpacity={0.8}
        >
          <Text style={styles.buyButtonText}>🛒 Bungkus Sekarang</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Full Card
  container: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[3],
    ...Shadows.md,
  },

  // Compact Card
  compactContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing[3],
    marginBottom: Spacing[2],
    ...Shadows.sm,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactInfo: {
    flex: 1,
    marginRight: Spacing[3],
  },
  compactName: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.base,
    color: Colors.neutral[900],
  },
  compactMerchant: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
  },
  compactPrice: {
    alignItems: 'flex-end',
  },
  compactBasePrice: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[400],
    textDecorationLine: 'line-through',
    marginTop: Spacing[1],
  },
  compactCurrentPrice: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.primary[500],
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  merchantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    flex: 1,
  },
  merchantAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantInitial: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary[600],
  },
  merchantName: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[900],
  },
  categoryName: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
  },

  // Image
  imageContainer: {
    height: 120,
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  imagePlaceholder: {
    fontSize: 48,
  },

  // Product
  productName: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.md,
    color: Colors.neutral[900],
    marginBottom: Spacing[2],
  },

  // Price
  priceSection: {
    marginBottom: Spacing[2],
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  basePrice: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  savingsText: {
    ...Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.accent[500],
    backgroundColor: Colors.accent[50],
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1],
    borderRadius: BorderRadius.full,
  },
  currentPrice: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.primary[500],
    marginTop: Spacing[1],
  },

  // Stock
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  stockText: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
  },
  unitPrice: {
    ...Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[600],
  },

  // Buy Button
  buyButton: {
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    marginTop: Spacing[3],
  },
  buyButtonText: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.md,
    color: Colors.background,
  },
});

export default DynamicPriceCard;
