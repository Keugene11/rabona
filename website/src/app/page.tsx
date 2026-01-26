'use client';

import { useState, useEffect } from 'react';
import { LogOut, Sun, Moon, Search, X, Sparkles, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Recorder } from '@/components/Recorder';
import { NotesList } from '@/components/NotesList';
import { LocalNotesList } from '@/components/LocalNotesList';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const { user, loading, signOut, getToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isSubscribed, monthlyUsage, limit, openCheckout, refresh: refreshSubscription } = useSubscription();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      getToken().then(setToken);
    } else {
      setToken(null);
    }
  }, [user, getToken]);

  const handleNoteCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
    refreshSubscription(); // Refresh usage count
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F1] dark:bg-[#202124]">
        <div className="animate-pulse text-amber-600 dark:text-amber-400 font-serif italic text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#202124] transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#FAF6F1] dark:bg-[#202124] border-b border-[#E8E0D5] dark:border-gray-700/50">
        <div className="flex items-center px-3 py-2 gap-2">
          {/* Logo */}
          <div className="flex items-center gap-3 px-3">
            <h1 className="text-2xl font-serif italic text-gray-800 dark:text-gray-100 hidden sm:block">Rabona</h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <div className="flex items-center bg-[#EFEAE3] dark:bg-[#525355] rounded-lg px-4 py-2.5 gap-3">
              <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
                className="flex-1 bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            {/* Usage counter for logged-in free users */}
            {user && !isSubscribed && (
              <button
                onClick={() => openCheckout('monthly')}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span>{monthlyUsage}/{limit}</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400 font-medium">Upgrade</span>
              </button>
            )}

            {/* Pro badge for subscribers */}
            {user && isSubscribed && (
              <span className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30">
                <Sparkles className="w-4 h-4" />
                Pro
              </span>
            )}

            <button
              onClick={toggleTheme}
              className="p-3 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {user ? (
              <button
                onClick={signOut}
                className="p-3 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-10 py-6">
        {/* Recorder */}
        <div className="max-w-xl mx-auto mb-8">
          <Recorder token={token} onNoteCreated={handleNoteCreated} />
        </div>

        {/* Sign in prompt for non-logged in users */}
        {!user && (
          <div className="text-center py-4 mb-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
              Sign in to save your notes to the cloud
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Tutorial Video */}
        <div className="max-w-2xl mx-auto mb-10">
            <h2 className="text-center text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
              See how it works
            </h2>
            <a
              href="https://www.loom.com/share/4756817755794be0b3aa682719e441ed"
              target="_blank"
              rel="noopener noreferrer"
              className="block relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow group"
            >
              <img
                src="https://cdn.loom.com/sessions/thumbnails/4756817755794be0b3aa682719e441ed-31a67cf3b38db78e-full-play.gif"
                alt="Watch tutorial video"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 text-gray-800 ml-1" fill="currentColor" />
                </div>
              </div>
            </a>
        </div>

        {/* Notes Grid */}
        <div className="mt-4">
          {user && token ? (
            <NotesList token={token} refreshTrigger={refreshTrigger} searchQuery={searchQuery} />
          ) : (
            <LocalNotesList refreshTrigger={refreshTrigger} searchQuery={searchQuery} />
          )}
        </div>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
