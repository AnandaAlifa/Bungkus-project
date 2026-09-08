/**
 * Bungkus! — BungkusImpactWidget Component
 * ==========================================
 * Personal ESG Dashboard showing:
 * - Saved Money (IDR)
 * - Saved Meals (Count)
 * - Prevented CO2e (Kg)
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
import type { BungkusImpactWidgetProps, ImpactMetrics } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

function formatRupiah(amount: number): string {
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  }
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatKg(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)} ton`;
  }
  return `${kg.toFixed(1)} kg`;
}

/**
 * Get rank badge text and color
 */
function getRankBadge(rank: number): { text: string; color: string } {
  if (rank === 1) return { text: '🥇 #1', color: Colors.savings };
  if (rank === 2) return { text: '🥈 #2', color: Colors.neutral[400] };
  if (rank === 3) return { text: '🥉 #3', color: Colors.accent[600] };
  return { text: `#${rank}`, color: Colors.neutral[500] };
}

// ============================================================================
// ANIMATED COUNTER
// ============================================================================

interface AnimatedCounterProps {
  targetValue: number;
  duration?: number;
  formatter: (value: number) => string;
  style?: object;
}

function AnimatedCounter({
  targetValue,
  duration = 1500,
  formatter,
  style,
}: AnimatedCounterProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Reset and animate
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: targetValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const listener = animatedValue.addListener(({ v }) => {
      setDisplayValue(v);
    });

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [targetValue, duration, animatedValue]);

  return <Text style={style}>{formatter(displayValue)}</Text>;
}

// ============================================================================
// IMPACT STAT CARD
// ============================================================================

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  formatter: (value: number) => string;
  color: string;
  bgColor: string;
}

function StatCard({ icon, label, value, formatter, color, bgColor }: StatCardProps) {
  return (
    <View style={[statStyles.container, { backgroundColor: bgColor }]}>
      <Text style={statStyles.icon}>{icon}</Text>
      <AnimatedCounter
        targetValue={value}
        formatter={formatter}
        style={[statStyles.value, { color }]}
      />
      <Text style={[statStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing[3],
    borderRadius: BorderRadius.lg,
  },
  icon: {
    fontSize: 28,
    marginBottom: Spacing[2],
  },
  value: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    marginBottom: Spacing[1],
  },
  label: {
    ...Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
});

// ============================================================================
// STREAK INDICATOR
// ============================================================================

interface StreakProps {
  days: number;
}

function StreakIndicator({ days }: StreakProps) {
  if (days <= 0) return null;

  const flames = Array.from({ length: Math.min(days, 7) });

  return (
    <View style={streakStyles.container}>
      <Text style={streakStyles.label}>🔥 Streak:</Text>
      <View style={streakStyles.flames}>
        {flames.map((_, index) => (
          <Text key={index} style={streakStyles.flame}>
            🔥
          </Text>
        ))}
      </View>
      <Text style={streakStyles.count}>{days} hari berturut!</Text>
    </View>
  );
}

const streakStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent[50],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing[3],
    gap: Spacing[2],
  },
  label: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.accent[600],
  },
  flames: {
    flexDirection: 'row',
  },
  flame: {
    fontSize: Typography.fontSize.sm,
  },
  count: {
    ...Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.accent[600],
  },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BungkusImpactWidget({
  metrics,
  onDetail,
}: BungkusImpactWidgetProps) {
  const rankBadge = getRankBadge(metrics.rank);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>🌍 Dampak Kamu</Text>
          <Text style={styles.subtitle}>Kontribusi untuk bumi 🌱</Text>
        </View>
        <View style={[styles.rankBadge, { backgroundColor: rankBadge.color + '20' }]}>
          <Text style={[styles.rankText, { color: rankBadge.color }]}>
            {rankBadge.text}
          </Text>
        </View>
      </View>

      {/* Main Stats */}
      <View style={styles.statsRow}>
        <StatCard
          icon="💰"
          label="Uang Tersimpan"
          value={metrics.totalSavingsRp}
          formatter={formatRupiah}
          color={Colors.savings}
          bgColor={Colors.accent[50]}
        />
        <StatCard
          icon="🍽️"
          label="Makanan Terselamatkan"
          value={metrics.totalMealsSaved}
          formatter={(v) => `${Math.round(v)} makanan`}
          color={Colors.primary[600]}
          bgColor={Colors.primary[50]}
        />
        <StatCard
          icon="🌱"
          label="CO2e Dicegah"
          value={metrics.totalCarbonSavedKg}
          formatter={formatKg}
          color={Colors.success}
          bgColor={Colors.primary[50]}
        />
      </View>

      {/* Monthly Summary */}
      <View style={styles.monthlySection}>
        <Text style={styles.monthlyTitle}>📅 Bulan Ini</Text>
        <View style={styles.monthlyStats}>
          <View style={styles.monthlyItem}>
            <Text style={styles.monthlyValue}>
              {formatRupiah(metrics.monthlySavingsRp)}
            </Text>
            <Text style={styles.monthlyLabel}>Tersimpan</Text>
          </View>
          <View style={styles.monthlyDivider} />
          <View style={styles.monthlyItem}>
            <Text style={styles.monthlyValue}>
              {metrics.monthlyMealsSaved}
            </Text>
            <Text style={styles.monthlyLabel}>Makanan</Text>
          </View>
          <View style={styles.monthlyDivider} />
          <View style={styles.monthlyItem}>
            <Text style={styles.monthlyValue}>
              {formatKg(metrics.monthlyCarbonSavedKg)}
            </Text>
            <Text style={styles.monthlyLabel}>CO2e</Text>
          </View>
        </View>
      </View>

      {/* Streak */}
      <StreakIndicator days={metrics.streakDays} />

      {/* Fun Fact */}
      <View style={styles.factContainer}>
        <Text style={styles.factIcon}>💡</Text>
        <Text style={styles.factText}>
          {metrics.totalCarbonSavedKg >= 10
            ? `Kamu sudah menyelamatkan ${formatKg(metrics.totalCarbonSavedKg)} CO2e! Setara dengan ${Math.round(metrics.totalCarbonSavedKg / 21)} pohon ditanam. 🌳`
            : metrics.totalMealsSaved >= 10
            ? `Kamu sudah menyelamatkan ${metrics.totalMealsSaved} makanan! Setiap makanan = 1 porsi untuk yang membutuhkan. ❤️`
            : `Mulai dari sekarang! Setiap bungkus = langkah kecil untuk bumi. 🌍`}
        </Text>
      </View>

      {/* Detail Button */}
      {onDetail && (
        <TouchableOpacity
          style={styles.detailButton}
          onPress={onDetail}
          activeOpacity={0.7}
        >
          <Text style={styles.detailButtonText}>Lihat Dampak Lengkap →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[3],
    ...Shadows.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing[4],
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.neutral[900],
  },
  subtitle: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
    marginTop: Spacing[1],
  },
  rankBadge: {
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1],
    borderRadius: BorderRadius.full,
  },
  rankText: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },

  // Monthly
  monthlySection: {
    backgroundColor: Colors.neutral[50],
    borderRadius: BorderRadius.lg,
    padding: Spacing[3],
    marginBottom: Spacing[3],
  },
  monthlyTitle: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[700],
    marginBottom: Spacing[3],
    textAlign: 'center',
  },
  monthlyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  monthlyItem: {
    alignItems: 'center',
  },
  monthlyValue: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.neutral[900],
  },
  monthlyLabel: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
    marginTop: Spacing[1],
  },
  monthlyDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.neutral[200],
  },

  // Fact
  factContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primary[50],
    padding: Spacing[3],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing[3],
    gap: Spacing[2],
  },
  factIcon: {
    fontSize: Typography.fontSize.lg,
  },
  factText: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary[700],
    flex: 1,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.relaxed,
  },

  // Detail
  detailButton: {
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },
  detailButtonText: {
    ...Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary[500],
  },
});

export default BungkusImpactWidget;
