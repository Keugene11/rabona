'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, ArrowLeft, Infinity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { AuthModal } from '@/components/AuthModal';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out Rabona',
    features: [
      '5 recordings per month',
      'AI-powered transcription',
      'Smart text enhancement',
      'Cloud sync for notes',
    ],
    cta: 'Get Started',
    highlighted: false,
    plan: null,
  },
  {
    name: 'Pro',
    price: '$4',
    period: '/month',
    description: 'For regular users who need more',
    features: [
      'Unlimited recordings',
      'AI-powered transcription',
      'Smart text enhancement',
      'Cloud sync across devices',
      'Priority processing',
      'Cancel anytime',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
    plan: 'monthly' as const,
  },
  {
    name: 'Lifetime',
    price: '$6',
    period: 'one-time',
    description: 'Best value - pay once, use forever',
    features: [
      'Unlimited recordings forever',
      'AI-powered transcription',
      'Smart text enhancement',
      'Cloud sync across devices',
      'Priority processing',
      'All future updates included',
    ],
    cta: 'Get Lifetime Access',
    highlighted: false,
    plan: 'lifetime' as const,
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const { isSubscribed, openCheckout } = useSubscription();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: 'monthly' | 'lifetime' | null) => {
    if (!plan) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoadingPlan(plan);
    try {
      await openCheckout(plan);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#202124] transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#FAF6F1] dark:bg-[#202124] border-b border-[#E8E0D5] dark:border-gray-700/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to app</span>
          </Link>
          <Link href="/" className="text-2xl font-serif italic text-gray-800 dark:text-gray-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">Rabona</Link>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif text-gray-900 dark:text-gray-100 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Transform your voice into polished text. Choose the plan that works for you.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-6 ${
                tier.highlighted
                  ? 'bg-gradient-to-b from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 border-2 border-amber-400 dark:border-amber-500 shadow-lg'
                  : 'bg-white dark:bg-[#2D2E30] border border-gray-200 dark:border-gray-700'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {tier.name === 'Lifetime' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-sm font-medium px-3 py-1 rounded-full flex items-center gap-1">
                    <Infinity className="w-4 h-4" />
                    Best Value
                  </span>
                </div>
              )}

              <div className="text-center mb-6 pt-2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {tier.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                    {tier.price}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {tier.period}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {tier.description}
                </p>
              </div>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(tier.plan)}
                disabled={
                  (tier.plan === null) ||
                  (isSubscribed && tier.plan !== null) ||
                  loadingPlan === tier.plan
                }
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  tier.highlighted
                    ? 'bg-amber-500 hover:bg-amber-600 text-white disabled:bg-amber-300 dark:disabled:bg-amber-700'
                    : tier.plan === 'lifetime'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-emerald-300 dark:disabled:bg-emerald-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                } disabled:cursor-not-allowed`}
              >
                {loadingPlan !== null && loadingPlan === tier.plan ? (
                  <span className="animate-pulse">Loading...</span>
                ) : isSubscribed && tier.plan !== null ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Already Pro
                  </>
                ) : (
                  tier.cta
                )}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Frequently Asked Questions
          </h3>
          <div className="max-w-2xl mx-auto space-y-4 text-left">
            <div className="bg-white dark:bg-[#2D2E30] rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                What happens to my recordings if I cancel?
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your existing notes remain accessible. You&apos;ll just be limited to 5 new recordings per month on the free plan.
              </p>
            </div>
            <div className="bg-white dark:bg-[#2D2E30] rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                Can I upgrade from monthly to lifetime?
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Yes! Cancel your monthly subscription and purchase lifetime access. Your Pro status continues uninterrupted.
              </p>
            </div>
            <div className="bg-white dark:bg-[#2D2E30] rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                Is there a refund policy?
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We offer a 7-day money-back guarantee for both monthly and lifetime plans. No questions asked.
              </p>
            </div>
          </div>
        </div>

        {/* Trust */}
        <div className="text-center mt-12 text-gray-500 dark:text-gray-400 text-sm">
          <p>Secure payments powered by Stripe</p>
        </div>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
