/**
 * Bungkus! — Demo Screen
 * =======================
 * Shows all components in action with mock data.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

import { Colors, Typography, Spacing } from '../theme/tokens';
import { DynamicPriceCard } from '../components/DynamicPriceCard';
import { BungkusBarengWidget } from '../components/BungkusBarengWidget';
import { BungkusImpactWidget } from '../components/BungkusImpactWidget';
import { ComplianceModal } from '../components/ComplianceModal';
import { useBungkusWebSocket } from '../hooks/useBungkusWebSocket';
import type { Product, GroupBuy, ImpactMetrics } from '../types';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_PRODUCT: Product = {
  id: 'prod-001',
  merchantId: 'merch-001',
  name: 'Roti Tawar Gandum Premium — Hari Ini',
  description: 'Roti tawar gandum segar dari oven',
  imageUrl: '',
  basePrice: 22000,
  currentPrice: 15400,
  minPrice: 5000,
  discountPercent: 30,
  quantityInit: 30,
  quantityRemaining: 8,
  unit: 'pcs',
  expiryTimestamp: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),  // 2 hours
  listedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),  // 6 hours ago
  merchant: {
    id: 'merch-001',
    name: 'Toko Roti Sehat',
    slug: 'toko-roti-sehat',
    businessType: 'bakery',
    avgRating: 4.8,
    totalReviews: 234,
    location: { lng: 106.8, lat: -6.2 },
    operationalHours: {},
  },
  category: {
    id: 'cat-001',
    name: 'Bakery',
    nameId: 'Roti & Kue',
    icon: '🍞',
    carbonFactorKg: 1.0,
  },
};

const MOCK_GROUP_BUY: GroupBuy = {
  id: 'gb-001',
  productId: 'prod-002',
  merchantId: 'merch-001',
  leaderId: 'user-001',
  requiredQuota: 5,
  currentQuota: 3,
  maxQuota: 10,
  originalPrice: 35000,
  groupPrice: 24500,
  discountPercent: 30,
  state: 'WAITING_MEMBERS',
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),  // 45 minutes
  product: {
    ...MOCK_PRODUCT,
    id: 'prod-002',
    name: 'Nasi Goreng Spesial Ayam',
    basePrice: 35000,
    currentPrice: 24500,
  },
  merchant: MOCK_PRODUCT.merchant,
  participants: [
    { userId: 'u1', displayName: 'Budi', avatarUrl: '', paymentStatus: 'HELD', joinedAt: new Date().toISOString(), reservedQty: 1 },
    { userId: 'u2', displayName: 'Sari', avatarUrl: '', paymentStatus: 'PAID', joinedAt: new Date().toISOString(), reservedQty: 1 },
    { userId: 'u3', displayName: 'Andi', avatarUrl: '', paymentStatus: 'PENDING', joinedAt: new Date().toISOString(), reservedQty: 1 },
  ],
};

const MOCK_IMPACT: ImpactMetrics = {
  totalSavingsRp: 245000,
  totalMealsSaved: 18,
  totalCarbonSavedKg: 12.5,
  monthlySavingsRp: 67000,
  monthlyMealsSaved: 5,
  monthlyCarbonSavedKg: 3.2,
  rank: 42,
  streakDays: 7,
};

// ============================================================================
// DEMO SCREEN
// ============================================================================

export function DemoScreen() {
  const [showCompliance, setShowCompliance] = useState(false);
  const [complianceType, setComplianceType] = useState<'geofencing' | 'food_safety' | 'both'>('both');

  // WebSocket connection (mock group buy ID)
  const ws = useBungkusWebSocket('gb-001', {
    autoConnect: false,  // Disabled for demo
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🌱 Bungkus!</Text>
          <Text style={styles.subtitle}>Eco-Tech Design System Demo</Text>
        </View>

        {/* Section: DynamicPriceCard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DynamicPriceCard</Text>
          <Text style={styles.sectionDesc}>
            Animated price with countdown bar & discount badge
          </Text>
          <DynamicPriceCard
            product={MOCK_PRODUCT}
            onPress={() => console.log('Product pressed')}
            onBuy={() => {
              setComplianceType('food_safety');
              setShowCompliance(true);
            }}
          />
        </View>

        {/* Section: BungkusBarengWidget */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BungkusBarengWidget</Text>
          <Text style={styles.sectionDesc}>
            Real-time group buy with avatar stack & live countdown
          </Text>
          <BungkusBarengWidget
            groupBuy={MOCK_GROUP_BUY}
            onJoin={() => {
              setComplianceType('both');
              setShowCompliance(true);
            }}
            onShare={() => console.log('Share tapped')}
            onDetail={() => console.log('Detail tapped')}
          />
        </View>

        {/* Section: BungkusImpactWidget */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BungkusImpactWidget</Text>
          <Text style={styles.sectionDesc}>
            Personal ESG dashboard with animated counters
          </Text>
          <BungkusImpactWidget
            metrics={MOCK_IMPACT}
            onDetail={() => console.log('Impact detail')}
          />
        </View>

        {/* Section: ComplianceModal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ComplianceModal</Text>
          <Text style={styles.sectionDesc}>
            UU PDP compliant GPS & food safety consent
          </Text>
          <View style={styles.buttonRow}>
            <View
              style={styles.demoButton}
              onTouchEnd={() => {
                setComplianceType('geofencing');
                setShowCompliance(true);
              }}
            >
              <Text style={styles.demoButtonText}>📍 GPS Only</Text>
            </View>
            <View
              style={styles.demoButton}
              onTouchEnd={() => {
                setComplianceType('food_safety');
                setShowCompliance(true);
              }}
            >
              <Text style={styles.demoButtonText}>🍽️ Food Safety</Text>
            </View>
            <View
              style={[styles.demoButton, styles.demoButtonPrimary]}
              onTouchEnd={() => {
                setComplianceType('both');
                setShowCompliance(true);
              }}
            >
              <Text style={[styles.demoButtonText, styles.demoButtonTextPrimary]}>
                ✅ Both
              </Text>
            </View>
          </View>
        </View>

        {/* WebSocket Status */}
        <View style={styles.wsStatus}>
          <Text style={styles.wsStatusTitle}>🔌 WebSocket Status</Text>
          <Text style={styles.wsStatusValue}>
            Status: {ws.state.status} | Latency: {ws.state.latency}ms
          </Text>
          <Text style={styles.wsStatusValue}>
            Events received: {ws.events.length}
          </Text>
        </View>
      </ScrollView>

      {/* Compliance Modal */}
      <ComplianceModal
        visible={showCompliance}
        type={complianceType}
        onAccept={() => {
          setShowCompliance(false);
          console.log('Compliance accepted');
        }}
        onDecline={() => {
          setShowCompliance(false);
          console.log('Compliance declined');
        }}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing[4],
    paddingBottom: Spacing[20],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing[6],
    paddingTop: Spacing[4],
  },
  logo: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.primary[500],
  },
  subtitle: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
    marginTop: Spacing[1],
  },
  section: {
    marginBottom: Spacing[6],
  },
  sectionTitle: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.neutral[900],
    marginBottom: Spacing[1],
  },
  sectionDesc: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
    marginBottom: Spacing[3],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  demoButton: {
    flex: 1,
    backgroundColor: Colors.neutral[100],
    paddingVertical: Spacing[3],
    borderRadius: 12,
    alignItems: 'center',
  },
  demoButtonPrimary: {
    backgroundColor: Colors.primary[500],
  },
  demoButtonText: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[700],
  },
  demoButtonTextPrimary: {
    color: Colors.background,
  },
  wsStatus: {
    backgroundColor: Colors.neutral[100],
    padding: Spacing[3],
    borderRadius: 12,
    marginTop: Spacing[4],
  },
  wsStatusTitle: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[700],
    marginBottom: Spacing[2],
  },
  wsStatusValue: {
    ...Typography.fontFamily.mono,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
    marginBottom: Spacing[1],
  },
});

export default DemoScreen;
