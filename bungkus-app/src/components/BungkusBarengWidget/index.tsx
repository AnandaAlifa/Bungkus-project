/**
 * Bungkus! — BungkusBarengWidget Component
 * ==========================================
 * Real-time Group Buying widget with:
 * - Member avatar stack
 * - Progress indicator ("3/5 Joined")
 * - Live countdown timer (MM:SS)
 * - WhatsApp/Deep-link Share CTA
 *
 * Design System: Eco Green #0E9F6E, Deal Orange #FF5A1F
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Linking,
} from 'react-native';

import { Colors, Typography, Spacing, BorderRadius, Shadows, Animation } from '../../theme/tokens';
import type { BungkusBarengWidgetProps, GroupBuy, GroupBuyParticipant } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/**
 * Calculate time remaining as MM:SS string
 */
function formatTimeRemaining(expiresAt: string): string {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diff = Math.max(0, expiry - now);

  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Generate WhatsApp share link
 */
function generateWhatsAppLink(groupBuy: GroupBuy): string {
  const message = encodeURIComponent(
    `🎉 Yuk ikutan Bungkus Bareng!\n\n` +
    `🍞 ${groupBuy.product.name}\n` +
    `💰 Harga grup: ${formatRupiah(groupBuy.groupPrice)} (hemat ${groupBuy.discountPercent}%)\n` +
    `👥 ${groupBuy.currentQuota}/${groupBuy.requiredQuota} sudah join\n\n` +
    `Buruan, kuota terbatas! ⏰`
  );
  return `whatsapp://send?text=${message}`;
}

// ============================================================================
// AVATAR STACK
// ============================================================================

interface AvatarStackProps {
  participants: GroupBuyParticipant[];
  maxVisible?: number;
  requiredQuota: number;
}

function AvatarStack({ participants, maxVisible = 4, requiredQuota }: AvatarStackProps) {
  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - maxVisible;

  return (
    <View style={avatarStyles.container}>
      {visible.map((participant, index) => (
        <View
          key={participant.userId}
          style={[
            avatarStyles.avatar,
            {
              zIndex: maxVisible - index,
              marginLeft: index > 0 ? -Spacing[2] : 0,
            },
          ]}
        >
          {participant.avatarUrl ? (
            <Text style={avatarStyles.avatarText}>
              {participant.displayName[0]}
            </Text>
          ) : (
            <View style={avatarStyles.avatarFallback}>
              <Text style={avatarStyles.avatarInitial}>
                {participant.displayName[0]}
              </Text>
            </View>
          )}
          {/* Online indicator */}
          <View style={avatarStyles.onlineDot} />
        </View>
      ))}

      {overflow > 0 && (
        <View
          style={[
            avatarStyles.avatar,
            avatarStyles.overflowAvatar,
            { marginLeft: -Spacing[2], zIndex: 0 },
          ]}
        >
          <Text style={avatarStyles.overflowText}>+{overflow}</Text>
        </View>
      )}

      {/* Empty slots */}
      {Array.from({ length: Math.min(3, requiredQuota - participants.length) }).map(
        (_, index) => (
          <View
            key={`empty-${index}`}
            style={[
              avatarStyles.avatar,
              avatarStyles.emptyAvatar,
              { marginLeft: -Spacing[2] },
            ]}
          >
            <Text style={avatarStyles.emptyText}>?</Text>
          </View>
        ),
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary[700],
  },
  avatarInitial: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary[700],
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  overflowAvatar: {
    backgroundColor: Colors.neutral[200],
  },
  overflowText: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[600],
  },
  emptyAvatar: {
    backgroundColor: Colors.neutral[100],
    borderStyle: 'dashed',
  },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
  },
});

// ============================================================================
// PROGRESS INDICATOR
// ============================================================================

interface ProgressProps {
  current: number;
  required: number;
}

function ProgressIndicator({ current, required }: ProgressProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: current / required,
      duration: Animation.duration.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [current, required, progress]);

  const isMet = current >= required;

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.textRow}>
        <Text style={progressStyles.label}>Target:</Text>
        <Text
          style={[
            progressStyles.count,
            isMet && progressStyles.countMet,
          ]}
        >
          {current}/{required} Joined
        </Text>
      </View>

      <View style={progressStyles.barBackground}>
        <Animated.View
          style={[
            progressStyles.barFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: isMet ? Colors.primary[500] : Colors.accent[500],
            },
          ]}
        />
      </View>

      {isMet && (
        <View style={progressStyles.metBadge}>
          <Text style={progressStyles.metText}>✅ Target Tercapai!</Text>
        </View>
      )}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing[3],
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[2],
  },
  label: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
  },
  count: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[700],
  },
  countMet: {
    color: Colors.primary[500],
  },
  barBackground: {
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[200],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  metBadge: {
    marginTop: Spacing[2],
    backgroundColor: Colors.primary[50],
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
  },
  metText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary[600],
  },
});

// ============================================================================
// LIVE COUNTDOWN
// ============================================================================

interface CountdownProps {
  expiresAt: string;
}

function LiveCountdown({ expiresAt }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(expiresAt));
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(expiresAt);
      setTimeLeft(remaining);

      // Pulse when under 1 minute
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff < 60000 && diff > 0) {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, pulseAnim]);

  const isUrgent = timeLeft.startsWith('00:');

  return (
    <Animated.View
      style={[
        countdownStyles.container,
        isUrgent && countdownStyles.urgent,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Text style={countdownStyles.icon}>⏰</Text>
      <Text
        style={[
          countdownStyles.time,
          isUrgent && countdownStyles.timeUrgent,
        ]}
      >
        {timeLeft}
      </Text>
      <Text style={countdownStyles.label}>tersisa</Text>
    </Animated.View>
  );
}

const countdownStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent[50],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[4],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing[3],
  },
  urgent: {
    backgroundColor: Colors.accent[100],
  },
  icon: {
    fontSize: Typography.fontSize.lg,
    marginRight: Spacing[2],
  },
  time: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent[600],
  },
  timeUrgent: {
    color: Colors.error,
  },
  label: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
    marginLeft: Spacing[2],
  },
});

// ============================================================================
// SHARE BUTTONS
// ============================================================================

interface ShareButtonsProps {
  groupBuy: GroupBuy;
  onShare?: () => void;
}

function ShareButtons({ groupBuy, onShare }: ShareButtonsProps) {
  const handleWhatsApp = useCallback(async () => {
    const url = generateWhatsAppLink(groupBuy);
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      // Fallback to web WhatsApp
      await Linking.openURL(
        `https://wa.me/?text=${encodeURIComponent(
          `Yuk ikutan Bungkus Bareng! ${groupBuy.product.name} - ${formatRupiah(groupBuy.groupPrice)}`
        )}`
      );
    }
    onShare?.();
  }, [groupBuy, onShare]);

  const handleDeepLink = useCallback(() => {
    const deepLink = `bungkus://group/${groupBuy.id}`;
    Linking.openURL(deepLink).catch(() => {
      // App not installed, open web
      Linking.openURL(`https://bungkus.id/group/${groupBuy.id}`);
    });
    onShare?.();
  }, [groupBuy.id, onShare]);

  return (
    <View style={shareStyles.container}>
      <TouchableOpacity
        style={shareStyles.whatsappButton}
        onPress={handleWhatsApp}
        activeOpacity={0.8}
      >
        <Text style={shareStyles.whatsappIcon}>💬</Text>
        <Text style={shareStyles.whatsappText}>Share WhatsApp</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={shareStyles.linkButton}
        onPress={handleDeepLink}
        activeOpacity={0.8}
      >
        <Text style={shareStyles.linkIcon}>🔗</Text>
        <Text style={shareStyles.linkText}>Salin Link</Text>
      </TouchableOpacity>
    </View>
  );
}

const shareStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    gap: Spacing[2],
  },
  whatsappIcon: {
    fontSize: Typography.fontSize.lg,
  },
  whatsappText: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.base,
    color: Colors.background,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[100],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: BorderRadius.lg,
    gap: Spacing[2],
  },
  linkIcon: {
    fontSize: Typography.fontSize.lg,
  },
  linkText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    color: Colors.neutral[700],
  },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BungkusBarengWidget({
  groupBuy,
  onJoin,
  onShare,
  onDetail,
}: BungkusBarengWidgetProps) {
  const isQuotaMet = groupBuy.currentQuota >= groupBuy.requiredQuota;
  const isExpired = groupBuy.state === 'EXPIRED' || groupBuy.state === 'CANCELLED';
  const isLocked = groupBuy.state === 'LOCKED';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.badge}>🎯 BUNGKUS BARENG</Text>
          <Text style={styles.discount}>
            Hemat {groupBuy.discountPercent}%
          </Text>
        </View>
        <TouchableOpacity onPress={onDetail} activeOpacity={0.7}>
          <Text style={styles.detailLink}>Lihat Detail →</Text>
        </TouchableOpacity>
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {groupBuy.product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>
            {formatRupiah(groupBuy.originalPrice)}
          </Text>
          <Text style={styles.groupPrice}>
            {formatRupiah(groupBuy.groupPrice)}
          </Text>
        </View>
      </View>

      {/* Avatar Stack + Progress */}
      <View style={styles.participationSection}>
        <AvatarStack
          participants={groupBuy.participants}
          requiredQuota={groupBuy.requiredQuota}
        />
        <ProgressIndicator
          current={groupBuy.currentQuota}
          required={groupBuy.requiredQuota}
        />
      </View>

      {/* Live Countdown */}
      {!isExpired && !isLocked && (
        <LiveCountdown expiresAt={groupBuy.expiresAt} />
      )}

      {/* Status Messages */}
      {isLocked && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>🔒 Terkunci — Menunggu Pickup</Text>
        </View>
      )}
      {isExpired && (
        <View style={[styles.statusBanner, styles.expiredBanner]}>
          <Text style={[styles.statusText, styles.expiredText]}>
            ⏰ Waktu Habis — Group Buy Berakhir
          </Text>
        </View>
      )}

      {/* CTA Buttons */}
      {!isExpired && !isLocked && (
        <View style={styles.ctaSection}>
          {!isQuotaMet ? (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={onJoin}
              activeOpacity={0.8}
            >
              <Text style={styles.joinButtonText}>🚀 Ikutan Sekarang</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quotaMetBanner}>
              <Text style={styles.quotaMetText}>
                ✅ Kuota penuh! Siap bayar & ambil
              </Text>
            </View>
          )}

          <ShareButtons groupBuy={groupBuy} onShare={onShare} />
        </View>
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
    borderWidth: 1,
    borderColor: Colors.primary[200],
    ...Shadows.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  badge: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary[600],
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1],
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  discount: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.xs,
    color: Colors.accent[500],
  },
  detailLink: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary[500],
  },

  // Product
  productInfo: {
    marginBottom: Spacing[3],
  },
  productName: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.md,
    color: Colors.neutral[900],
    marginBottom: Spacing[1],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  originalPrice: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  groupPrice: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.primary[500],
  },

  // Participation
  participationSection: {
    marginBottom: Spacing[3],
  },

  // Status
  statusBanner: {
    backgroundColor: Colors.primary[50],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  statusText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary[600],
  },
  expiredBanner: {
    backgroundColor: Colors.neutral[100],
  },
  expiredText: {
    color: Colors.neutral[600],
  },

  // CTA
  ctaSection: {
    gap: Spacing[3],
  },
  joinButton: {
    backgroundColor: Colors.accent[500],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  joinButtonText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.background,
  },
  quotaMetBanner: {
    backgroundColor: Colors.primary[50],
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  quotaMetText: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary[600],
  },
});

export default BungkusBarengWidget;
