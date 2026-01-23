import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

interface SubscriptionStore {
  isProUser: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  isLoading: boolean;
  freeRecordingsUsed: number;
  maxFreeRecordings: number;

  // Actions
  initializePurchases: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  incrementFreeUsage: () => void;
  canRecord: () => boolean;
  resetMonthlyUsage: () => void;
}

const REVENUECAT_API_KEY = 'test_CDcWNOEJyBhOhNqCTEqxaeoNNUt'; // Replace with your actual API key

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      isProUser: false,
      customerInfo: null,
      packages: [],
      isLoading: false,
      freeRecordingsUsed: 0,
      maxFreeRecordings: 3, // Free users get 3 recordings per month

      initializePurchases: async () => {
        try {
          set({ isLoading: true });

          // Configure RevenueCat
          Purchases.configure({ apiKey: REVENUECAT_API_KEY });

          // Get offerings
          const offerings = await Purchases.getOfferings();
          if (offerings.current?.availablePackages) {
            set({ packages: offerings.current.availablePackages });
          }

          // Check subscription status
          await get().checkSubscriptionStatus();

          set({ isLoading: false });
        } catch (error) {
          console.error('Error initializing purchases:', error);
          set({ isLoading: false });
        }
      },

      checkSubscriptionStatus: async () => {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const isProUser = customerInfo.entitlements.active['pro'] !== undefined;
          set({ customerInfo, isProUser });
        } catch (error) {
          console.error('Error checking subscription:', error);
        }
      },

      purchasePackage: async (pkg: PurchasesPackage) => {
        try {
          set({ isLoading: true });
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          const isProUser = customerInfo.entitlements.active['pro'] !== undefined;
          set({ customerInfo, isProUser, isLoading: false });
          return isProUser;
        } catch (error: any) {
          set({ isLoading: false });
          if (!error.userCancelled) {
            console.error('Error purchasing:', error);
          }
          return false;
        }
      },

      restorePurchases: async () => {
        try {
          set({ isLoading: true });
          const customerInfo = await Purchases.restorePurchases();
          const isProUser = customerInfo.entitlements.active['pro'] !== undefined;
          set({ customerInfo, isProUser, isLoading: false });
          return isProUser;
        } catch (error) {
          console.error('Error restoring purchases:', error);
          set({ isLoading: false });
          return false;
        }
      },

      incrementFreeUsage: () => {
        set((state) => ({
          freeRecordingsUsed: state.freeRecordingsUsed + 1,
        }));
      },

      canRecord: () => {
        const { isProUser, freeRecordingsUsed, maxFreeRecordings } = get();
        if (isProUser) return true;
        return freeRecordingsUsed < maxFreeRecordings;
      },

      resetMonthlyUsage: () => {
        set({ freeRecordingsUsed: 0 });
      },
    }),
    {
      name: 'voicenote-subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        freeRecordingsUsed: state.freeRecordingsUsed,
        isProUser: state.isProUser,
      }),
    }
  )
);
