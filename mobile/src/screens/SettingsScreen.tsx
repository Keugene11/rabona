import React, { useState, useEffect } from 'react';
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import Constants from 'expo-constants';
import { auth } from '../config/firebase';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

WebBrowser.maybeCompleteAuthSession();

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import and configure Google Sign-In for native builds only
let GoogleSignin: any = null;
let isSuccessResponse: any = null;
let isErrorWithCode: any = null;
let statusCodes: any = null;

if (!isExpoGo) {
  const googleSignIn = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignIn.GoogleSignin;
  isSuccessResponse = googleSignIn.isSuccessResponse;
  isErrorWithCode = googleSignIn.isErrorWithCode;
  statusCodes = googleSignIn.statusCodes;

  GoogleSignin.configure({
    webClientId: '873872579882-e7v3qb1rjjtcgqnuomoo6gdasd6shrdo.apps.googleusercontent.com',
  });
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated, logout, setLoading, isLoading, loginWithGoogle } = useAuthStore();
  const { isProUser, freeRecordingsUsed, maxFreeRecordings } = useSubscriptionStore();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Google Sign-In with Expo Auth Session (for Expo Go)
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '873872579882-e7v3qb1rjjtcgqnuomoo6gdasd6shrdo.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) {
        handleExpoGoogleSignIn(accessToken);
      }
    } else if (response?.type === 'error') {
      console.error('Google auth error:', response.error);
      Alert.alert('Error', 'Google sign-in failed');
    }
  }, [response]);

  // Handle Expo Go web-based Google Sign-In
  const handleExpoGoogleSignIn = async (accessToken: string) => {
    setLoading(true);
    try {
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userInfo = await userInfoResponse.json();

      if (userInfo.error) {
        throw new Error(userInfo.error.message);
      }

      loginWithGoogle({
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.email?.split('@')[0] || 'User',
      });
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert('Error', 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  // Handle Native Google Sign-In (for production builds)
  const handleNativeGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const { idToken } = response.data;

        if (idToken) {
          // Sign in with Firebase using the Google ID token
          const googleCredential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, googleCredential);
          const firebaseUser = userCredential.user;

          loginWithGoogle({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          });
        }
      }
    } catch (error: any) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User cancelled the sign-in
            break;
          case statusCodes.IN_PROGRESS:
            Alert.alert('Error', 'Sign-in already in progress');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert('Error', 'Google Play Services not available');
            break;
          default:
            console.error('Google sign-in error:', error);
            Alert.alert('Error', 'Failed to sign in with Google');
        }
      } else {
        console.error('Google sign-in error:', error);
        Alert.alert('Error', 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  // Unified Google Sign-In handler
  const handleGoogleSignIn = () => {
    if (isExpoGo) {
      promptAsync();
    } else {
      handleNativeGoogleSignIn();
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setAuthError('Please enter email and password');
      return;
    }

    setLoading(true);
    setAuthError('');

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      const firebaseUser = userCredential.user;
      loginWithGoogle({
        id: firebaseUser.uid,
        email: firebaseUser.email || email,
        name: firebaseUser.displayName || email.split('@')[0],
      });

      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error('Auth error:', error);
      let message = 'Authentication failed';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email already in use. Try signing in instead.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid email or password';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password';
      }
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError('Enter your email to reset password');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Password Reset', 'Check your email for reset instructions');
    } catch (error) {
      setAuthError('Failed to send reset email');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          navigation.goBack();
        },
      },
    ]);
  };

  const SettingsItem = ({
    icon,
    label,
    value,
    onPress,
    showArrow = true,
    iconColor = colors.textSecondary,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    showArrow?: boolean;
    iconColor?: string;
  }) => (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingsItemLeft}>
        <View style={[styles.settingsIconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.settingsItemLabel}>{label}</Text>
      </View>
      <View style={styles.settingsItemRight}>
        {value && <Text style={styles.settingsItemValue}>{value}</Text>}
        {showArrow && onPress && (
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Subscription Section */}
          <View style={styles.section}>
            <View style={styles.usageCard}>
              <View style={styles.usageHeader}>
                <Text style={styles.usageTitle}>Subscription</Text>
                <View style={[styles.usageBadge, isProUser && styles.proBadge]}>
                  <Text style={styles.usageBadgeText}>
                    {isProUser ? 'PRO' : 'FREE'}
                  </Text>
                </View>
              </View>
              {!isProUser && (
                <>
                  <View style={styles.usageBarContainer}>
                    <View
                      style={[
                        styles.usageBar,
                        { width: `${(freeRecordingsUsed / maxFreeRecordings) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.usageText}>
                    {freeRecordingsUsed} of {maxFreeRecordings} free recordings used
                  </Text>
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => navigation.navigate('Paywall')}
                  >
                    <Ionicons name="diamond" size={16} color={colors.accent} />
                    <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                </>
              )}
              {isProUser && (
                <Text style={styles.proText}>
                  Unlimited recordings enabled
                </Text>
              )}
            </View>
          </View>

          {/* Account Section */}
          {isAuthenticated && user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.profileCard}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.avatarGradient}
                >
                  <Ionicons name="person" size={28} color={colors.textOnPrimary} />
                </LinearGradient>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {user.displayName || 'User'}
                  </Text>
                  <Text style={styles.profileEmail}>{user.email}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.sectionCard}>
              <SettingsItem
                icon="language"
                label="Output Language"
                value="English (US)"
                iconColor={colors.primary}
                onPress={() => Alert.alert('Coming Soon', 'Language settings coming soon!')}
              />

              <View style={styles.divider} />

              <SettingsItem
                icon="sparkles"
                label="Default Style"
                value="Professional"
                iconColor={colors.accent}
                onPress={() => Alert.alert('Coming Soon', 'Default tone settings coming soon!')}
              />

              <View style={styles.divider} />

              <SettingsItem
                icon="musical-notes"
                label="Audio Quality"
                value="High"
                iconColor={colors.success}
                onPress={() => Alert.alert('Coming Soon', 'Audio quality settings coming soon!')}
              />
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.sectionCard}>
              <SettingsItem
                icon="information-circle"
                label="App Version"
                value="1.0.0"
                iconColor={colors.textLight}
                showArrow={false}
              />

              <View style={styles.divider} />

              <SettingsItem
                icon="document-text"
                label="Privacy Policy"
                iconColor={colors.textLight}
                onPress={() => Alert.alert('Privacy Policy', 'Opens privacy policy page')}
              />

              <View style={styles.divider} />

              <SettingsItem
                icon="shield-checkmark"
                label="Terms of Service"
                iconColor={colors.textLight}
                onPress={() => Alert.alert('Terms of Service', 'Opens terms of service page')}
              />

              <View style={styles.divider} />

              <SettingsItem
                icon="help-circle"
                label="Help & Support"
                iconColor={colors.textLight}
                onPress={() => Alert.alert('Help', 'Opens help page')}
              />
            </View>
          </View>

          {/* Auth Actions */}
          {isAuthenticated ? (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.authButtons}>
              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={isExpoGo ? (!request || isLoading) : isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Email Sign-In Button */}
              <TouchableOpacity
                style={styles.emailButton}
                onPress={() => setShowAuthModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="mail-outline" size={20} color={colors.textOnPrimary} />
                <Text style={styles.emailButtonText}>Continue with Email</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* Auth Modal */}
      <Modal
        visible={showAuthModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAuthModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
              <TouchableOpacity onPress={() => setShowAuthModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {authError ? (
              <Text style={styles.errorText}>{authError}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.authButton}
              onPress={handleEmailAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.authButtonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {!isSignUp && (
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={styles.switchAuth}>
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Create One"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  backButton: {
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
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  usageCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  usageTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  usageBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  usageBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  proBadge: {
    backgroundColor: colors.accent,
  },
  proText: {
    fontSize: typography.body,
    color: colors.success,
    fontWeight: typography.medium,
    marginTop: spacing.sm,
  },
  usageBarContainer: {
    height: 6,
    backgroundColor: colors.backgroundLight,
    borderRadius: 3,
    marginBottom: spacing.sm,
  },
  usageBar: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  usageText: {
    fontSize: typography.caption,
    color: colors.textLight,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  upgradeButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    color: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsItemLabel: {
    fontSize: typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingsItemValue: {
    fontSize: typography.bodySmall,
    color: colors.textLight,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  logoutText: {
    fontSize: typography.body,
    color: colors.error,
    fontWeight: typography.medium,
  },
  authButtons: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  googleButtonText: {
    fontSize: typography.body,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  emailButtonText: {
    fontSize: typography.body,
    color: colors.textOnPrimary,
    fontWeight: typography.medium,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.h4,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.bodySmall,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  authButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  authButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  forgotPassword: {
    color: colors.primary,
    fontSize: typography.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  switchAuth: {
    color: colors.textSecondary,
    fontSize: typography.bodySmall,
    textAlign: 'center',
  },
});
