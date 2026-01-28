'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  SubscriptionStatus,
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
} from '@/lib/api';

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, getToken } = useAuth();

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      const token = await getToken();
      if (token) {
        const subscriptionStatus = await getSubscriptionStatus(token);
        setStatus(subscriptionStatus);
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

  // Cache the last known subscription status in localStorage to prevent flickering
  useEffect(() => {
    if (status && user) {
      localStorage.setItem(`rabona_sub_${user.uid}`, JSON.stringify(status));
    }
  }, [status, user]);

  // Get cached status while loading
  const getCachedStatus = (): SubscriptionStatus | null => {
    if (typeof window === 'undefined' || !user) return null;
    try {
      const cached = localStorage.getItem(`rabona_sub_${user.uid}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const effectiveStatus = status || (loading ? getCachedStatus() : null);

  return {
    status: effectiveStatus,
    loading,
    isSubscribed: effectiveStatus?.isSubscribed ?? false,
    monthlyUsage: effectiveStatus?.monthlyUsage ?? 0,
    limit: effectiveStatus?.limit ?? 5,
    openCheckout,
    openPortal,
    refresh: fetchStatus,
  };
}
