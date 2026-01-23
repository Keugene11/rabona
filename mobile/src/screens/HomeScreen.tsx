import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';
import { useNotesStore } from '../store/useNotesStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuthStore();
  const { notes } = useNotesStore();
  const {
    isProUser,
    canRecord,
    freeRecordingsUsed,
    maxFreeRecordings,
    initializePurchases
  } = useSubscriptionStore();

  useEffect(() => {
    initializePurchases();
  }, []);

  console.log('HomeScreen notes:', notes.length, notes);

  const hasNotes = notes.length > 0;

  const handleRecordPress = () => {
    if (canRecord()) {
      navigation.navigate('Record');
    } else {
      navigation.navigate('Paywall');
    }
  };

  const renderNoteCard = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.noteCard}>
      <View style={styles.noteCardHeader}>
        <View style={styles.noteIconContainer}>
          <Ionicons name="document-text" size={20} color={colors.primary} />
        </View>
        <Text style={styles.noteDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.notePreview} numberOfLines={2}>
        {item.rephrasedText || item.originalText}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Gradient Header */}
      <LinearGradient
        colors={[colors.backgroundLight, colors.background]}
        style={styles.headerGradient}
      >
        <SafeAreaView>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>
                {isAuthenticated ? `Hey${user?.email ? ', ' + user.email.split('@')[0] : ''}` : 'Welcome'}
              </Text>
              <Text style={styles.title}>Rabona</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => navigation.navigate('Settings')}
              >
                <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {hasNotes ? (
          // Notes list view
          <View style={styles.notesContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Notes</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={notes}
              renderItem={renderNoteCard}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.notesList}
            />
          </View>
        ) : (
          // Empty state
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="mic-outline" size={64} color={colors.textLight} />
              <View style={styles.pulseRing} />
            </View>
            <Text style={styles.emptyTitle}>Ready to Record</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to create your first voice note
            </Text>
          </View>
        )}
      </View>

      {/* Usage Badge for Free Users */}
      {!isProUser && (
        <TouchableOpacity
          style={styles.usageBadge}
          onPress={() => navigation.navigate('Paywall')}
        >
          <Ionicons name="diamond-outline" size={14} color={colors.accent} />
          <Text style={styles.usageBadgeText}>
            {freeRecordingsUsed}/{maxFreeRecordings} free
          </Text>
        </TouchableOpacity>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleRecordPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.fabGradient}
        >
          <Ionicons name="mic" size={28} color={colors.textOnPrimary} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  greeting: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  loginButtonText: {
    color: colors.primary,
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Landing styles
  landingContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100,
  },
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  featureIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  featureTitle: {
    fontSize: typography.h4,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  featureDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
  },
  benefitItem: {
    alignItems: 'center',
  },
  benefitText: {
    marginTop: spacing.xs,
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  getStartedButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  getStartedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  getStartedButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },

  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: colors.primary,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: typography.h4,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Notes list styles
  notesContainer: {
    flex: 1,
    paddingTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.h4,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: typography.bodySmall,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  notesList: {
    paddingBottom: 100,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  noteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noteIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  noteDate: {
    fontSize: typography.caption,
    color: colors.textLight,
  },
  notePreview: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // FAB styles
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    ...shadows.lg,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Usage badge styles
  usageBadge: {
    position: 'absolute',
    bottom: spacing.xl + 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    ...shadows.sm,
  },
  usageBadgeText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
});
