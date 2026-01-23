import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Share,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useRecordingStore } from '../store/useRecordingStore';
import { useNotesStore } from '../store/useNotesStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import apiService from '../services/api';
import { ToneType, toneLabels } from '../types';

// Set to false to use voice recording mode (records -> transcribes -> rephrases)
const USE_TEXT_INPUT_MODE = false;

export default function ResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { audioUri } = route.params || {};

  const {
    selectedTone,
    isTranscribing,
    isRephrasing,
    transcribedText,
    rephrasedText,
    error,
    setTranscribing,
    setRephrasing,
    setTranscribedText,
    setRephrasedText,
    setError,
    resetRecording,
  } = useRecordingStore();

  const { addNote } = useNotesStore();
  const { isAuthenticated } = useAuthStore();
  const { incrementFreeUsage, isProUser } = useSubscriptionStore();

  const [showOriginal, setShowOriginal] = useState(false);
  const [selectedToneLocal, setSelectedToneLocal] = useState<ToneType>(selectedTone);
  const [isSaving, setIsSaving] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showTextInput, setShowTextInput] = useState(USE_TEXT_INPUT_MODE);

  useEffect(() => {
    if (audioUri && !USE_TEXT_INPUT_MODE) {
      processAudio();
    }
  }, [audioUri]);

  const processAudio = async () => {
    setTranscribing(true);
    setError(null);

    try {
      const result = await apiService.processAudio(audioUri, selectedToneLocal);

      if (result.success && result.data) {
        setTranscribedText(result.data.transcription.text);
        setRephrasedText(result.data.rephrasing.rephrasedText);
      } else {
        setError(result.error || 'Failed to process audio');
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure the backend is running.');
    } finally {
      setTranscribing(false);
      setRephrasing(false);
    }
  };

  const processTextInput = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter some text');
      return;
    }

    setTranscribing(true);
    setError(null);
    setTranscribedText(inputText);

    try {
      const result = await apiService.rephraseText(inputText, selectedToneLocal);

      if (result.success && result.data) {
        setRephrasedText(result.data.rephrasedText);
        setShowTextInput(false);
      } else {
        setError(result.error || 'Failed to rephrase text');
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure the backend is running.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleRephrase = async (tone: ToneType) => {
    if (!transcribedText) return;

    setSelectedToneLocal(tone);
    setRephrasing(true);
    setError(null);

    try {
      const result = await apiService.rephraseText(transcribedText, tone);

      if (result.success && result.data) {
        setRephrasedText(result.data.rephrasedText);
      } else {
        setError(result.error || 'Failed to rephrase text');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setRephrasing(false);
    }
  };

  const handleSave = async () => {
    if (!transcribedText) return;

    setIsSaving(true);

    const note = {
      id: Date.now().toString(),
      userId: 'local',
      title: `Note ${new Date().toLocaleDateString()}`,
      originalText: transcribedText,
      rephrasedText: rephrasedText || transcribedText,
      tone: selectedToneLocal,
      durationSeconds: 0,
      tags: [],
      isStarred: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const,
    };

    console.log('Saving note:', note);
    addNote(note);
    console.log('Note saved!');

    // Increment free usage counter if not a pro user
    if (!isProUser) {
      incrementFreeUsage();
    }

    if (isAuthenticated) {
      try {
        await apiService.createNote(note);
      } catch (err) {
        // Local save succeeded, backend save failed - that's ok
      }
    }

    setIsSaving(false);
    resetRecording();
    navigation.navigate('Home');
  };

  const handleShare = async () => {
    const textToShare = rephrasedText || transcribedText;
    if (!textToShare) return;

    try {
      await Share.share({
        message: textToShare,
      });
    } catch (err) {
      // Share cancelled or failed
    }
  };

  const handleDiscard = () => {
    resetRecording();
    navigation.navigate('Home');
  };

  const isProcessing = isTranscribing || isRephrasing;
  const displayText = showOriginal ? transcribedText : (rephrasedText || transcribedText);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleDiscard}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Note</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShare}
            disabled={!displayText}
          >
            <Ionicons
              name="share-outline"
              size={24}
              color={displayText ? colors.textPrimary : colors.textLight}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Text Input Mode */}
          {showTextInput && !isProcessing && (
            <View style={styles.textInputContainer}>
              <Text style={styles.textInputTitle}>Enter Your Text</Text>
              <Text style={styles.textInputSubtitle}>
                Type or paste the text you want to enhance
              </Text>
              <TextInput
                style={styles.textInputField}
                placeholder="Enter your thoughts here..."
                placeholderTextColor={colors.textLight}
                value={inputText}
                onChangeText={setInputText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <Text style={styles.toneSelectLabel}>Select style:</Text>
              <View style={styles.toneGrid}>
                {(Object.keys(toneLabels) as ToneType[]).map((tone) => (
                  <TouchableOpacity
                    key={tone}
                    style={[
                      styles.toneChip,
                      selectedToneLocal === tone && styles.toneChipActive,
                    ]}
                    onPress={() => setSelectedToneLocal(tone)}
                  >
                    <Text
                      style={[
                        styles.toneChipText,
                        selectedToneLocal === tone && styles.toneChipTextActive,
                      ]}
                    >
                      {toneLabels[tone]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.enhanceButton}
                onPress={processTextInput}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.enhanceButtonGradient}
                >
                  <Ionicons name="sparkles" size={20} color={colors.textOnPrimary} />
                  <Text style={styles.enhanceButtonText}>Enhance Text</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Processing State */}
          {isProcessing && (
            <View style={styles.processingContainer}>
              <View style={styles.processingIconContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
              <Text style={styles.processingTitle}>
                {isTranscribing ? 'Transcribing...' : 'Rephrasing...'}
              </Text>
              <Text style={styles.processingText}>
                {isTranscribing
                  ? 'Converting your voice to text'
                  : 'Making your text sound better'}
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && (
            <View style={styles.errorContainer}>
              <View style={styles.errorIconContainer}>
                <Ionicons name="alert-circle" size={32} color={colors.error} />
              </View>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={processAudio}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.retryButtonGradient}
                >
                  <Ionicons name="refresh" size={18} color={colors.textOnPrimary} />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Result */}
          {!isProcessing && !error && displayText && (
            <>
              {/* Toggle Original/Rephrased */}
              {rephrasedText && transcribedText !== rephrasedText && (
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[styles.toggleButton, !showOriginal && styles.toggleButtonActive]}
                    onPress={() => setShowOriginal(false)}
                  >
                    <Ionicons
                      name="sparkles"
                      size={16}
                      color={!showOriginal ? colors.textOnPrimary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.toggleButtonText,
                        !showOriginal && styles.toggleButtonTextActive,
                      ]}
                    >
                      Enhanced
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleButton, showOriginal && styles.toggleButtonActive]}
                    onPress={() => setShowOriginal(true)}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={16}
                      color={showOriginal ? colors.textOnPrimary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.toggleButtonText,
                        showOriginal && styles.toggleButtonTextActive,
                      ]}
                    >
                      Original
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Text Content Card */}
              <View style={styles.textCard}>
                <View style={styles.textCardHeader}>
                  <View style={styles.textCardIcon}>
                    <Ionicons
                      name={showOriginal ? 'document-text' : 'sparkles'}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.textCardLabel}>
                    {showOriginal ? 'Original Transcription' : 'Enhanced Text'}
                  </Text>
                </View>
                <Text style={styles.resultText}>{displayText}</Text>
              </View>

              {/* Tone Selector */}
              <View style={styles.toneSection}>
                <Text style={styles.sectionTitle}>Change Style</Text>
                <View style={styles.toneGrid}>
                  {(Object.keys(toneLabels) as ToneType[]).map((tone) => (
                    <TouchableOpacity
                      key={tone}
                      style={[
                        styles.toneChip,
                        selectedToneLocal === tone && styles.toneChipActive,
                      ]}
                      onPress={() => handleRephrase(tone)}
                      disabled={isRephrasing}
                    >
                      <Text
                        style={[
                          styles.toneChipText,
                          selectedToneLocal === tone && styles.toneChipTextActive,
                        ]}
                      >
                        {toneLabels[tone]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        {!isProcessing && !error && displayText && (
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.discardButton} onPress={handleDiscard}>
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.textOnPrimary} />
                    <Text style={styles.saveButtonText}>Save Note</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.h4,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  textInputContainer: {
    flex: 1,
  },
  textInputTitle: {
    fontSize: typography.h3,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textInputSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  textInputField: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    minHeight: 150,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toneSelectLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  enhanceButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  enhanceButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  enhanceButtonText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  processingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  processingTitle: {
    fontSize: typography.h4,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  processingText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  errorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.h4,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  retryButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  retryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  toggleButtonTextActive: {
    color: colors.textOnPrimary,
  },
  textCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  textCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  textCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  textCardLabel: {
    fontSize: typography.caption,
    color: colors.textLight,
    fontWeight: typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultText: {
    fontSize: typography.body,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  toneSection: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  toneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  toneChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toneChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toneChipText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  toneChipTextActive: {
    color: colors.textOnPrimary,
    fontWeight: typography.medium,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  discardButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  discardButtonText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  saveButton: {
    flex: 2,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveButtonText: {
    fontSize: typography.body,
    color: colors.textOnPrimary,
    fontWeight: typography.semibold,
  },
});
