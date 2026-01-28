'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  SubscriptionStatus,
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
} from '@/lib/api';

const SUBSCRIPTION_CACHE_KEY = 'rabona_subscription_cache';

function setCachedSubscription(status: SubscriptionStatus | null) {
  if (typeof window === 'undefined') return;
  try {
    if (status) {
      localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(status));
    } else {
      localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusForUserId, setStatusForUserId] = useState<string | null>(null);
  const { user, getToken } = useAuth();

  const fetchStatus = useCallback(async () => {
    // User is logged out
    if (!user) {
      setStatus(null);
      setCachedSubscription(null);
      setLoading(false);
      setStatusForUserId(null);
      return;
    }

    try {
      const token = await getToken();
      if (token) {
        const subscriptionStatus = await getSubscriptionStatus(token);
        setStatus(subscriptionStatus);
        setCachedSubscription(subscriptionStatus);
        setStatusForUserId(user.uid); // Mark that we have status for this user
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const openCheckout = async (plan: 'monthly' | 'yearly' | 'lifetime' = 'monthly') => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('No auth token available');
        alert('Please sign in to upgrade');
        return;
      }

      const response = await createCheckoutSession(token, plan);
      console.log('Checkout response:', response);

      if (response.url) {
        window.location.href = response.url;
      } else {
        console.error('No checkout URL in response:', response);
        alert('Failed to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to connect to payment server. Please try again.');
    }
  };

  const openPortal = async () => {
    try {
      const token = await getToken();
      if (token) {
        const { url } = await createPortalSession(token);
        if (url) {
          window.location.href = url;
        }
      }
    } catch (error) {
      console.error('Failed to create portal session:', error);
    }
  };

  // Only consider status valid if it's for the current user
  // This prevents showing stale status (like 0/5) when user changes
  const hasValidStatus = user !== null && statusForUserId === user.uid;

  // Only return isSubscribed: true if we have valid status confirming subscription
  // This ensures we never show wrong state due to timing issues
  const isSubscribed = hasValidStatus && status?.isSubscribed === true;

  return {
    status,
    loading,
    hasFetchedOnce: hasValidStatus,
    isSubscribed,
    monthlyUsage: hasValidStatus ? (status?.monthlyUsage ?? 0) : 0,
    limit: hasValidStatus ? (status?.limit ?? 5) : 5,
    openCheckout,
    openPortal,
    refresh: fetchStatus,
  };
}
