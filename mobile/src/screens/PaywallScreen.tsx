import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

const FEATURES = [
  {
    icon: 'infinite' as const,
    title: 'Unlimited Recordings',
    description: 'Record as many voice notes as you want',
  },
  {
    icon: 'flash' as const,
    title: 'Priority Processing',
    description: 'Faster transcription and rephrasing',
  },
  {
    icon: 'sparkles' as const,
    title: 'All Writing Styles',
    description: 'Access to all professional tones',
  },
  {
    icon: 'cloud-upload' as const,
    title: 'Cloud Backup',
    description: 'Never lose your notes',
  },
  {
    icon: 'ban' as const,
    title: 'No Ads',
    description: 'Distraction-free experience',
  },
];

export default function PaywallScreen() {
  const navigation = useNavigation<any>();
  const {
    packages,
    isLoading,
    purchasePackage,
    restorePurchases,
    freeRecordingsUsed,
    maxFreeRecordings,
  } = useSubscriptionStore();

  const [selectedPackage, setSelectedPackage] = useState<number>(0);

  const handlePurchase = async () => {
    if (packages.length === 0) {
      Alert.alert('Not Available', 'Subscriptions are not available yet. Please try again later.');
      return;
    }

    const success = await purchasePackage(packages[selectedPackage]);
    if (success) {
      Alert.alert('Success!', 'Welcome to Rabona Pro! Enjoy unlimited recordings.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      Alert.alert('Restored!', 'Your subscription has been restored.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('No Subscription Found', 'We could not find any active subscriptions to restore.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[colors.accent, colors.primary]}
              style={styles.iconContainer}
            >
              <Ionicons name="diamond" size={48} color={colors.textOnPrimary} />
            </LinearGradient>
            <Text style={styles.heroTitle}>Upgrade to Pro</Text>
            <Text style={styles.heroSubtitle}>
              Unlock unlimited voice notes and premium features
            </Text>
          </View>

          {/* Usage Warning */}
          <View style={styles.usageWarning}>
            <Ionicons name="warning" size={20} color={colors.warning} />
            <Text style={styles.usageWarningText}>
              You've used {freeRecordingsUsed} of {maxFreeRecordings} free recordings this month
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresSection}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            ))}
          </View>

          {/* Pricing Options */}
          <View style={styles.pricingSection}>
            <Text style={styles.pricingSectionTitle}>Choose your plan</Text>

            {packages.length > 0 ? (
              packages.map((pkg, index) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.pricingCard,
                    selectedPackage === index && styles.pricingCardSelected,
                  ]}
                  onPress={() => setSelectedPackage(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pricingCardLeft}>
                    <View
                      style={[
                        styles.radioButton,
                        selectedPackage === index && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedPackage === index && <View style={styles.radioButtonInner} />}
                    </View>
                    <View>
                      <Text style={styles.pricingTitle}>
                        {pkg.product.title || pkg.packageType}
                      </Text>
                      <Text style={styles.pricingDescription}>
                        {pkg.product.description || 'Full access to all features'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pricingCardRight}>
                    <Text style={styles.pricingPrice}>{pkg.product.priceString}</Text>
                    <Text style={styles.pricingPeriod}>
                      /{pkg.packageType === 'ANNUAL' ? 'year' : 'month'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <>
                {/* Fallback pricing display when RevenueCat is not configured */}
                <TouchableOpacity
                  style={[styles.pricingCard, selectedPackage === 0 && styles.pricingCardSelected]}
                  onPress={() => setSelectedPackage(0)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pricingCardLeft}>
                    <View style={[styles.radioButton, selectedPackage === 0 && styles.radioButtonSelected]}>
                      {selectedPackage === 0 && <View style={styles.radioButtonInner} />}
                    </View>
                    <View>
                      <Text style={styles.pricingTitle}>Monthly</Text>
                      <Text style={styles.pricingDescription}>Cancel anytime</Text>
                    </View>
                  </View>
                  <View style={styles.pricingCardRight}>
                    <Text style={styles.pricingPrice}>$4.99</Text>
                    <Text style={styles.pricingPeriod}>/month</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pricingCard, selectedPackage === 1 && styles.pricingCardSelected]}
                  onPress={() => setSelectedPackage(1)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>BEST VALUE</Text>
                  </View>
                  <View style={styles.pricingCardLeft}>
                    <View style={[styles.radioButton, selectedPackage === 1 && styles.radioButtonSelected]}>
                      {selectedPackage === 1 && <View style={styles.radioButtonInner} />}
                    </View>
                    <View>
                      <Text style={styles.pricingTitle}>Annual</Text>
                      <Text style={styles.pricingDescription}>Save 50%</Text>
                    </View>
                  </View>
                  <View style={styles.pricingCardRight}>
                    <Text style={styles.pricingPrice}>$29.99</Text>
                    <Text style={styles.pricingPeriod}>/year</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handlePurchase}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.subscribeButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="diamond" size={20} color={colors.textOnPrimary} />
                  <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy.
            Subscription automatically renews unless canceled.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  heroTitle: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  usageWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  usageWarningText: {
    flex: 1,
    fontSize: typography.bodySmall,
    color: colors.warning,
  },
  featuresSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  featureDescription: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  pricingSection: {
    marginBottom: spacing.lg,
  },
  pricingSectionTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  pricingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
    ...shadows.sm,
  },
  pricingCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  pricingCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  pricingTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  pricingDescription: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  pricingCardRight: {
    alignItems: 'flex-end',
  },
  pricingPrice: {
    fontSize: typography.h4,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  pricingPeriod: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderBottomLeftRadius: borderRadius.sm,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: typography.bold,
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  bottomSection: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  subscribeButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  subscribeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  subscribeButtonText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  restoreButtonText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  termsText: {
    fontSize: typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 16,
  },
});
