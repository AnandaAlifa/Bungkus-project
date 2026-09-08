/**
 * Bungkus! — ComplianceModal Component
 * ======================================
 * UU PDP compliant modal for:
 * - GPS Geofencing consent
 * - Food Safety Disclaimer
 *
 * Must be accepted before checkout.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  ScrollView,
  Switch,
} from 'react-native';

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme/tokens';
import type { ComplianceModalProps } from '../../types';

// ============================================================================
// CONTENT DATA
// ============================================================================

const GEOFENCING_CONTENT = {
  title: '📍 Izin Lokasi',
  subtitle: 'Diperlukan untuk menampilkan produk terdekat',
  icon: '📍',
  body: [
    'Kami menggunakan lokasi Anda untuk:',
    '• Menampilkan produk near-expiry dalam radius 5-10 km',
    '• Menghitung jarak ke toko/merchant',
    '• Mengaktifkan notifikasi produk terdekat',
  ],
  legal: [
    'Berdasarkan UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP),',
    'data lokasi Anda hanya digunakan untuk keperluan di atas dan tidak dibagikan ke pihak ketiga.',
    'Anda dapat mencabut izin ini kapan saja melalui Pengaturan.',
  ],
  required: true,
};

const FOOD_SAFETY_CONTENT = {
  title: '🍽️ Disclaimers Keamanan Pangan',
  subtitle: 'Penting untuk keselamatan Anda',
  icon: '⚠️',
  body: [
    'Produk near-expiry adalah makanan yang masih aman dikonsumsi namun mendekati tanggal kedaluwarsa.',
    '',
    'Dengan melanjutkan pembelian, Anda memahami bahwa:',
    '• Makanan harus segera dikonsumsi setelah dibeli',
    '• Kualitas makanan mungkin sedikit berkurang mendekati expiry',
    '• Tidak ada jaminan untuk makanan yang sudah melewati batas waktu',
    '• Simpan bukti pembelian untuk klaim jika diperlukan',
  ],
  legal: [
    'Bungkus! bermitra dengan merchant terverifikasi BPOM.',
    'Produk yang dijual telah melalui pengecekan kualitas.',
    'Jika Anda merasa makanan tidak layak konsumsi, silakan laporkan melalui aplikasi.',
  ],
  required: true,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ComplianceModal({
  visible,
  onAccept,
  onDecline,
  type = 'both',
}: ComplianceModalProps) {
  const [geofencingConsent, setGeofencingConsent] = useState(false);
  const [foodSafetyAccept, setFoodSafetyAccept] = useState(false);
  const [currentStep, setCurrentStep] = useState<'geofencing' | 'food_safety'>(
    type === 'food_safety' ? 'food_safety' : 'geofencing'
  );

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setGeofencingConsent(false);
      setFoodSafetyAccept(false);
      setCurrentStep(type === 'food_safety' ? 'food_safety' : 'geofencing');

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, type, fadeAnim, slideAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDecline();
    });
  };

  const handleAccept = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAccept();
    });
  };

  const handleNext = () => {
    if (currentStep === 'geofencing' && type === 'both') {
      setCurrentStep('food_safety');
    } else {
      handleAccept();
    }
  };

  const canProceed =
    currentStep === 'geofencing'
      ? geofencingConsent
      : foodSafetyAccept;

  const content =
    currentStep === 'geofencing' ? GEOFENCING_CONTENT : FOOD_SAFETY_CONTENT;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[styles.overlay, { opacity: fadeAnim }]}
      >
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View
          style={[
            styles.modal,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Content */}
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon & Title */}
            <View style={styles.headerSection}>
              <Text style={styles.icon}>{content.icon}</Text>
              <Text style={styles.title}>{content.title}</Text>
              <Text style={styles.subtitle}>{content.subtitle}</Text>
            </View>

            {/* Body Points */}
            <View style={styles.bodySection}>
              {content.body.map((line, index) => (
                <Text
                  key={index}
                  style={[
                    styles.bodyText,
                    line === '' && styles.bodySpacer,
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>

            {/* Legal Text */}
            <View style={styles.legalSection}>
              {content.legal.map((line, index) => (
                <Text key={index} style={styles.legalText}>
                  {line}
                </Text>
              ))}
            </View>

            {/* Consent Toggle */}
            <View style={styles.consentSection}>
              {currentStep === 'geofencing' ? (
                <View style={styles.consentRow}>
                  <View style={styles.consentInfo}>
                    <Text style={styles.consentLabel}>
                      Saya izinkan akses lokasi
                    </Text>
                    <Text style={styles.consentSublabel}>
                      Wajib untuk menggunakan fitur ini
                    </Text>
                  </View>
                  <Switch
                    value={geofencingConsent}
                    onValueChange={setGeofencingConsent}
                    trackColor={{
                      false: Colors.neutral[300],
                      true: Colors.primary[300],
                    }}
                    thumbColor={
                      geofencingConsent
                        ? Colors.primary[500]
                        : Colors.neutral[400]
                    }
                  />
                </View>
              ) : (
                <View style={styles.consentRow}>
                  <View style={styles.consentInfo}>
                    <Text style={styles.consentLabel}>
                      Saya memahami & menyetujui
                    </Text>
                    <Text style={styles.consentSublabel}>
                      Disclaimers keamanan pangan di atas
                    </Text>
                  </View>
                  <Switch
                    value={foodSafetyAccept}
                    onValueChange={setFoodSafetyAccept}
                    trackColor={{
                      false: Colors.neutral[300],
                      true: Colors.primary[300],
                    }}
                    thumbColor={
                      foodSafetyAccept
                        ? Colors.primary[500]
                        : Colors.neutral[400]
                    }
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            {/* Step Indicator */}
            {type === 'both' && (
              <View style={styles.stepIndicator}>
                <View
                  style={[
                    styles.stepDot,
                    currentStep === 'geofencing' && styles.stepDotActive,
                  ]}
                />
                <View
                  style={[
                    styles.stepDot,
                    currentStep === 'food_safety' && styles.stepDotActive,
                  ]}
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.acceptButton,
                !canProceed && styles.acceptButtonDisabled,
              ]}
              onPress={handleNext}
              disabled={!canProceed}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.acceptButtonText,
                  !canProceed && styles.acceptButtonTextDisabled,
                ]}
              >
                {type === 'both' && currentStep === 'geofencing'
                  ? 'Lanjutkan'
                  : 'Saya Setuju & Lanjut'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>Nanti Saja</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Overlay
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },

  // Modal
  modal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    maxHeight: '85%',
    ...Shadows.xl,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[300],
    alignSelf: 'center',
    marginTop: Spacing[2],
    marginBottom: Spacing[3],
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing[5],
    maxHeight: 400,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing[5],
  },
  icon: {
    fontSize: 48,
    marginBottom: Spacing[3],
  },
  title: {
    ...Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.neutral[900],
    marginBottom: Spacing[1],
  },
  subtitle: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
    textAlign: 'center',
  },

  // Body
  bodySection: {
    marginBottom: Spacing[4],
  },
  bodyText: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.neutral[700],
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
    marginBottom: Spacing[1],
  },
  bodySpacer: {
    height: Spacing[2],
  },

  // Legal
  legalSection: {
    backgroundColor: Colors.neutral[50],
    padding: Spacing[3],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing[4],
  },
  legalText: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
    lineHeight: Typography.fontSize.xs * Typography.lineHeight.relaxed,
    marginBottom: Spacing[1],
  },

  // Consent
  consentSection: {
    marginBottom: Spacing[4],
  },
  consentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    padding: Spacing[3],
    borderRadius: BorderRadius.lg,
  },
  consentInfo: {
    flex: 1,
    marginRight: Spacing[3],
  },
  consentLabel: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.base,
    color: Colors.neutral[900],
  },
  consentSublabel: {
    ...Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
    marginTop: Spacing[1],
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[5],
    paddingTop: Spacing[3],
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[300],
  },
  stepDotActive: {
    backgroundColor: Colors.primary[500],
    width: 24,
  },
  acceptButton: {
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    marginBottom: Spacing[2],
  },
  acceptButtonDisabled: {
    backgroundColor: Colors.neutral[200],
  },
  acceptButtonText: {
    ...Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.md,
    color: Colors.background,
  },
  acceptButtonTextDisabled: {
    color: Colors.neutral[400],
  },
  declineButton: {
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },
  declineButtonText: {
    ...Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[500],
  },
});

export default ComplianceModal;
