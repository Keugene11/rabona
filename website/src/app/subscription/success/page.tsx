'use client';

import { CheckCircle, Mic } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Welcome to Premium!
        </h1>

        <p className="text-gray-400 mb-8">
          Your subscription is now active. Enjoy unlimited recordings, longer duration, and priority AI processing.
        </p>

        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors"
        >
          <Mic className="w-5 h-5" />
          <span>Start Recording</span>
        </Link>

        <p className="text-gray-600 text-sm mt-8">
          You can manage your subscription anytime from your account settings.
        </p>
      </div>
    </div>
  );
}
