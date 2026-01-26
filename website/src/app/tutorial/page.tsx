'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#202124] transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to app
        </Link>

        <h1 className="text-3xl font-serif text-gray-900 dark:text-white mb-2">
          How to use Rabona
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Learn how to capture and organize your thoughts with voice notes.
        </p>

        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg aspect-video">
          <iframe
            src="https://www.youtube.com/embed/r952ohS07nY"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
