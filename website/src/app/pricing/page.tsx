'use client';

import { useState } from 'react';
import { Mic, Check, Zap, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createCheckoutSession } from '@/lib/api';
import { AuthModal } from '@/components/AuthModal';
import Link from 'next/link';

export default function PricingPage() {
  const { user, getToken } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoading(plan);
    try {
      const token = await getToken();
      if (!token) {
        setShowAuthModal(true);
        return;
      }

      const { url } = await createCheckoutSession(token, plan);
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Rabona</h1>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center space-y-4 mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Upgrade to{' '}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Premium
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Unlock unlimited recordings, longer duration, and priority AI processing
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Free</h3>
              <div className="text-4xl font-bold text-white">$0</div>
              <p className="text-gray-500 mt-1">Forever free</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-center text-gray-400">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                10 recordings per month
              </li>
              <li className="flex items-center text-gray-400">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                5 minutes max per recording
              </li>
              <li className="flex items-center text-gray-400">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                AI transcription & rephrasing
              </li>
              <li className="flex items-center text-gray-400">
                <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                Cloud sync
              </li>
            </ul>

            <Link
              href="/"
              className="block w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl text-center transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Monthly */}
          <div className="bg-gray-900/50 border-2 border-purple-500 rounded-2xl p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-purple-500 text-white text-sm font-medium px-4 py-1 rounded-full">
                Popular
              </span>
            </div>

            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Monthly</h3>
              <div className="text-4xl font-bold text-white">$4.99</div>
              <p className="text-gray-500 mt-1">per month</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
                <strong>Unlimited</strong>&nbsp;recordings
              </li>
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
                <strong>30 minutes</strong>&nbsp;max per recording
              </li>
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
                Priority AI processing
              </li>
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
                All free features included
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('monthly')}
              disabled={loading === 'monthly'}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
            >
              {loading === 'monthly' ? 'Loading...' : 'Subscribe Monthly'}
            </button>
          </div>

          {/* Yearly */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-green-500 text-white text-sm font-medium px-4 py-1 rounded-full">
                Save 33%
              </span>
            </div>

            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Yearly</h3>
              <div className="text-4xl font-bold text-white">$39.99</div>
              <p className="text-gray-500 mt-1">per year</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                <strong>Unlimited</strong>&nbsp;recordings
              </li>
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                <strong>30 minutes</strong>&nbsp;max per recording
              </li>
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                Priority AI processing
              </li>
              <li className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                All free features included
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('yearly')}
              disabled={loading === 'yearly'}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
            >
              {loading === 'yearly' ? 'Loading...' : 'Subscribe Yearly'}
            </button>
          </div>
        </div>

        {/* FAQ or Trust */}
        <div className="text-center mt-16 text-gray-500 text-sm">
          <p>Cancel anytime. No questions asked.</p>
          <p className="mt-2">Secure payments powered by Stripe</p>
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
